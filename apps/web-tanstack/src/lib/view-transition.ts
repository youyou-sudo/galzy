let activeTransition: ViewTransition | undefined;
let installed = false;

/**
 * 把 UA 生成的 ::view-transition-group 关键帧改写为 compositor-only（纯函数）。
 *
 * UA 关键帧存在两种形态：
 * 1. 新版 Chrome：width/height 已被浏览器折算进 from 的 transform scale，
 *    关键帧不含 width/height —— 本函数不追加 scale（防止双重缩放）；
 * 2. 旧版 Chrome：from 只有位移 transform，尺寸 morph 由 width/height 承担，
 *    （且隐式 to 关键帧的 width/height 可能携带错误值）。这里删除所有
 *    width/height，把尺寸变化折算成 scale 追加到 from 的 transform 末尾
 *    （transform-origin: 0 0，见 styles.css，缩放围绕左上角，等价于 UA
 *    默认的 width/height 插值）：
 *      from: translate(旧位置) scale(旧尺寸/新尺寸)
 *    newWidth/newHeight 来自新元素实测 getBoundingClientRect（尺寸与
 *    滚动位置、移动端 URL 栏收展无关，不会像位置测量那样漂移）。
 *
 * 删除 to 关键帧的 transform，让终点回落到浏览器自己计算的内联
 * transform —— 末帧位置由浏览器保证。
 *
 * 改写后动画只剩 transform/opacity，跑在合成器线程（120/144Hz）。
 */
export function makeGroupCompositorKeyframes(
	keyframes: Keyframe[],
	name: string,
	newWidth = 0,
	newHeight = 0,
): Keyframe[] {
	if (keyframes.length === 0) return keyframes;

	const from = keyframes[0];
	const to = keyframes[keyframes.length - 1];

	// 仅旧版 UA 形态（from 携带 width/height）需要补 scale
	const oldWidth = Number.parseFloat(String(from.width ?? ""));
	const oldHeight = Number.parseFloat(String(from.height ?? ""));
	const needsSizeMorph =
		name !== "root" &&
		Number.isFinite(oldWidth) &&
		Number.isFinite(oldHeight) &&
		newWidth > 0 &&
		newHeight > 0 &&
		(oldWidth !== newWidth || oldHeight !== newHeight);

	if (needsSizeMorph) {
		from.transform = `${String(from.transform ?? "")} scale(${oldWidth / newWidth}, ${oldHeight / newHeight})`;
	}

	for (const frame of keyframes) {
		delete frame.width;
		delete frame.height;
	}
	// 终点回落到浏览器自己的内联 transform（见函数注释）
	delete to.transform;

	return keyframes;
}

/**
 * 单次 DOM 扫描建表：group 数量随列表页数线性增长时，
 * 逐 group 全量 querySelectorAll 是 O(Groups × DOM) 的二次方扫描，
 * 正好落在导航动画启动瞬间（去/回各一次）。这里一次建 Map，
 * 整体降为 O(Groups + DOM)。
 */
export const MAX_REWRITE_GROUPS = 64;

function collectSharedRects() {
	const rects = new Map<
		string,
		{ width: number; height: number; text: boolean }
	>();
	for (const el of document.querySelectorAll<HTMLElement>(
		'[style*="view-transition-name"]',
	)) {
		const name = el.style.viewTransitionName;
		if (!name || rects.has(name)) continue;
		const rect = el.getBoundingClientRect();
		// 标记文字类共享元素（挂了 view-transition-class）：它们交由
		// object-fit: contain 保持等比，不做 compositor 改写
		const text = Boolean(
			(el.style as CSSStyleDeclaration & { viewTransitionClass?: string })
				.viewTransitionClass,
		);
		rects.set(name, { width: rect.width, height: rect.height, text });
	}
	return rects;
}

/** 遍历当前活动的 VT group 动画，逐个改写为 compositor-only */
function makeGroupAnimationsCompositorOnly() {
	const groups: Array<{ animation: Animation; name: string }> = [];
	for (const animation of document.getAnimations()) {
		const effect = animation.effect as KeyframeEffect | null;
		if (!effect?.pseudoElement) continue;
		const match = /^::view-transition-group\((.+)\)$/.exec(
			effect.pseudoElement,
		);
		if (!match) continue;
		groups.push({ animation, name: match[1] });
	}
	if (groups.length === 0) return;

	// 非 root group 需要实测新尺寸才做 DOM 扫描；且只扫一次
	const needsMeasure = groups.some(({ name }) => name !== "root");
	const rects = needsMeasure ? collectSharedRects() : null;

	let rewritten = 0;
	for (const { animation, name } of groups) {
		if (rewritten >= MAX_REWRITE_GROUPS) break;
		const effect = animation.effect as KeyframeEffect | null;
		if (!effect) continue;
		const keyframes = effect.getKeyframes();
		if (keyframes.length === 0) continue;

		const rect = rects?.get(name);
		// 文字类共享元素：两端宽高比通常不同，compositor 改写会把宽/高
		// 折算成非等比 scale，把文字快照拉伸变形。保留原生 width/height
		// 动画，配合 CSS 的 object-fit: contain 让文字始终等比缩放。
		if (rect?.text) continue;
		effect.setKeyframes(
			makeGroupCompositorKeyframes(
				keyframes,
				name,
				rect?.width ?? 0,
				rect?.height ?? 0,
			),
		);
		rewritten++;
	}
}

