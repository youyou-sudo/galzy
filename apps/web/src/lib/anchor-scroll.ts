/**
 * 缓慢滚动定位：把元素滚进视口（攻略页签的锚定、封面下方的「下载」按钮都用它）。
 *
 * 为什么不用 `scrollIntoView({ behavior: "smooth" })`：
 * - 原生 smooth 的时长与曲线由浏览器决定（几百毫秒、随距离变化），拿不到
 *   「不管多远都慢慢滑过去」这个稳定手感，所以这里按帧插值自己算；
 * - 原生 smooth 在开始的一刻就把终点算死。攻略页签上方还有客户端异步内容
 *   （作品概览的标签卡），数据在动画期间到达会把锚点往下推，原生会停回旧位置；
 *   这里每帧重算终点，落点跟着元素走。
 *
 * 对齐方式与 `scrollIntoView` 一致，各取所需：
 * - `scrollElementToTop` = `block: "start"`：让位 `html { scroll-padding-top }`
 *   （固定顶栏 + 余量），元素不会滚到顶栏底下；
 * - `scrollElementToCenter` = `block: "center"`：「下载」按钮定位文件列表时用，
 *   居中不需要让位顶栏。
 * 两者的终点都夹到文档可滚范围 —— 内容不够长时就是「尽量靠上 / 居中」。
 */

/** 动画时长（ms）：比原生 smooth 慢一档，能看清是滑过去而不是跳过去。 */
const DEFAULT_DURATION_MS = 720;

/** easeInOutCubic：两头收得住、中途最快，落点不急停 */
function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	if (typeof window.matchMedia !== "function") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** html 上 scroll-padding-top 的解析值（calc/var 在 getComputedStyle 里已是 px） */
export function scrollPaddingTop(): number {
	if (typeof window === "undefined") return 0;
	const parsed = Number.parseFloat(
		window.getComputedStyle(document.documentElement).scrollPaddingTop,
	);
	return Number.isFinite(parsed) ? parsed : 0;
}

/** 文档能滚到的最大 top；布局还没算完（scrollHeight 为 0）时不当作上限 */
function maxScrollTop(): number {
	return Math.max(
		0,
		document.documentElement.scrollHeight - window.innerHeight,
	);
}

/** 夹到文档可滚范围；内容不够长时就是「尽量靠上 / 居中」 */
function clampScrollTop(top: number): number {
	const floor = Math.max(top, 0);
	const max = maxScrollTop();
	return max > 0 ? Math.min(floor, max) : floor;
}

/**
 * 元素顶边对齐（block:start）对应的文档滚动位置：扣掉 scroll-padding-top，
 * 并夹到可滚范围。单独导出给单测直接断言几何，不必驱动整段动画。
 */
export function anchorScrollTop(
	el: Element,
	paddingTop = scrollPaddingTop(),
): number {
	const top = el.getBoundingClientRect().top + window.scrollY - paddingTop;
	return clampScrollTop(top);
}

/** 元素中线对齐（block:center）对应的文档滚动位置，同样夹到可滚范围 */
export function centerScrollTop(el: Element): number {
	const rect = el.getBoundingClientRect();
	const top =
		rect.top + window.scrollY - (window.innerHeight - rect.height) / 2;
	return clampScrollTop(top);
}

function scrollTopTo(top: number): void {
	// 显式 instant：逐帧写入不能被 `html { scroll-behavior: smooth }` 再平滑一次
	window.scrollTo({ top, behavior: "instant" });
}

/** 取消函数：提前结束动画（重新锚定 / 卸载 / 取消导航时调用） */
export type AnchorScroll = () => void;

/**
 * 缓慢把元素滚到 `targetTop(el)` 算出的位置，返回取消函数。
 * prefers-reduced-motion 命中或时长 <= 0 时退化成瞬时定位。
 */
function animateScroll(
	el: Element,
	targetTop: (el: Element) => number,
	duration: number,
): AnchorScroll {
	if (typeof window === "undefined") return () => {};
	if (prefersReducedMotion() || duration <= 0) {
		scrollTopTo(targetTop(el));
		return () => {};
	}

	let frame = 0;
	/**
	 * 起点位置与起点时间都取首帧，不在调用时取：
	 * 父级 layout effect（例如 furin 恢复历史位置）可能排在这里之后执行，
	 * 调用时读到的 scrollY 会在首帧前被它改掉。
	 */
	let originY: number | null = null;
	let originTime = 0;
	let stopped = false;

	function detach() {
		window.removeEventListener("wheel", stop);
		window.removeEventListener("touchstart", stop);
		window.removeEventListener("keydown", stop);
	}

	function stop() {
		if (stopped) return;
		stopped = true;
		if (frame) window.cancelAnimationFrame(frame);
		frame = 0;
		detach();
	}

	function tick(now: number) {
		if (stopped) return;
		if (!el.isConnected) {
			stop();
			return;
		}
		if (originY === null) {
			originY = window.scrollY;
			originTime = now;
			// 已经到位就别演一遍空动画
			if (Math.abs(targetTop(el) - originY) < 1) {
				stop();
				return;
			}
		}
		const t = Math.min(1, (now - originTime) / duration);
		// 终点每帧重算：动画期间上方内容长高/变矮，落点跟着锚点走
		const end = targetTop(el);
		if (t < 1) {
			scrollTopTo(originY + (end - originY) * easeInOutCubic(t));
			frame = window.requestAnimationFrame(tick);
			return;
		}
		// 最后一帧按当前锚点精确落位（渲染取整不会留下 1px 缝）
		scrollTopTo(end);
		stop();
	}

	// 用户中途自己滚：立刻让位，不跟用户抢
	window.addEventListener("wheel", stop, { passive: true });
	window.addEventListener("touchstart", stop, { passive: true });
	window.addEventListener("keydown", stop);
	frame = window.requestAnimationFrame(tick);
	return stop;
}

/** 缓慢把元素顶边滚到视口顶部（block:start，让位固定顶栏） */
export function scrollElementToTop(
	el: Element,
	{ duration = DEFAULT_DURATION_MS }: { duration?: number } = {},
): AnchorScroll {
	return animateScroll(el, anchorScrollTop, duration);
}

/** 缓慢把元素滚到视口正中（block:center） */
export function scrollElementToCenter(
	el: Element,
	{ duration = DEFAULT_DURATION_MS }: { duration?: number } = {},
): AnchorScroll {
	return animateScroll(el, centerScrollTop, duration);
}
