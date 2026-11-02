import { type RegisteredRouter, useRouter } from "@web/lib/nav";
import { isViewTransitionActive } from "@web/lib/view-transition";
import { type RefObject, useEffect, useRef } from "react";

/** 全局并发上限：预取只做「点击前最后一跳」，2 个并发足够；
 * 早期取 4 时首屏一次挂载几十张卡会让浏览器 6 条连接被预取占满，
 * 图片/会话请求排队，反而让页面变卡（实测首页一次发 16 条 _furin=data）。
 * 导出供单测断言。 */
export const MAX_CONCURRENT = 2;
/** 大列表阈值：超过此卡片数时视口预取自动降级（只响应 hover/focus 意图），
 * 滚动不再触发成片 preloadRoute，避免返回列表时的预取洪峰。 */
export const VIEWPORT_PRELOAD_DEGRADE_AFTER = 96;

let mountedCards = 0;
const degradeListeners = new Set<() => void>();

function notifyDegrade() {
	for (const fn of degradeListeners) fn();
}

/** 全局暂停信号：games 列表「加载更多」请求进行中置 true，
 * 视口预取暂停新的调度（已排队的并发队列自然消费完），
 * 把带宽/主线程让给图片下载与解码。解除时已越界待预取的卡会补调度。 */
let preloadPaused = false;
const resumeListeners = new Set<() => void>();

export function setViewportPreloadPaused(paused: boolean) {
	if (preloadPaused === paused) return;
	preloadPaused = paused;
	if (!paused) {
		for (const fn of resumeListeners) fn();
	}
}

/** 当前是否处于降级模式（挂载卡片超阈值） */
export function isViewportPreloadDegraded() {
	return mountedCards > VIEWPORT_PRELOAD_DEGRADE_AFTER;
}

interface QueueEntry {
	run: () => void;
	cancelled: boolean;
	/** 并发名额是否已归还（完成时正常归还 / 取消时提前归还，二选一） */
	slotReleased: boolean;
}

let active = 0;
const waiting: QueueEntry[] = [];

/** VT 播放期间暂缓派发的兜底上限：动画正常只有几百毫秒，超过仍判定活跃
 * （:active-view-transition 未及时失效，或 rAF 被后台标签页节流）就强制放行，
 * 避免预取队列死锁。 */
const VT_DRAIN_TIMEOUT_MS = 1500;

/** VT 排空轮询的 rAF 句柄（undefined = 未 arm）；同一时刻只跑一条轮询链 */
let drainFrame: number | undefined;
/** 本轮 VT 挂起的起始时刻（undefined = 当前没有挂起），用于兜底计时 */
let holdSince: number | undefined;

/** 单调时钟（performance 不可用时退回 Date.now） */
function now(): number {
	if (
		typeof performance !== "undefined" &&
		typeof performance.now === "function"
	) {
		return performance.now();
	}
	return Date.now();
}

/** 能否逐帧轮询：node/SSR 没有 rAF，此时不做 VT 延后（保持原行为） */
function canPollFrames(): boolean {
	return typeof requestAnimationFrame === "function";
}

/**
 * 是否应因 VT 播放而暂缓派发（true = 先入队，等动画结束再补发）。
 * 无 rAF 环境、或本次挂起已超兜底时限时返回 false（直接放行）；
 * VT 真正结束后清空挂起时刻，下一次 VT 重新计时。
 */
function shouldHoldForVt(): boolean {
	if (!canPollFrames() || !isViewTransitionActive()) {
		holdSince = undefined;
		return false;
	}
	holdSince ??= now();
	return now() - holdSince < VT_DRAIN_TIMEOUT_MS;
}

/** 等 VT 结束后排空队列：逐帧检查，动画结束的那一帧恢复派发 */
function armVtDrain() {
	if (drainFrame !== undefined || !canPollFrames()) return;
	const tick = () => {
		drainFrame = undefined;
		if (shouldHoldForVt()) {
			drainFrame = requestAnimationFrame(tick);
			return;
		}
		pump();
	};
	drainFrame = requestAnimationFrame(tick);
}

