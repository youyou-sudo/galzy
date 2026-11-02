import { isViewTransitionActive } from "./view-transition";

/**
 * 图片揭示门控：滚动 / View Transition 进行中，挂起真实图揭示类 setState
 * 提交，空闲后批量 flush。
 *
 * 动机：与 image.ts 的 setThumbHashDecodePaused（thumbhash 解码滚动暂停）
 * 类似，但覆盖所有页面、针对的是真实图揭示提交 —— 卡片的 img.decode()
 * 完成回调完全不受门控时，页面滚动或 VT 动画进行中每张图 decode 完成
 * 都会立刻 setState re-render，把提交洒进滚动帧/动画帧，是移动端
 * 列表滑动与 VT 过渡掉帧的根因之一。挂起后由本模块在空闲窗口统一
 * 批量 flush，React 自动批处理合并为一次渲染调度。
 *
 * 分片动机：flush 不再一次性全量执行，而是每帧最多 FLUSH_CHUNK_SIZE 个
 * 提交，用 requestAnimationFrame 链逐帧排空。否则"加载更多"后新挂载
 * 一批卡片继续滑动时提交持续累积，兜底定时器到点会单帧执行全部揭示
 * 提交（每个提交都会卸载 Skeleton 并翻转占位图 opacity），低端
 * WebView 单帧大提交直接掉帧。无 rAF 环境（SSR/测试）退化为
 * setTimeout 16ms 兜底。
 */

/** 滚动静默判定窗口：该时长内无新 scroll 事件视为滚动结束 */
const SCROLL_SETTLE_MS = 180;
/** 门控未解除时的重试间隔（setTimeout 链式自排） */
const FLUSH_RETRY_MS = 80;
/** 兜底强刷上限：防止任何状态机死角导致图片永不揭示 */
const MAX_WAIT_MS = 1500;
/** 单帧最多执行的提交数：分片 flush，避免单帧大提交掉帧 */
const FLUSH_CHUNK_SIZE = 6;
/** 无 rAF 环境下的分片帧间隔（≈ 一帧） */
const FLUSH_CHUNK_INTERVAL_MS = 16;

let scrolling = false;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
let chunkRafHandle: number | undefined;
let chunkTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
let installed = false;

/** 挂起中的揭示提交（门控期间由 gateCommit 收纳） */
const pending = new Set<() => void>();

function clearFlushTimers() {
	if (retryTimer !== undefined) {
		clearTimeout(retryTimer);
		retryTimer = undefined;
	}
	if (maxWaitTimer !== undefined) {
		clearTimeout(maxWaitTimer);
		maxWaitTimer = undefined;
	}
}

/** 取消排程中的分片帧（rAF 或 setTimeout 兜底） */
function cancelChunkFlush() {
	if (chunkRafHandle !== undefined) {
		window.cancelAnimationFrame(chunkRafHandle);
		chunkRafHandle = undefined;
	}
	if (chunkTimeoutHandle !== undefined) {
		clearTimeout(chunkTimeoutHandle);
		chunkTimeoutHandle = undefined;
	}
}

/** 排程下一分片帧：优先 rAF，无 rAF 环境用 setTimeout 16ms 兜底 */
function scheduleChunkFlush() {
	if (chunkRafHandle !== undefined || chunkTimeoutHandle !== undefined) return;
	const raf =
		typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
			? window.requestAnimationFrame.bind(window)
			: undefined;
	if (raf !== undefined) {
		chunkRafHandle = raf(() => {
			chunkRafHandle = undefined;
			flushChunk();
		});
	} else {
		chunkTimeoutHandle = setTimeout(() => {
			chunkTimeoutHandle = undefined;
			flushChunk();
		}, FLUSH_CHUNK_INTERVAL_MS);
	}
}

/**
 * 队列分片执行器：取最早加入的至多 FLUSH_CHUNK_SIZE 个提交同步执行，
 * 返回是否仍有剩余（调用方据此排下一帧）。滚动门控队列与 VT 收尾队列
 * 共用同一条分片节奏，避免两套阈值漂移。
 */
function drainChunk(queue: Set<() => void>): boolean {
	const batch: Array<() => void> = [];
	for (const commit of queue) {
		if (batch.length >= FLUSH_CHUNK_SIZE) break;
		batch.push(commit);
		queue.delete(commit);
	}
	for (const commit of batch) commit();
	return queue.size > 0;
}

/**
 * 执行一个分片：取 pending 中最早加入的至多 FLUSH_CHUNK_SIZE 个执行；
 * 仍有剩余则排下一帧继续排空，清空后停止排程并清掉门控定时器。
 */
