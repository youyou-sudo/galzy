import { useNavigationPending } from "@web/lib/nav";
import { type CSSProperties, useEffect, useRef } from "react";

/**
 * 顶部全局加载进度条（nprogress 式）。
 *
 * 与右上角的 `RouteLoadingIndicator`（spinner）分工不同：spinner 只回答
 * 「有没有在切页」，这条进度条回答「还要等多久」。两者同时保留：spinner 180ms
 * 先亮，进度条 300ms 才亮，位置互不干扰（顶部 2px vs 右上角）。
 *
 * 时机：
 * - **300ms 内切完就不显示**：预取命中时切页常在 1~2 帧内完成，闪一下反而
 *   像卡了一下；
 * - 超过 300ms 仍未切完 → 淡入，并**用一条长 CSS 过渡**从 0 连续插值到 92%
 *   （真实进度拿不到，所以封顶）；
 * - 页面切换完成 → 把过渡时长换成 220ms 再指向 100%，浏览器从**当前插值位置**
 *   平滑补满，停留 120ms 后淡出、归零复位。
 *
 * 为什么是「一条长过渡」而不是定时器逐帧写 / setInterval 逐段写：
 * - 早期版本用 `setInterval(200ms) + transition 200ms ease-out`，每段都会减速
 *   到停再重新加速，视觉上就是**一顿一顿**的阶梯；
 * - 改成 rAF 逐帧写虽然连续，但导航本身把主线程占住时 rAF 会被推迟，
 *   恰恰在最需要它顺滑的时候卡顿；
 * - 长 `transform` 过渡由合成器插值（配合 `will-change: transform` 提前提升
 *   图层），主线程再忙也不掉帧，且**零逐帧 JS**（对 INP 最友好）。
 *
 * 其它性能约束：
 * - 只动 `transform: scaleX()` 与 `opacity`（合成器属性），不碰 layout / paint；
 * - 组件常驻 DOM、只切样式，避免挂载/卸载开销；
 * - `prefers-reduced-motion` 下不做爬升，停在固定位置直到完成。
 *
 * 兜底：`pending` 若因异常一直不结束（导航被打断 / 失败），10s 后强制收尾，
 * 避免进度条永久停在 92%。
 */

/** 页面切换超过这个时长才亮起；短于它一律不显示。
 * 注意：计时按每次 pending 的**边沿**重开 —— 连续两次快导航各自都 < 300ms 时
 * 累计等待即使超过 300ms 也不显示（有意：预取命中时切页本就该无感）。 */
export const SHOW_DELAY_MS = 300;
/** 爬升过渡总时长：一条连续过渡走完，越长越慢、越像「还在加载」。 */
export const CREEP_MS = 8_000;
/** 爬升终点：导航结束前永远到不了 100%，避免「满了却还没切完」。 */
export const CREEP_CEILING = 0.92;
/** 收尾补满的过渡时长。 */
export const COMPLETE_MS = 220;
/** 补满后停留多久再淡出。 */
export const HOLD_AT_FULL_MS = 120;
/** 淡出时长。 */
export const FADE_MS = 200;
/** pending 长时间不结束时的兜底收尾时长。 */
export const MAX_PENDING_MS = 10_000;
/** 减少动效时的静态位置。 */
export const REDUCED_MOTION_PROGRESS = 0.75;

/** 收尾补满：从当前插值位置平滑指向 100%。 */
const COMPLETE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
/**
 * 爬升缓动：起步稍快、越接近 92% 越慢（指数衰减的近似）。
 * 一条过渡走完，不存在分段减速的台阶。
 */
const CREEP_EASING = "cubic-bezier(0.1, 0.5, 0.25, 1)";

/**
 * 初始内联样式：SSR 首帧就应该是「不可见且零宽」，hydration 后由 ref 接管。
 * 用内联 style 而不是 Tailwind 的 `scale-x-0`：v4 的 scale 走独立的 `scale`
 * 属性，会和运行时的 `transform: scaleX()` 相乘（结果恒为 0）。
 */
const INITIAL_STYLE: CSSProperties = { transform: "scaleX(0)", opacity: 0 };

function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	if (typeof window.matchMedia !== "function") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TopProgressBar() {
	const isPending = useNavigationPending();
	const barRef = useRef<HTMLDivElement>(null);
	/** 当前是否处于「已亮起」状态（真实进度由 CSS 过渡持有，JS 不需要知道） */
	const shownRef = useRef(false);
	const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

	useEffect(() => {
		const bar = barRef.current;
		if (!bar) return;

		const clearTimers = () => {
			for (const id of timersRef.current) clearTimeout(id);
			timersRef.current = [];
		};
		const after = (ms: number, run: () => void) => {
			timersRef.current.push(setTimeout(run, ms));
		};
		/** 只写 transform / opacity：合成器属性，不触发 layout 与 React 渲染 */
		const paint = (value: number, opacity: number) => {
			bar.style.transform = `scaleX(${value})`;
			bar.style.opacity = String(opacity);
		};
		/** 归零复位：先关过渡再改值，避免「倒着缩回去」被看见 */
		const reset = () => {
			shownRef.current = false;
			bar.style.transition = "none";
			bar.style.willChange = "";
			paint(0, 0);
		};
		/** 补满 → 停留 → 淡出 → 复位 */
		const finish = () => {
			clearTimers();
			if (!shownRef.current) return;
			// 换一条短过渡并指向 100%：浏览器以「当前插值值」为起点重新插值，
			// 不会跳、也不会从 0 重来。
			bar.style.transition = `transform ${COMPLETE_MS}ms ${COMPLETE_EASING}, opacity ${FADE_MS}ms ease-out`;
			paint(1, 1);
			after(COMPLETE_MS + HOLD_AT_FULL_MS, () => {
				paint(1, 0);
				after(FADE_MS, reset);
			});
		};

		if (!isPending) {
			finish();
			return clearTimers;
		}

		// 新导航从头开始：清掉上一轮的定时器与残留进度
		clearTimers();
		reset();

		after(SHOW_DELAY_MS, () => {
			shownRef.current = true;
			if (prefersReducedMotion()) {
				bar.style.transition = `opacity ${FADE_MS}ms ease-out`;
				paint(REDUCED_MOTION_PROGRESS, 1);
				return;
			}
			// 关键：一条长过渡 = 一次合成器插值。没有逐帧 JS，也没有分段减速。
			bar.style.willChange = "transform";
			bar.style.transition = `transform ${CREEP_MS}ms ${CREEP_EASING}, opacity ${FADE_MS}ms ease-out`;
			paint(CREEP_CEILING, 1);
		});
		after(MAX_PENDING_MS, finish);

		return clearTimers;
	}, [isPending]);

	return (
		<div
			aria-hidden="true"
			// z-[60]：高于顶栏(50)与移动端覆盖层(40)，也高于弹窗遮罩(50) ——
			// 这是页面级全局状态，弹窗打开时仍应可见（与右下 spinner 刻意压在遮罩下不同）。
			className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden pointer-events-none"
		>
			<div
				ref={barRef}
				data-top-progress=""
				style={INITIAL_STYLE}
				className="h-full origin-left bg-primary"
			/>
		</div>
	);
}