function pump() {
	if (waiting.length === 0) return;
	// VT 播放期间不启动新的预取（动态 import + loader 请求会与动画抢主线程），
	// 队列留到动画结束后由 armVtDrain 的 tick 统一补发
	if (shouldHoldForVt()) {
		armVtDrain();
		return;
	}
	while (waiting.length > 0 && active < MAX_CONCURRENT) {
		const entry = waiting.shift();
		if (entry && !entry.cancelled) entry.run();
	}
}

function releaseSlot(entry: QueueEntry) {
	if (entry.slotReleased) return;
	entry.slotReleased = true;
	if (active > 0) active--;
	pump();
}

/**
 * 带取消的预取调度，返回 cancel 函数：
 * - 排队中取消 → 直接出队，请求不会发起
 * - 进行中取消 → 立即归还并发名额，让位给新进入视口的条目；
 *   底层请求自然收尾并把数据写入路由缓存（router 无公开的单预取中止 API，
 *   且半途丢弃已传输数据纯属浪费），只是不再占用调度额度
 */
function schedule(task: () => Promise<unknown>): () => void {
	const entry: QueueEntry = {
		run: () => {},
		cancelled: false,
		slotReleased: false,
	};

	entry.run = () => {
		active++;
		Promise.resolve()
			.then(() => {
				if (!entry.cancelled) return task();
			})
			.catch(() => {})
			.finally(() => releaseSlot(entry));
	};

	// VT 播放中：即使有空闲并发名额也先入队，动画结束后统一补发
	const hold = shouldHoldForVt();
	if (!hold && active < MAX_CONCURRENT) entry.run();
	else {
		waiting.push(entry);
		if (hold) armVtDrain();
	}

	return () => {
		if (entry.cancelled) return;
		entry.cancelled = true;
		const idx = waiting.indexOf(entry);
		if (idx >= 0) waiting.splice(idx, 1);
		else releaseSlot(entry);
	};
}

/**
 * 仅供单测驱动调度队列（生产代码只经 useViewportPreload / useIntentPreload
 * 间接使用）：便于在无渲染环境下断言「VT 期间排队 → 结束后补发 / 排队中
 * 取消 / 无 VT 立即执行」。命名带 __test 前缀，避免被当作公开 API。
 */
export const __testSchedule = schedule;

/**
 * 链接进入视口时预取路由（JS chunk + loader 数据），Next.js <Link> 的等价行为。
 * 网格中从未请求过的条目在滚入视口前完成预热，点击直接命中路由缓存秒开。
 * - rootMargin 提前 100px 开始（原 200px：加载多页时提前量太大等于全量预取）
 * - 离开视口且预取未完成 → 立即取消（排队中不出队不发、进行中让出名额），
 *   释放浏览器加载能力给后面出现在窗口里的条目；重新进入视口会再次预取
 * - 大列表降级：挂载卡片超阈值时滚动不再预取，只响应 hover/focus 意图；
 *   由调用方按需改用 useIntentPreload（悬停预热）
 * - 仅运行 loader，不触发路由 onEnter，view/下载计数不受影响
 */
/** 预取策略：
 * - `intent`（默认）：只有 hover / focus / pointerdown 才预取（滚动零请求）；
 * - `viewport`：滚入视口即预取（旧行为，会形成首屏请求洪峰，仅在明确需要时开启）；
 * - `off`：完全不预取。
 *
 * 为什么默认改成 intent：实测首页加载会一次发起 16 条 `?_furin=data`
 * （10 张游戏卡 + 5 个标签页 + 若干列表页），每条都要跑完整 loader 链；
 * 浏览器对同源只有 ~6 条并发连接，这些请求把连接占满后，
 * 图片/会话/后续点击数据全部排队，页面体感上被「预取」拖住。
 * 而 hover 意图预取的命中率接近视口预取，却只在用户真的指向卡片时才发 1 条。
 */
export const PREFETCH_MODE: "intent" | "viewport" | "off" = "intent";

/** hover 停留多久才预取：避免鼠标划过列表时连续触发 */
const INTENT_DWELL_MS = 60;

/** 视口模式（非默认）下，页面级预取预算：超过就不再自动预取，避免长列表滚动洪峰 */
const VIEWPORT_BUDGET = 8;
let viewportBudgetLeft = VIEWPORT_BUDGET;

