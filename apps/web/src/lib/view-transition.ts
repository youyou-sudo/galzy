let activeTransition: ViewTransition | undefined;
let installed = false;

let vtClassSupport: boolean | undefined;
let vtClassPropertySupport: boolean | undefined;

/**
 * view-transition-class（Chrome/WebView 125+）特性检测，模块级惰性缓存。
 * 111–124 上该 API 缺失：`.vt-text` 等选择器不匹配、style.viewTransitionClass
 * 读不到 —— 文本共享元素的等比保护全部失效，rect.text 判定需走名称兜底。
 */
export function supportsViewTransitionClass(): boolean {
	if (vtClassSupport !== undefined) return vtClassSupport;
	try {
		vtClassSupport =
			typeof CSS !== "undefined" &&
			typeof CSS.supports === "function" &&
			CSS.supports("selector(::view-transition-group(.a))");
	} catch {
		vtClassSupport = false;
	}
	return vtClassSupport;
}

/**
 * view-transition-class 属性本体检测，严格镜像 styles.css 的
 * `@supports not (view-transition-class: x)`。
 * 与 supportsViewTransitionClass() 严格区分：后者测伪元素选择器写法（决定 JS
 * 能否读到 style.viewTransitionClass），这里测属性本体（决定 CSS @supports
 * 是否命中）。模块级惰性缓存。
 */
function supportsViewTransitionClassProperty(): boolean {
	if (vtClassPropertySupport !== undefined) return vtClassPropertySupport;
	try {
		vtClassPropertySupport =
			typeof CSS !== "undefined" &&
			typeof CSS.supports === "function" &&
			CSS.supports("view-transition-class", "x");
	} catch {
		vtClassPropertySupport = false;
	}
	return vtClassPropertySupport;
}

/**
 * group 改写短路的判定输入。styles.css 里两条媒体分支会让 UA group 动画被
 * CSS 完全覆盖：
 * 1. `@media (pointer: coarse)` 且 `@supports not (view-transition-class: x)`：
 *    `::view-transition-group(*)` 被替换为 galzy-vt-group-fade（纯 opacity），
 *    root 无动画；
 * 2. `@media (prefers-reduced-motion: reduce)`：所有 group duration 0s，
 *    old/new animation: none。
 * 命中时 width/height 插值根本不会跑，改写只是白付一次
 * getAnimations + DOM 扫描 + setKeyframes。
 */
export interface GroupRewriteSignals {
	coarsePointer: boolean;
	viewTransitionClassSupported: boolean;
	reducedMotion: boolean;
}

/** matchMedia 查询；SSR/测试（node）无 matchMedia 时不抛错，保守返回 false */
function mediaQueryMatches(query: string): boolean {
	try {
		const matcher = (globalThis as { matchMedia?: unknown }).matchMedia;
		if (typeof matcher !== "function") return false;
		const list = (matcher as (q: string) => MediaQueryList | null).call(
			globalThis,
			query,
		);
		return Boolean(list?.matches);
	} catch {
		return false;
	}
}

/** 采集 styles.css 两条短路分支的判定输入（SSR/测试环境全部为 false） */
export function readGroupRewriteSignals(): GroupRewriteSignals {
	return {
		coarsePointer: mediaQueryMatches("(pointer: coarse)"),
		viewTransitionClassSupported: supportsViewTransitionClassProperty(),
		reducedMotion: mediaQueryMatches("(prefers-reduced-motion: reduce)"),
	};
}

/** 是否整体跳过 group 改写（纯函数，便于单测） */
export function shouldSkipGroupRewrite({
	coarsePointer,
	viewTransitionClassSupported,
	reducedMotion,
}: GroupRewriteSignals): boolean {
	// reduced-motion：所有 group duration 0s、old/new animation: none，
	// 动画根本不播放，改写关键帧没有意义。
	if (reducedMotion) return true;
	// 触屏 + 不支持 view-transition-class（styles.css 的 @supports not 分支）：
	// width/height 已被纯 opacity 关键帧覆盖，改写同样没有收益。
	return coarsePointer && !viewTransitionClassSupported;
}

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

/** 单次改写上限：group 爆炸时导航动画改写有界，避免主线程长任务 */
export const MAX_REWRITE_GROUPS = 64;

