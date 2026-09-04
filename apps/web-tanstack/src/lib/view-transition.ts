let activeTransition: ViewTransition | undefined;
let installed = false;

/** 共享元素通过内联 style={{ viewTransitionName }} 声明，用属性选择器定位 */
const SHARED_ELEMENT_SELECTOR = '[style*="view-transition-name"]';

/** 收集当前页面所有共享元素（view-transition-name）的视口 rect，按名字索引 */
function captureSharedElementRects() {
	const rects = new Map<string, DOMRect>();
	for (const el of document.querySelectorAll<HTMLElement>(SHARED_ELEMENT_SELECTOR)) {
		const name = el.style.viewTransitionName;
		if (name) rects.set(name, el.getBoundingClientRect());
	}
	return rects;
}

/** 在新 DOM 中按名字定位共享元素（用于测量「飞入」目标位置） */
function findSharedElement(name: string) {
	for (const el of document.querySelectorAll<HTMLElement>(SHARED_ELEMENT_SELECTOR)) {
		if (el.style.viewTransitionName === name) return el;
	}
	return null;
}

/**
 * 把 UA 注入的 ::view-transition-group 动画改为 compositor-only。
 *
 * 浏览器生成的默认关键帧（-ua-view-transition-group-anim-*）同时插值
 * width/height 与 transform：width/height 参与动画会被 Blink 判定为主线程
 * 动画（每帧 layout，~60Hz）。这里用 WAAPI 改写每组关键帧：
 *   - 删除所有 width/height；
 *   - 共享元素（非 root）的尺寸变化折算进 from 关键帧的 transform scale，
 *     位移用显式 translate 表达（基准 transform-origin: 0 0，见 styles.css）：
 *       from: translate(旧位置) scale(旧尺寸/新尺寸) —— 视觉上=旧盒子
 *       to:   translate(新位置) —— 视觉上=新盒子的自然位置
 * 改写后动画只剩 transform（+opacity），跑在合成器线程（120/144Hz）。
 */
function makeGroupAnimationsCompositorOnly(oldRects: Map<string, DOMRect>) {
	for (const animation of document.getAnimations()) {
		const effect = animation.effect as KeyframeEffect | null;
		if (!effect?.pseudoElement) continue;
		const match = /^::view-transition-group\((.+)\)$/.exec(effect.pseudoElement);
		if (!match) continue;

		const keyframes = effect.getKeyframes();
		if (keyframes.length === 0) continue;

		for (const frame of keyframes) {
			delete frame.width;
			delete frame.height;
		}

		const name = match[1];
		if (name !== "root") {
			const from = oldRects.get(name);
			const newElement = findSharedElement(name);
			if (from && newElement) {
				const to = newElement.getBoundingClientRect();
				keyframes[0].transform = `translate(${from.left}px, ${from.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
				keyframes[keyframes.length - 1].transform = `translate(${to.left}px, ${to.top}px)`;
			}
		}

		effect.setKeyframes(keyframes);
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
		const oldRects = captureSharedElementRects();
		const transition = original(callback);
		activeTransition = transition;

		// 新 DOM 就绪（快照已生成）后改写 group 关键帧；跳过/取消时忽略
		transition.ready
			.then(() => makeGroupAnimationsCompositorOnly(oldRects))
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