/** 省流/弱网下不预取（Chrome/Safari 的 navigator.connection） */
export function canPrefetch(): boolean {
	if (typeof navigator === "undefined") return false;
	const connection = (
		navigator as Navigator & {
			connection?: { saveData?: boolean; effectiveType?: string };
		}
	).connection;
	if (connection?.saveData) return false;
	if (
		connection?.effectiveType !== undefined &&
		["slow-2g", "2g"].includes(connection.effectiveType)
	) {
		return false;
	}
	return true;
}

/** 空闲时执行（不支持 rIC 的环境退回 setTimeout） */
function whenIdle(fn: () => void, timeout = 1200): () => void {
	if (typeof requestIdleCallback === "function") {
		const handle = requestIdleCallback(fn, { timeout });
		return () => cancelIdleCallback(handle);
	}
	const handle = setTimeout(fn, 200);
	return () => clearTimeout(handle);
}

/**
 * 开发模式标记（由根布局按服务端 NODE_ENV 设置）。
 * `bun --hot` 下 `?_furin=data` 会在服务端**按需编译路由**，一次预取要 1~8s，
 * 空闲预取反而把浏览器连接占满、拖慢本地调试；生产构建没有这个开销。
 */
let devMode = false;

export function setPrefetchDevMode(value: boolean) {
	devMode = value;
}

export function isPrefetchDevMode() {
	return devMode;
}

/** 低优先级的「空闲预取」是否允许：dev 下关闭（详见 devMode 注释） */
export function idlePrefetchAllowed(): boolean {
	return !devMode && PREFETCH_MODE !== "off" && canPrefetch();
}

/** 已经绑定过意图监听的元素（两个 hook 同时用在同一个 <a> 上时只绑一次） */
const intentBound = new WeakSet<HTMLElement>();

/**
 * 意图预取绑定：hover 停留 60ms / focus / pointerdown（含触屏）时预热路由。
 * 返回解绑函数。
 */
function bindIntentPreload(
	el: HTMLElement,
	getRouter: () => RegisteredRouter,
	makeTask: (router: RegisteredRouter) => (() => Promise<unknown>) | undefined,
): () => void {
	if (intentBound.has(el)) return () => {};
	intentBound.add(el);

	let cancelPreload: (() => void) | null = null;
	let dwellTimer: ReturnType<typeof setTimeout> | undefined;

	const run = () => {
		if (cancelPreload || !canPrefetch()) return;
		try {
			const task = makeTask(getRouter());
			if (task) cancelPreload = schedule(task);
		} catch {
			// 预取失败静默忽略，不影响后续导航
		}
	};

	const startDelayed = () => {
		if (cancelPreload || dwellTimer !== undefined) return;
		dwellTimer = setTimeout(() => {
			dwellTimer = undefined;
			run();
		}, INTENT_DWELL_MS);
	};

	const startNow = () => {
		if (dwellTimer !== undefined) {
			clearTimeout(dwellTimer);
			dwellTimer = undefined;
		}
		run();
	};

	const stop = () => {
		if (dwellTimer !== undefined) {
			clearTimeout(dwellTimer);
			dwellTimer = undefined;
		}
		cancelPreload?.();
		cancelPreload = null;
	};

	el.addEventListener("pointerenter", startDelayed);
	el.addEventListener("focus", startNow);
	// 触屏没有 hover：按下即预取，能在点击导航前抢出一次请求
	el.addEventListener("pointerdown", startNow);
	el.addEventListener("pointerleave", stop);
	el.addEventListener("blur", stop);
	el.addEventListener("pointercancel", stop);

	return () => {
		stop();
		el.removeEventListener("pointerenter", startDelayed);
		el.removeEventListener("focus", startNow);
		el.removeEventListener("pointerdown", startNow);
		el.removeEventListener("pointerleave", stop);
		el.removeEventListener("blur", stop);
		el.removeEventListener("pointercancel", stop);
		intentBound.delete(el);
	};
}

