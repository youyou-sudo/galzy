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
 */

/** 滚动静默判定窗口：该时长内无新 scroll 事件视为滚动结束 */
const SCROLL_SETTLE_MS = 180;
/** 门控未解除时的重试间隔（setTimeout 链式自排） */
const FLUSH_RETRY_MS = 80;
/** 兜底强刷上限：防止任何状态机死角导致图片永不揭示 */
const MAX_WAIT_MS = 1500;

let scrolling = false;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
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

/** 无条件强制 flush：不走门控判断，供兜底定时器使用 */
function forceFlushPending() {
	if (pending.size === 0) return;
	clearFlushTimers();
	const batch = [...pending];
	pending.clear();
	for (const commit of batch) commit();
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
 *   检查保证不提交过期状态。
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
		maxWaitTimer = setTimeout(forceFlushPending, MAX_WAIT_MS);
	}

	return () => {
		pending.delete(commit);
		if (pending.size === 0) clearFlushTimers();
	};
}