function flushChunk() {
	if (pending.size === 0) {
		clearFlushTimers();
		return;
	}
	if (drainChunk(pending)) {
		scheduleChunkFlush();
	} else {
		clearFlushTimers();
	}
}

/**
 * 请求下一帧执行 callback，返回取消函数。优先 requestAnimationFrame；
 * 无 rAF 环境退化为 setTimeout(16ms)，与分片 flush 的兜底帧间隔一致。
 */
function scheduleFrame(callback: () => void): () => void {
	const raf =
		typeof window !== "undefined" &&
		typeof window.requestAnimationFrame === "function"
			? window.requestAnimationFrame.bind(window)
			: undefined;
	if (raf !== undefined) {
		const handle = raf(callback);
		return () => window.cancelAnimationFrame(handle);
	}
	const handle = setTimeout(callback, FLUSH_CHUNK_INTERVAL_MS);
	return () => clearTimeout(handle);
}

/** 强制分片 flush：不走门控判断，供门控解除与兜底定时器使用 */
function forceFlushPending() {
	if (pending.size === 0) return;
	clearFlushTimers();
	cancelChunkFlush();
	flushChunk();
}

/** 门控解除时批量 flush；仍处于门控中则交给重试链/兜底定时器 */
function flushPending() {
	if (pending.size === 0) return;
	if (isRevealGated()) return;
	forceFlushPending();
}

/** 重试链：门控未解除则间隔自排，解除后 flush */
function scheduleRetry() {
	if (retryTimer !== undefined) clearTimeout(retryTimer);
	retryTimer = setTimeout(() => {
		retryTimer = undefined;
		if (pending.size === 0) return;
		if (isRevealGated()) {
			scheduleRetry();
			return;
		}
		flushPending();
	}, FLUSH_RETRY_MS);
}

if (typeof window !== "undefined" && !installed) {
	installed = true;
	// capture 捕获阶段监听，覆盖页面内任意滚动容器；passive 不阻塞滚动
	window.addEventListener(
		"scroll",
		() => {
			scrolling = true;
			if (settleTimer !== undefined) clearTimeout(settleTimer);
			settleTimer = setTimeout(() => {
				settleTimer = undefined;
				scrolling = false;
				flushPending();
			}, SCROLL_SETTLE_MS);
		},
		{ passive: true, capture: true },
	);
}

/**
 * 当前是否应挂起揭示提交：滚动进行中或 View Transition 进行中。
 * SSR（无 window/document）恒 false —— 门控库在服务端完全透明。
 */
export function isRevealGated(): boolean {
	if (typeof window === "undefined") return false;
	return scrolling || isViewTransitionActive();
}

/**
 * 把揭示提交交给门控调度：
 * - 未门控 → 同步立即执行 commit()，返回空取消函数；
 * - 已门控 → 收纳进 pending，返回取消函数（组件 unmount / 依赖变化时
 *   调用，防止过期闭包在 flush 时执行）。挂起的 commit 执行前不再复查
 *   门控状态（flush 时机即门控解除时刻），由闭包内自身的 cancelled
 *   检查保证不提交过期状态。flush 按分片逐帧执行：已被分片取出执行
 *   的批次不受取消影响，与原 forceFlushPending 语义一致。
 */
export function gateCommit(commit: () => void): () => void {
	if (typeof window === "undefined") {
		commit();
		return () => {};
	}
	if (!isRevealGated()) {
		commit();
		return () => {};
	}

	pending.add(commit);
	if (pending.size === 1) {
		scheduleRetry();
		// 兜底：首次出现挂起时启动强制定时器，无论门控状态到点直接 flush
		// （分片执行：第一片立即执行，剩余逐帧排空）
		maxWaitTimer = setTimeout(forceFlushPending, MAX_WAIT_MS);
	}

	return () => {
		pending.delete(commit);
		if (pending.size === 0) {
			clearFlushTimers();
			cancelChunkFlush();
		}
	};
}

/**
 * VT 收尾提交队列（与滚动门控的 pending 分开维护）。
 *
 * 动机：详情页的封面 / 标签 / 文件列表等多个组件都要「等 VT 结束再提交」，
 * 各自 then 一次 setState 会在动画结束的同一帧集中提交，形成一次较长提交
 * （每个提交都要卸载骨架并挂载整棵真实子树）。这里让它们共用一条队列，
 * 结束时刻统一按「每帧至多 FLUSH_CHUNK_SIZE 个」的节奏放行，把集中提交摊到
 * 相邻几帧；首片仍在 VT 结束后的微任务里立即执行，不额外增加首条提交延迟。
 */