/**
 * 兜底路径：单次 DOM 属性扫描建 name → 元素索引（不测量尺寸）。
 * group 数量随列表页数线性增长时，逐 group 全量 querySelectorAll 是
 * O(Groups × DOM) 的二次方扫描，正好落在导航动画启动瞬间（去/回各一次）。
 * 这里一次建 Map，整体降为 O(Groups + DOM)；尺寸由调用方按需测量 ——
 * 新版 UA 形态已把尺寸折进 transform，根本不需要 getBoundingClientRect。
 */
function collectSharedElements(doc: Document): Map<string, HTMLElement> {
	const elements = new Map<string, HTMLElement>();
	for (const el of doc.querySelectorAll<HTMLElement>(
		'[style*="view-transition-name"]',
	)) {
		const name = el.style.viewTransitionName;
		if (!name || elements.has(name)) continue;
		elements.set(name, el);
	}
	return elements;
}

/** 从 getAnimations() 里挑出当前活动的 ::view-transition-group(name) 动画 */
function collectGroupAnimations(
	doc: Document,
): Array<{ effect: KeyframeEffect; name: string }> {
	const groups: Array<{ effect: KeyframeEffect; name: string }> = [];
	for (const animation of doc.getAnimations()) {
		const effect = animation.effect as KeyframeEffect | null;
		if (!effect?.pseudoElement) continue;
		const match = /^::view-transition-group\((.+)\)$/.exec(
			effect.pseudoElement,
		);
		if (!match) continue;
		groups.push({ effect, name: match[1] });
	}
	return groups;
}

/**
 * 快速路径：UA 对 group 动画的 effect.target 有时直接指向共享元素本体，
 * 命中时可完全跳过全 DOM 属性扫描。用鸭子类型（style 对象）而非
 * instanceof Element —— node/SSR 环境没有 DOM 构造器。
 */
function sharedElementFromEffect(
	effect: KeyframeEffect,
	name: string,
): HTMLElement | undefined {
	const target = effect.target as unknown;
	if (!target || typeof target !== "object") return undefined;
	const style = (target as { style?: unknown }).style;
	if (!style || typeof style !== "object") return undefined;
	if ((style as CSSStyleDeclaration).viewTransitionName !== name) {
		return undefined;
	}
	return target as HTMLElement;
}

/**
 * 文字类共享元素判定（只读 style，不需要布局测量）。
 * 挂了 view-transition-class 的是文本（标题/昵称/厂商名），交由 CSS 的
 * object-fit: scale-down 保持等比；API 缺失（<125）时 viewTransitionClass
 * 读不到，按名称兜底：game-title-<id>、topic-nick-<id>、producer-name-<pid>…
 */
function isTextSharedElement(el: HTMLElement, name: string): boolean {
	if (!supportsViewTransitionClass()) return /-(?:title|nick|name)-/.test(name);
	return Boolean(
		(el.style as CSSStyleDeclaration & { viewTransitionClass?: string })
			.viewTransitionClass,
	);
}

/**
 * 关键帧是否还需要实测新尺寸：只有旧版 UA 形态（from 携带可解析
 * width/height）且非 root group 才需要。新版 UA 已把尺寸折算进
 * transform scale，按 0 尺寸改写即可（见 makeGroupCompositorKeyframes）。
 */
function keyframesNeedMeasuredSize(
	keyframes: Keyframe[],
	name: string,
): boolean {
	if (name === "root") return false;
	const from = keyframes[0];
	if (!from) return false;
	const oldWidth = Number.parseFloat(String(from.width ?? ""));
	const oldHeight = Number.parseFloat(String(from.height ?? ""));
	return Number.isFinite(oldWidth) && Number.isFinite(oldHeight);
}

let rewriteFailureWarned = false;

/**
 * 遍历当前活动的 VT group 动画，逐个改写为 compositor-only。
 * doc/signals 可注入，便于在 node 环境单测（无需 jsdom）。
 */
