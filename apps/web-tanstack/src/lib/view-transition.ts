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

/** 在新 DOM 中按名字定位共享元素（仅用于测量尺寸，位置不依赖测量） */
function findSharedElement(name: string) {
	for (const el of document.querySelectorAll<HTMLElement>('[style*="view-transition-name"]')) {
		if (el.style.viewTransitionName === name) return el;
	}
	return null;
}

/** 遍历当前活动的 VT group 动画，逐个改写为 compositor-only */
function makeGroupAnimationsCompositorOnly() {
	for (const animation of document.getAnimations()) {
		const effect = animation.effect as KeyframeEffect | null;
		if (!effect?.pseudoElement) continue;
		const match = /^::view-transition-group\((.+)\)$/.exec(effect.pseudoElement);
		if (!match) continue;

		const keyframes = effect.getKeyframes();
		if (keyframes.length === 0) continue;

		const name = match[1];
		let newWidth = 0;
		let newHeight = 0;
		if (name !== "root") {
			const rect = findSharedElement(name)?.getBoundingClientRect();
			if (rect) {
				newWidth = rect.width;
				newHeight = rect.height;
			}
		}

		effect.setKeyframes(
			makeGroupCompositorKeyframes(keyframes, name, newWidth, newHeight),
		);
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
