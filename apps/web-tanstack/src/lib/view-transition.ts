let activeTransition: ViewTransition | undefined;
let installed = false;

/**
 * 把 UA 生成的 ::view-transition-group 关键帧改写为 compositor-only（纯函数）。
 *
 * 浏览器生成的默认关键帧（-ua-view-transition-group-anim-*，见 spec §3.9.5）
 * 只有 from 块：transform/width/height 是旧盒子的几何，终点值来自 group 的
 * 内联样式（新盒子）。width/height 参与动画会被 Blink 判定为主线程动画
 * （每帧 layout，~60Hz）。改写：
 *   - 删除所有 width/height；
 *   - 共享元素（非 root）且尺寸变化时，把尺寸 morph 折算成 scale 追加到
 *     from 的 transform 末尾（transform-origin: 0 0，见 styles.css，缩放
 *     围绕左上角，等价于 UA 默认的 width/height 插值）：
 *       from: translate(旧位置) scale(旧尺寸/新尺寸)
 *   - 删除 to 关键帧的 transform，让终点回落到浏览器自己计算的内联
 *     transform —— 末帧位置由浏览器保证，不依赖外部 rect 测量（滚动恢复、
 *     移动端 URL 栏收展导致测量与快照坐标系漂移时不会错位）。
 * 改写后动画只剩 transform/opacity，跑在合成器线程（120/144Hz）。
 */
export function makeGroupCompositorKeyframes(
	keyframes: Keyframe[],
	name: string,
): Keyframe[] {
	if (keyframes.length === 0) return keyframes;

	const from = keyframes[0];
	const to = keyframes[keyframes.length - 1];

	// from/to 关键帧自带旧/新尺寸（浏览器生成），尺寸 morph 折算成 scale
	const oldWidth = Number.parseFloat(String(from.width ?? ""));
	const oldHeight = Number.parseFloat(String(from.height ?? ""));
	const newWidth = Number.parseFloat(String(to.width ?? ""));
	const newHeight = Number.parseFloat(String(to.height ?? ""));
	const sizesChanged =
		name !== "root" &&
		Number.isFinite(oldWidth) &&
		Number.isFinite(oldHeight) &&
		Number.isFinite(newWidth) &&
		Number.isFinite(newHeight) &&
		oldWidth !== newWidth &&
		oldHeight !== newHeight;

	if (sizesChanged) {
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

/** 遍历当前活动的 VT group 动画，逐个改写为 compositor-only */
function makeGroupAnimationsCompositorOnly() {
	for (const animation of document.getAnimations()) {
		const effect = animation.effect as KeyframeEffect | null;
		if (!effect?.pseudoElement) continue;
		const match = /^::view-transition-group\((.+)\)$/.exec(effect.pseudoElement);
		if (!match) continue;

		const keyframes = effect.getKeyframes();
		if (keyframes.length === 0) continue;

		effect.setKeyframes(makeGroupCompositorKeyframes(keyframes, match[1]));
	}
}

/**
 * 包一层 document.startViewTransition，记录最近一次 View Transition 的句柄。
 * TanStack Router 的 defaultViewTransition 在路由跳转（含弹窗 pushState 引发的
 * 同 URL history 变更）时内部调用它，外部拿不到返回的句柄，这里补上。
 * 同时把 group 动画改写为 compositor-only（见 makeGroupAnimationsCompositorOnly）。
 */
export function installViewTransitionTracker() {
	if (typeof document === "undefined" || installed) return;
	if (typeof document.startViewTransition !== "function") return;
	installed = true;

	const original = document.startViewTransition.bind(document);
	document.startViewTransition = ((callback?: ViewTransitionUpdateCallback) => {
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