export function rewriteGroupAnimations(
	doc: Document,
	signals: GroupRewriteSignals = readGroupRewriteSignals(),
): void {
	// styles.css 已把 UA group 动画整体覆盖（触屏旧 WebView 纯淡入 /
	// reduced-motion 0s）时直接短路，连 getAnimations 都不必调用。
	if (shouldSkipGroupRewrite(signals)) return;

	const groups = collectGroupAnimations(doc);
	if (groups.length === 0) return;

	// 兜底扫描惰性建表：只有快速路径落空才付全 DOM 扫描成本
	let sharedElements: Map<string, HTMLElement> | undefined;
	const lookupElement = (name: string): HTMLElement | undefined => {
		sharedElements ??= collectSharedElements(doc);
		return sharedElements.get(name);
	};

	let rewritten = 0;
	for (const { effect, name } of groups) {
		if (rewritten >= MAX_REWRITE_GROUPS) break;
		const keyframes = effect.getKeyframes();
		if (keyframes.length === 0) continue;

		// root group 既不改写 scale 也不可能是文字类，无需解析元素
		const el =
			name === "root"
				? undefined
				: (sharedElementFromEffect(effect, name) ?? lookupElement(name));

		// 文字类共享元素：两端宽高比通常不同，compositor 改写会把宽/高
		// 折算成非等比 scale，把文字快照拉伸变形。保留原生 width/height
		// 动画，配合 CSS 的 object-fit: scale-down 让文字始终等比缩放。
		// 判定只读 style，不触发布局测量。
		if (el && isTextSharedElement(el, name)) continue;

		// 惰性测量：只有旧版 UA 形态才需要新尺寸折算 scale；
		// 新版 UA 已在 transform 里，测量纯属浪费。
		let width = 0;
		let height = 0;
		if (el && keyframesNeedMeasuredSize(keyframes, name)) {
			const rect = el.getBoundingClientRect();
			width = rect.width;
			height = rect.height;
		}

		try {
			effect.setKeyframes(
				makeGroupCompositorKeyframes(keyframes, name, width, height),
			);
			rewritten++;
		} catch (error) {
			// setKeyframes 失败时保留 UA 的 width/height 主线程动画（掉帧回退）
			// 而不是让整场改写静默中断；会话内只上报一次避免刷屏。
			if (!rewriteFailureWarned) {
				rewriteFailureWarned = true;
				console.warn(
					"[view-transition] group 关键帧改写失败，保留 UA 动画回退（后续失败不再重复上报）",
					error,
				);
			}
		}
	}
}

/** 遍历当前活动的 VT group 动画，逐个改写为 compositor-only */
function makeGroupAnimationsCompositorOnly() {
	if (typeof document === "undefined") return;
	rewriteGroupAnimations(document);
}

/** 真实 VT 播放期间会挡住交互的用户输入：任一触发即提前结束过渡 */
const USER_INPUT_EVENTS = [
	"pointerdown",
	"touchstart",
	"wheel",
	"keydown",
] as const;

/**
 * 真实 VT 播放期间挂用户输入打断监听，返回幂等解绑函数。
 *
 * 新快照是固定覆盖层，用户此刻滚动/点按只会看到「页面没动」。交互优先：
 * 任一输入立即 skipTransition。capture 让输入一发生就响应（不等冒泡），
 * passive 不阻塞滚动/触摸，once 让命中的那个自行移除，其余由 cleanup
 * 统一移除。必须在本场 transition 启动之后调用 —— 起始手势的 pointerdown
 * 已经派发过，不会误杀。finished 的 resolve/reject 都清理（幂等）。
 */
function listenForUserInput(
	doc: Document,
	transition: ViewTransition,
): () => void {
	const listeners: Array<{ type: string; listener: EventListener }> = [];
	let cleaned = false;

	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		for (const { type, listener } of listeners) {
			try {
				doc.removeEventListener(type, listener, true);
			} catch {
				// 残缺环境（无 removeEventListener）忽略
			}
		}
		listeners.length = 0;
	};

	const onUserInput = () => {
		cleanup();
		try {
			transition.skipTransition();
		} catch {
			// transition 可能已结束/已跳过，忽略
		}
	};

	if (typeof doc.addEventListener !== "function") return cleanup;

	for (const type of USER_INPUT_EVENTS) {
		try {
			doc.addEventListener(type, onUserInput, {
				capture: true,
				passive: true,
				once: true,
			});
			listeners.push({ type, listener: onUserInput });
		} catch {
			// 不支持的事件类型/选项忽略
		}
	}

	transition.finished.then(cleanup, cleanup);
	return cleanup;
}

/** startViewTransition 的入参形态（回调 / { update, types }） */
export type ViewTransitionArg =
	| ViewTransitionUpdateCallback
	| { update: ViewTransitionUpdateCallback; types?: string[] };

