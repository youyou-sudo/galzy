let activeTransition: ViewTransition | undefined;
let installed = false;

/**
 * 包一层 document.startViewTransition，记录最近一次 View Transition 的句柄。
 * TanStack Router 的 defaultViewTransition 在路由跳转（含弹窗 pushState 引发的
 * 同 URL history 变更）时内部调用它，外部拿不到返回的句柄，这里补上。
 */
export function installViewTransitionTracker() {
	if (typeof document === "undefined" || installed) return;
	if (typeof document.startViewTransition !== "function") return;
	installed = true;

	const original = document.startViewTransition.bind(document);
	document.startViewTransition = ((callback?: ViewTransitionUpdateCallback) => {
		const transition = original(callback);
		activeTransition = transition;

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