/**
 * 卡片预热入口（名字沿用旧 API）：默认走**意图预取**，见 `PREFETCH_MODE`。
 *
 * - `intent`：hover / focus / pointerdown 才预取；
 * - `viewport`：滚入视口即预取（旧行为；带空闲调度 + 全页预算，避免洪峰）；
 * - `off`：不预取。
 *
 * 仅运行 loader，不触发路由 onEnter，view/下载计数不受影响。
 */
export function useViewportPreload(
	ref: RefObject<HTMLElement | null>,
	makeTask: (router: RegisteredRouter) => (() => Promise<unknown>) | undefined,
) {
	const router = useRouter();
	const routerRef = useRef(router);
	// 只更新 ref，不进 effect 依赖：router 每次导航都会换引用，
	// 作为依赖会让每张卡重绑监听器。
	useEffect(() => {
		routerRef.current = router;
	}, [router]);
	const makeTaskRef = useRef(makeTask);
	makeTaskRef.current = makeTask;

	useEffect(() => {
		mountedCards++;
		// 刚越过阈值时通知已挂载的卡切换模式
		if (mountedCards === VIEWPORT_PRELOAD_DEGRADE_AFTER + 1) notifyDegrade();
		return () => {
			mountedCards--;
		};
	}, []);

	useEffect(() => {
		if (PREFETCH_MODE === "off") return;
		const el = ref.current;
		if (!el) return;

		if (PREFETCH_MODE === "intent") {
			return bindIntentPreload(el, () => routerRef.current, (r) =>
				makeTaskRef.current(r),
			);
		}

		// 视口模式（非默认）：滚入视口后在空闲时预取，且受全页预算限制
		if (typeof IntersectionObserver === "undefined") return;
		// ⚠ effect 依赖只有 ref：这里早退的卡片不会因降级解除而重跑，
		// 切回 PREFETCH_MODE = "viewport" 前必须把降级信号做成订阅式依赖。
		if (isViewportPreloadDegraded()) return;
		let cancelPreload: (() => void) | null = null;
		let cancelIdle: (() => void) | null = null;
		let pendingResume = false;

		const runScheduled = () => {
			cancelIdle = null;
			if (cancelPreload || viewportBudgetLeft <= 0) return;
			const task = makeTaskRef.current(routerRef.current);
			if (!task) return;
			viewportBudgetLeft--;
			cancelPreload = schedule(task);
		};

		const onResume = () => {
			if (!pendingResume || cancelPreload) return;
			pendingResume = false;
			if (viewportBudgetLeft <= 0) return;
			cancelIdle ??= whenIdle(runScheduled);
		};
		resumeListeners.add(onResume);

		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						if (cancelPreload || cancelIdle) continue;
						if (preloadPaused) {
							pendingResume = true;
							continue;
						}
						cancelIdle = whenIdle(runScheduled);
					} else {
						cancelIdle?.();
						cancelIdle = null;
						cancelPreload?.();
						cancelPreload = null;
					}
				}
			},
			{ rootMargin: "0px" },
		);

		io.observe(el);
		return () => {
			resumeListeners.delete(onResume);
			cancelIdle?.();
			cancelPreload?.();
			io.disconnect();
		};
		// router 走 ref，故意不进依赖：否则每次导航都会重绑监听器
	}, [ref]);
}

/**
 * 意图预取：hover / focus / pointerdown 时预热路由。
 * 与 `useViewportPreload`（默认 intent 模式）共用同一绑定，同一元素只绑一次。
 */
export function useIntentPreload(
	ref: RefObject<HTMLElement | null>,
	makeTask: (router: RegisteredRouter) => (() => Promise<unknown>) | undefined,
) {
	const router = useRouter();
	const routerRef = useRef(router);
	// 只更新 ref，不进 effect 依赖：router 每次导航都会换引用，
	// 作为依赖会让每张卡重绑监听器。
	useEffect(() => {
		routerRef.current = router;
	}, [router]);
	const makeTaskRef = useRef(makeTask);
	makeTaskRef.current = makeTask;

	useEffect(() => {
		if (PREFETCH_MODE === "off") return;
		const el = ref.current;
		if (!el) return;
		return bindIntentPreload(el, () => routerRef.current, (r) =>
			makeTaskRef.current(r),
		);
		// router 走 ref，故意不进依赖：否则每次导航都会重绑监听器
	}, [ref]);
}