/** 包装层可注入环境：真实安装传 document，单测传桩（node 环境无需 jsdom） */
export interface ViewTransitionWrapperEnv {
	doc: Document;
	/** 原生 document.startViewTransition（已绑定 this） */
	start: (arg?: ViewTransitionArg) => ViewTransition;
	/** 是否命中 prefers-reduced-motion；默认读 matchMedia */
	prefersReducedMotion?: () => boolean;
}

/** 从两种入参形态中取出 DOM 更新回调 */
function extractUpdateCallback(
	arg?: ViewTransitionArg,
): ViewTransitionUpdateCallback {
	if (typeof arg === "function") return arg;
	if (arg && typeof arg.update === "function") return arg.update;
	return () => {};
}

/**
 * reduced-motion 直通：styles.css 已把所有 VT 动画压到 0s，视觉上没有动画
 * 收益，原生 VT 只剩新旧两帧整页快照的采集成本（真实主线程光栅）。这里直接
 * 执行 update 回调，返回鸭子类型 ViewTransition：
 * - updateCallbackDone = 回调 promise（异常原样透传，不吞）；
 * - finished 在回调完成后 resolve（rejection 预消化）；
 * - ready 已就绪、skipTransition 空实现、不写 activeTransition。
 * TanStack Router 只 await 返回值的 updateCallbackDone（router-core 的
 * startViewTransition），因此回调异常必须保持可见。
 */
function runWithoutNativeTransition(
	update: ViewTransitionUpdateCallback,
): ViewTransition {
	const updateCallbackDone = Promise.resolve().then(() => update());
	const finished = updateCallbackDone.then(
		() => {},
		() => {},
	);
	return {
		ready: Promise.resolve(),
		finished,
		updateCallbackDone,
		skipTransition: () => {},
	} as unknown as ViewTransition;
}

/**
 * 创建 document.startViewTransition 的包装层（doc/start 可注入，便于 node
 * 环境单测）。正常路径行为逐条保留：skipActiveViewTransition → 原生 start →
 * ready 后 makeGroupAnimationsCompositorOnly → ready/finished 预消化（不
 * reject）→ finished 后清 activeTransition。本轮新增两件事：
 * 1. prefers-reduced-motion 命中时绕过原生 VT（免两次整页快照采集）；
 * 2. 真实 VT 播放中用户任一输入立即 skipTransition（交互优先）。
 */
export function createViewTransitionWrapper(
	env: ViewTransitionWrapperEnv,
): (arg?: ViewTransitionArg) => ViewTransition {
	const reducedMotion =
		env.prefersReducedMotion ??
		(() => mediaQueryMatches("(prefers-reduced-motion: reduce)"));

	return (arg) => {
		// 新导航开始时立刻终结上一场过渡：返回/快速点击在动画中途也能秒响应。
		// skipTransition 会 reject 旧的 ready/finished，被下方预消化 promise 吸收。
		skipActiveViewTransition();

		// 动画被 CSS 压到 0s 时原生 VT 只剩纯成本，直接跑 update 回调。
		if (reducedMotion()) {
			return runWithoutNativeTransition(extractUpdateCallback(arg));
		}

		const transition = env.start(arg);
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

		// 真实播放期间交互优先：任一输入立即跳过，finished 后自动清理监听
		listenForUserInput(env.doc, transition);

		return transition;
	};
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

	// 原生签名不含 { update, types } 形态，运行时两种都支持，统一成
	// ViewTransitionArg 后交给包装层。
	const original = document.startViewTransition.bind(document) as unknown as (
		arg?: ViewTransitionArg,
	) => ViewTransition;
	document.startViewTransition = createViewTransitionWrapper({
		doc: document,
		start: (arg) => original(arg),
	}) as typeof document.startViewTransition;
}

/**
 * 当前是否正处于 View Transition 的采集/动画阶段（html 匹配 :active-view-transition）。
 * 供在 startViewTransition 的 DOM 更新回调内挂载的组件同步检测「本次提交处于
 * VT 中」—— 那个时刻 tracker 的 activeTransition 可能尚未赋值，不能依赖它。
 */
export function isViewTransitionActive(): boolean {
	if (typeof document === "undefined") return false;
	try {
		return document.documentElement.matches(":active-view-transition");
	} catch {
		return false;
	}
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
