import { useRouter, type RegisteredRouter } from "@tanstack/react-router";
import { isViewTransitionActive } from "@web/lib/view-transition";
import { useEffect, useRef, type RefObject } from "react";

/** 全局并发上限：首屏卡片进入视口时批量预热详情，避免瞬时打爆 server function RPC。
 * 列表页「加载更多」后卡片数翻倍，并发 8 会抢占点击导航的网络/主线程，降到 4。 */
const MAX_CONCURRENT = 4;
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
export function useViewportPreload(
	ref: RefObject<HTMLElement | null>,
	makeTask: (router: RegisteredRouter) => (() => Promise<unknown>) | undefined,
) {
	const router = useRouter();
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
		const el = ref.current;
		if (!el || typeof IntersectionObserver === "undefined") return;
		// 降级模式下不建立视口观察（hover 意图预取见 useIntentPreload）
		if (isViewportPreloadDegraded()) return;
		let cancelPreload: (() => void) | null = null;
		// 暂停期间已滚入视口但未调度的条目：解除暂停时补一次调度
		let pendingResume = false;
		const onResume = () => {
			if (!pendingResume || cancelPreload) return;
			pendingResume = false;
			try {
				const task = makeTaskRef.current(router);
				if (task) cancelPreload = schedule(task);
				else io.disconnect();
			} catch {
				// 预取失败静默忽略，不影响后续导航
			}
		};
		resumeListeners.add(onResume);

		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						if (cancelPreload) continue;
						// 「加载更多」进行中：暂停新调度，等解除暂停后补发
						if (preloadPaused) {
							pendingResume = true;
							continue;
						}
						try {
							const task = makeTaskRef.current(router);
							if (task) cancelPreload = schedule(task);
							else io.disconnect();
						} catch {
							// 预取失败静默忽略，不影响后续导航
						}
					} else if (cancelPreload) {
						cancelPreload();
						cancelPreload = null;
					}
				}
			},
			{ rootMargin: "100px" },
		);

		io.observe(el);
		return () => {
			resumeListeners.delete(onResume);
			cancelPreload?.();
			io.disconnect();
		};
	}, [router, ref]);
}

/**
 * 意图预取：hover / focus 时预热路由。大列表降级模式下的替代方案 —
 * 用户明确表达兴趣才发请求，点击秒开率接近视口预取，但零滚动洪峰。
 */
export function useIntentPreload(
	ref: RefObject<HTMLElement | null>,
	makeTask: (router: RegisteredRouter) => (() => Promise<unknown>) | undefined,
) {
	const router = useRouter();
	const makeTaskRef = useRef(makeTask);
	makeTaskRef.current = makeTask;

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		let cancelPreload: (() => void) | null = null;

		const onEnter = () => {
			if (cancelPreload) return;
			try {
				const task = makeTaskRef.current(router);
				if (task) cancelPreload = schedule(task);
			} catch {
				// 预取失败静默忽略，不影响后续导航
			}
		};
		const onLeave = () => {
			cancelPreload?.();
			cancelPreload = null;
		};

		el.addEventListener("pointerenter", onEnter);
		el.addEventListener("focus", onEnter);
		el.addEventListener("pointerleave", onLeave);
		el.addEventListener("blur", onLeave);
		return () => {
			onLeave();
			el.removeEventListener("pointerenter", onEnter);
			el.removeEventListener("focus", onEnter);
			el.removeEventListener("pointerleave", onLeave);
			el.removeEventListener("blur", onLeave);
		};
	}, [router, ref]);
}