/**
 * 包一层 document.startViewTransition，记录最近一次 View Transition 的句柄。
 * TanStack Router 的 defaultViewTransition 在路由跳转（含弹窗 pushState 引发的
 * 同 URL history 变更）时内部调用它，外部拿不到返回的句柄，这里补上。
 *
 * 关键机制：新一次导航（返回/前进/动画未结束再次点击）开始前，先把上一场还在
 * 播的过渡立即 skipTransition —— 否则连续操作会被前一场动画排队/盖住，产生
 * 「顿」「不跟手」的观感。由此动画永不阻塞下一次交互。
 * 同时把 group 动画改写为 compositor-only（见 makeGroupAnimationsCompositorOnly）。
 */
export function installViewTransitionTracker() {
	if (typeof document === "undefined" || installed) return;
	if (typeof document.startViewTransition !== "function") return;
	installed = true;

	const original = document.startViewTransition.bind(document);
	document.startViewTransition = ((callback?: ViewTransitionUpdateCallback) => {
		// 新导航开始时立刻终结上一场过渡：返回/快速点击在动画中途也能秒响应。
		// skipTransition 会 reject 旧的 ready/finished，被下方预消化 promise 吸收。
		skipActiveViewTransition();

		const transition = original(callback);
		activeTransition = transition;

		// 新 DOM 就绪（快照已生成）后改写 group 关键帧为 compositor-only；
		// 跳过/取消时忽略
		transition.ready
			.then(() => makeGroupAnimationsCompositorOnly())
			.catch(() => {});

		// skipTransition() 会 reject ready/finished，而 TanStack Router 内部
		// 直接 await 它们，会产生 Uncaught (in promise)；这里用预消化的
		// promise 覆盖实例属性，使所有引用方都不会看到 rejection
		const swallowed = {
			ready: transition.ready.catch(() => {}),
			finished: transition.finished.catch(() => {}),
		};
		try {
			Object.defineProperty(transition, "ready", { value: swallowed.ready });
			Object.defineProperty(transition, "finished", {
				value: swallowed.finished,
			});
		} catch {
			// 属性不可覆盖时保持原样
		}
		swallowed.finished.then(() => {
			if (activeTransition === transition) {
				activeTransition = undefined;
			}
		});

		return transition;
	}) as typeof document.startViewTransition;
}

/**
 * 立即跳过正在进行的 View Transition。
 *
 * 修复的 bug：条目页上弹窗打开的瞬间，标题/封面不被模糊与暗色遮罩盖住。
 * 原因：弹窗打开时若路由 View Transition 仍在进行（路由 VT 会等异步 loader
 * 完成才启动），且弹窗的 pushState 又会触发一次同 URL 的新 VT——此时标题/封面
 * 被抽成 ::view-transition 伪元素快照、root 快照在原位置留下空洞，遮罩无法
 * 覆盖这些快照，产生一瞬间的「漏出」。跳过 VT 后这些伪元素立即移除，
 * 页面回到真实 DOM，弹窗遮罩正常覆盖全部内容。
 */
export function skipActiveViewTransition() {
	if (typeof document === "undefined") return;
	try {
		activeTransition?.skipTransition();
	} catch {
		// transition 可能已结束，忽略
	}
}

/**
 * 最近一次仍在进行/刚结束的 View Transition 句柄（含路由层发起的 POP 过渡）。
 * 供调用方在过渡结束后再做滚动校正/清理等收尾 —— 过渡进行中任何对共享元素
 * 位置或滚动位置的改动都会让动画中途跳变。
 */
export function getActiveViewTransition(): ViewTransition | undefined {
	return activeTransition;
}

/**
 * 等待当前 View Transition 结束（并多跑一帧确认没有被同帧新过渡接管）。
 * 用于「过渡结束后的收尾」：虚拟列表的恢复滚动/校正若在动画中途执行，
 * 会与快照伪元素的位置产生肉眼可见的跳变，等结束再做最稳。
 */
export function waitForViewTransitionEnd(): Promise<void> {
	if (typeof document === "undefined") return Promise.resolve();
	const transition = activeTransition;
	if (!transition) return Promise.resolve();
	// finished 已被 tracker 预消化（不 reject），直接 await 安全
	return transition.finished.then(() => {
		return new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
	});
}

/**
 * 弹窗开关时调用：先跳过当前可能还在跑的路由 VT；
 * pushState 引发的新 VT 要到下一帧才创建，再用连续两帧 rAF 兜底跳过。
 */
export function skipViewTransitionsForModal() {
	skipActiveViewTransition();
	requestAnimationFrame(() => {
		skipActiveViewTransition();
		requestAnimationFrame(() => {
			skipActiveViewTransition();
		});
	});
}