const vtPending = new Set<() => void>();
let cancelVtPollFrame: (() => void) | undefined;
let cancelVtChunkFrame: (() => void) | undefined;
let vtFallbackTimer: ReturnType<typeof setTimeout> | undefined;

/** 清理 VT 队列的全部排程（轮询帧 / 分片帧 / 兜底定时器），幂等 */
function clearVtTimers() {
	if (cancelVtPollFrame !== undefined) {
		cancelVtPollFrame();
		cancelVtPollFrame = undefined;
	}
	if (cancelVtChunkFrame !== undefined) {
		cancelVtChunkFrame();
		cancelVtChunkFrame = undefined;
	}
	if (vtFallbackTimer !== undefined) {
		clearTimeout(vtFallbackTimer);
		vtFallbackTimer = undefined;
	}
}

/** 放行一个 VT 分片；仍有剩余则排下一帧，清空后停掉全部排程 */
function flushVtChunk() {
	if (vtPending.size === 0) {
		clearVtTimers();
		return;
	}
	if (drainChunk(vtPending)) {
		scheduleVtChunk();
	} else {
		clearVtTimers();
	}
}

/** 排程下一 VT 分片帧（rAF，无 rAF 环境 16ms 兜底） */
function scheduleVtChunk() {
	if (cancelVtChunkFrame !== undefined || vtPending.size === 0) return;
	cancelVtChunkFrame = scheduleFrame(() => {
		cancelVtChunkFrame = undefined;
		flushVtChunk();
	});
}

/**
 * rAF 轮询等待 VT 结束：期间若被新 VT 接管（:active-view-transition 再次
 * 命中）就继续等；确认结束后在微任务里立即放行第一片，不额外多等一帧。
 * 必须用 isViewTransitionActive() 判断 —— 组件在 startViewTransition 的
 * update 回调内挂载时，tracker 的 activeTransition 可能尚未赋值。
 */
function scheduleVtPoll() {
	if (cancelVtPollFrame !== undefined || vtPending.size === 0) return;
	cancelVtPollFrame = scheduleFrame(() => {
		cancelVtPollFrame = undefined;
		if (vtPending.size === 0) {
			clearVtTimers();
			return;
		}
		if (isViewTransitionActive()) {
			scheduleVtPoll();
			return;
		}
		queueMicrotask(flushVtChunk);
	});
}

/** 兜底强排：伪类状态异常 / rAF 停摆时到点直接开始放行，避免永挂骨架 */
function forceFlushVtPending() {
	if (cancelVtPollFrame !== undefined) {
		cancelVtPollFrame();
		cancelVtPollFrame = undefined;
	}
	if (cancelVtChunkFrame !== undefined) {
		cancelVtChunkFrame();
		cancelVtChunkFrame = undefined;
	}
	flushVtChunk();
}

/** 首次入队时启动：rAF 轮询 + 1500ms 兜底强排（最大值复用 MAX_WAIT_MS） */
function startVtWait() {
	if (cancelVtPollFrame !== undefined) return;
	if (vtFallbackTimer === undefined) {
		vtFallbackTimer = setTimeout(() => {
			vtFallbackTimer = undefined;
			forceFlushVtPending();
		}, MAX_WAIT_MS);
	}
	scheduleVtPoll();
}

/**
 * 等当前 View Transition 结束后提交（多个组件的收尾提交错峰）。
 *
 * - SSR / 无 window → 同步提交，返回空取消函数；
 * - 当前没有 VT（isViewTransitionActive() 为 false）→ 同步提交，与旧行为一致；
 * - VT 进行中 → 入队，rAF 轮询 :active-view-transition 直到动画结束（期间起了
 *   新 VT 就继续等），再按每帧至多 FLUSH_CHUNK_SIZE 个的节奏放行：第一片在
 *   结束后的微任务里立即执行（不增加首条延迟），剩余逐帧排空；1500ms 兜底
 *   强制排空，避免伪类状态异常时内容永远挂在骨架上。
 *
 * 返回取消函数：组件卸载 / 依赖变化时调用，把提交移出队列。
 */
export function commitAfterViewTransition(commit: () => void): () => void {
	if (typeof window === "undefined") {
		commit();
		return () => {};
	}
	if (!isViewTransitionActive()) {
		commit();
		return () => {};
	}

	vtPending.add(commit);
	// 队列由空转非空才需要重新拉起轮询；已在排空中的队列把新提交交给
	// 已排程的分片帧顺带取走即可。
	if (vtPending.size === 1) startVtWait();

	return () => {
		vtPending.delete(commit);
		if (vtPending.size === 0) clearVtTimers();
	};
}
