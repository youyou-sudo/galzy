import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { Image, type ImageProps } from "@unpic/react";
import { AspectRatio } from "@web/components/ui/aspect-ratio";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import {
	useIntentPreload,
	useViewportPreload,
} from "@web/hooks/use-viewport-preload";
import { getImageRatio, useThumbHashDataUrl } from "@web/lib/image";
import { gateCommit } from "@web/lib/reveal-gate";
import { gameHeroActions } from "@web/stores/gameHeroStore";
import { r18Store } from "@web/stores/r18Store";
import {
	type ComponentProps,
	type CSSProperties,
	type ForwardRefExoticComponent,
	memo,
	type RefAttributes,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

const SKELETON_KEYS = ["first", "second", "third"] as const;
const DETAIL_IMAGE_RATIO = 9 / 12;
const LIST_IMAGE_RATIO = 9 / 13;

// 触屏(coarse)指针检测：模块级一次性求值 matchMedia，避免每卡每帧查询。
// SSR/测试环境（无 window.matchMedia）恒为 false，桌面全部保持现状。
const coarseMediaQuery =
	typeof window !== "undefined" && typeof window.matchMedia === "function"
		? window.matchMedia("(pointer: coarse)")
		: null;

function subscribeCoarsePointer(onChange: () => void): () => void {
	coarseMediaQuery?.addEventListener("change", onChange);
	return () => coarseMediaQuery?.removeEventListener("change", onChange);
}

/** 触屏(coarse)指针 hook：SSR 快照恒 false（与服务端 markup 一致），水合后同步真实值。 */
function useCoarsePointer(): boolean {
	return useSyncExternalStore(
		subscribeCoarsePointer,
		() => coarseMediaQuery?.matches ?? false,
		() => false,
	);
}

// 已成功揭示的原图 URL 缓存（模块级，跨实例/虚拟列表重挂/路由返回共享）：
// 同一 src 再次挂载时首帧直接终态（无骨架、无 thumbhash 占位、无切换动画）。
// 仅成功加载的原图入缓存；失败图、R18 placeholderOnly/revealed 状态均不入缓存。
const revealedSrcs = new Set<string>();
const revealedListeners = new Set<() => void>();

function markRevealed(src: string): void {
	if (revealedSrcs.has(src)) return;
	revealedSrcs.add(src);
	for (const listener of revealedListeners) listener();
}

function subscribeRevealed(onChange: () => void): () => void {
	revealedListeners.add(onChange);
	return () => revealedListeners.delete(onChange);
}

/** 客户端快照按 src 实时查询；SSR 快照恒 false，与服务端 markup 一致避免 hydration mismatch
（水合完成后 useSyncExternalStore 自动切换到客户端快照，命中即重渲染为终态）。
导出给 GameHeader 使用：列表已揭示过的图（revealedSrcs 命中）在 VT 期间可跳过
thumbhash 占位 gate，直接渲染真图，VT 快照拍到终态实现无缝飞入。 */
export function useRevealedOnce(src: string): boolean {
	return useSyncExternalStore(
		subscribeRevealed,
		() => revealedSrcs.has(src),
		() => false,
	);
}

// Unpic merges custom styles at runtime, but its ImageProps omits the style prop.
type ImagePropsWithStyle = ImageProps & {
	style?: CSSProperties;
};

const ImageWithStyle = Image as unknown as ForwardRefExoticComponent<
	ImagePropsWithStyle & RefAttributes<HTMLImageElement>
>;

type ThumbHashImageProps = ImagePropsWithStyle & {
	thumbhash?: string | null;
	/** 动画层（占位 + 真实图的公共容器）的定位类；默认铺满父容器 */
	wrapperClassName?: string;
	wrapperStyle?: CSSProperties;
	/**
	 * 缓存/秒开命中时也播放过渡动画。默认 true（所有加载都播浮现动画）；
	 * 详情页主封面（GameHeader.Image）可传 false 跳过缓存命中的动画，避免重复访问详情页的喧宾夺主。
	 */
	alwaysAnimate?: boolean;
	/** 触屏敏感图未揭示态：只渲染 thumbhash 小图（替代 blur-xl 滤镜），
	 * 真实图不渲染；thumbhash 未就绪的窗口期真实图带 blur-xl 兜底防泄漏。 */
	placeholderOnly?: boolean;
};

const NO_IMAGE_SRC = "/No-Image-Placeholder.svg.webp";

function ThumbHashImage({
	thumbhash,
	className,
	onLoad,
	src,
	wrapperClassName = "absolute inset-0",
	wrapperStyle,
	alwaysAnimate = true,
	placeholderOnly = false,
	...props
}: ThumbHashImageProps) {
	// 缓存命中同步拿到 dataURL；未命中返回 null（此时渲染骨架底），
	// 解码在 Worker（fallback: idle 分片）中异步完成后由 state 承接，不再阻塞 render。
	const placeholder = useThumbHashDataUrl(thumbhash);
	const coarse = useCoarsePointer();
	const cachedRevealed = useRevealedOnce(src);
	// 本地 loaded/failed 按 src 隔离：props.src 变化时同步重置（React 官方
	// 「渲染期调整 state」模式），避免沿用旧 URL 的加载状态。
	const [imageState, setImageState] = useState({
		src,
		loaded: false,
		failed: false,
	});
	if (imageState.src !== src) {
		setImageState({ src, loaded: false, failed: false });
	}
	// 本次挂载内真实图是否已经「可绘制」（download + decode 完成）。
	// 与 loaded 的区别：loaded 额外含 revealedSrcs 缓存命中，用于首帧直出
	// （无骨架、无缩放动画）；但缓存只保证「这个 URL 以前成功加载过」，
	// 不保证浏览器此刻已经把它解码成可上屏的位图 —— 路由返回时图片缓存
	// 可能已被淘汰/需要重新解码，直接按 loaded 撤掉占位就会露出一段空白。
	// 因此占位图/骨架的撤下条件一律用 imageLoaded，loaded 只负责终态样式。
	const imageLoaded = imageState.loaded;
	const loaded = imageLoaded || cachedRevealed;
	const failed = imageState.failed;
	const imgRef = useRef<HTMLImageElement | null>(null);

	// 回程首帧校正：这张图以前已经揭示过（revealedSrcs 命中），且浏览器此刻
	// 已经能拿到它（complete + 有尺寸）时，在首帧 paint 前直接恢复终态。
	// 否则组件重新挂载后 imageState 从 0 开始，占位图会先画出来、等 decode
	// 完成 + 门控提交后才消失 —— 用户看到的就是「从别的页面回首页，图先变成
	// 占位图、过一会儿才重新显示」。只处理这次挂载立刻就能拿到资源的情况，
	// 真没缓存的图仍走下面的 decode 流程。
	useLayoutEffect(() => {
		if (!cachedRevealed) return;
		const image = imgRef.current;
		if (!image?.complete || image.naturalWidth === 0) return;
		setImageState((s) => (s.loaded ? s : { ...s, loaded: true }));
	}, [cachedRevealed, src]);

	// img.decode() 预解码提交：真实图下载并解码完成后才置 loaded ——
	// 上屏首帧就是已解码位图，transition 首帧不再撞解码；同时把每图一次的
	// load 事件提交风暴换成 decode 微任务（React 可批处理）。decode() reject
	// 视为加载失败（回退 No-Image）。无 decode() 的环境（含 jsdom/旧引擎）
	// 仍走 complete / load / error 事件兜底。
	useEffect(() => {
		const image = imgRef.current;
		if (!image) return;
		let cancelled = false;
		let cancelGate: (() => void) | undefined;
		// 滚动 / View Transition 进行中挂起揭示提交（见 @web/lib/reveal-gate）：
		// 图片陆续 decode 完成后的 setState 会洒进滚动帧/动画帧
		// （移动端滑动与 VT 过渡掉帧根因），空闲后由 gate 批量 flush。
		const commit = () => {
			if (cancelled) return;
			const apply = () => {
				if (cancelled) return;
				setImageState((s) => ({ ...s, loaded: true }));
				// 成功揭示才入全局缓存；失败回退路径（failed）不计入。
				if (!failed) markRevealed(src);
			};
			// 已揭示过的图：回程只是恢复终态，不必排在滚动/VT 门控后面 ——
			// 否则回程的 VT（~300ms）期间占位图一直显形，看起来像重新加载。
			// 未揭示过的图仍走门控，避免把揭示提交洒进滚动/动画帧。
			if (cachedRevealed) {
				apply();
				return;
			}
			cancelGate = gateCommit(apply);
		};
		const handleError = () => {
			if (cancelled) return;
			cancelGate = gateCommit(() => {
				if (cancelled) return;
				setImageState((s) => ({ ...s, failed: true, loaded: true }));
			});
		};

		// decode() 优先于 complete：complete 只代表「资源已下载完」，解码可能
		// 还没发生（浏览器按需/在合成线程解码，图片缓存被回收后重新解码尤其
		// 明显）。旧实现把 complete 当成就绪，路由返回缓存图片时立刻撤掉占位，
		// 位图尚未上屏的那段时间就是用户看到的「图片空白」。
		// decode() 的 resolve 才代表可以无闪烁地上屏；对未开始加载的
		// lazy 图片它会一直 pending（保持占位），对已失败图片则 reject。
		if (typeof image.decode === "function") {
			let decoding: Promise<void>;
			try {
				decoding = image.decode();
			} catch {
				// decode() 同步抛错（如已脱离文档）：按失败处理，交回 No-Image 兜底
				handleError();
				return () => {
					cancelled = true;
					cancelGate?.();
				};
			}
			decoding.then(commit, handleError);
			return () => {
				cancelled = true;
				cancelGate?.();
			};
		}

		if (image.complete) {
			if (image.naturalWidth === 0) {
				handleError();
			} else {
				commit();
			}
			return () => {
				cancelled = true;
				cancelGate?.();
			};
		}

		image.addEventListener("load", commit, { once: true });
		image.addEventListener("error", handleError, { once: true });
		return () => {
			cancelled = true;
			image.removeEventListener("load", commit);
			image.removeEventListener("error", handleError);
			cancelGate?.();
		};
	}, [src, failed, placeholderOnly, cachedRevealed]);

	// thumbhash 未就绪时的敏感图兜底：此时真实图必须保持模糊，防内容泄漏
	const blurFallback = placeholderOnly && !placeholder ? " blur-xl" : "";

	// 占位图卸载条件：触屏揭示为瞬时终态（无 opacity 过渡），直接卸载占位图
	// 减少常驻图层（移动端一次挂载几十张卡时合成节点/绘制树线性膨胀，滑动掉帧根因）；
	// 桌面保留淡出（opacity 0 + 常驻），不引入 onTransitionEnd 卸载，避免桌面回归。
	// placeholderOnly 时占位图是唯一可见内容（真实图不渲染），永不卸载。
	const unloadPlaceholder = coarse && imageLoaded && !placeholderOnly;

	return (
		<div className={wrapperClassName} style={wrapperStyle}>
			{/* 骨架底：thumbhash dataURL 就绪前 / 无占位时显示，本次挂载的真图
				可绘制后卸载。animate-pulse 常驻会持续触发样式重算，必须条件渲染
				而不是盖在下面。缓存命中（loaded）时通常不显示骨架避免脉冲闪烁；
				但如果该图没有 thumbhash 占位，仍要用骨架兜住「位图未就绪」的空白。 */}
			{(!loaded || (!imageLoaded && !placeholder)) && (
				<Skeleton className="absolute inset-0 w-full h-full" />
			)}
			{/* 性能方案：占位图是 ~32px 级小图，object-cover 放大后天然模糊，
				无需 filter blur（大面积 blur 光栅化很贵）；dataURL 就绪前由骨架底兜底。
				加载完成后占位图只做廉价的 opacity 淡出，露出下方清晰图。
				触屏(coarse)：无 opacity 过渡，揭示是瞬时终态，直接卸载占位图减少常驻图层；
				桌面保留淡出（opacity 0 + 常驻）。 */}
			{placeholder && !unloadPlaceholder && (
				<img
					aria-hidden="true"
					alt=""
					className={`galzy-thumbhash-placeholder absolute inset-0 w-full h-full object-cover ${className ?? ""}`}
					src={placeholder ?? undefined}
					style={{
						// 始终渲染在真实图下方（DOM 顺序在后 = 在上层的是真图），
						// 只在本次挂载的真图解码完成后才淡出 —— 路由返回时即使
						// 命中揭示缓存、位图仍需重新解码，也有 thumbhash 占位兜底。
						opacity: imageLoaded && !placeholderOnly ? 0 : 1,
						imageRendering: "auto",
						...(coarse
							? {}
							: {
									transition: "opacity 320ms ease-out",
									transitionDelay: "0s",
								}),
					}}
				/>
			)}
			{placeholderOnly && placeholder ? null : (
				<div className="galzy-image-reveal absolute inset-0">
					<ImageWithStyle
						{...props}
						// 已揭示过的图：回程直接 eager 取（命中 HTTP 缓存），不排队等
						// IntersectionObserver 的懒加载，占位图停留时间因此只剩解码时间
						loading={cachedRevealed ? "eager" : props.loading}
						src={failed ? NO_IMAGE_SRC : src}
						ref={imgRef}
						className={`${className ?? ""}${blurFallback}`}
						style={{
							...props.style,
							...(alwaysAnimate && !coarse
								? {
										transform: loaded ? "scale(1)" : "scale(1.04)",
										// 只保留 opacity/transform（compositor 友好）；
										// filter 过渡移除后 R18 blur-xl 显隐为瞬切（类名逻辑不动）。
										transition: "transform 320ms ease-out",
									}
								: {}),
						}}
						onLoad={(event) => {
							onLoad?.(event);
						}}
						onError={() => {
							// setFailed 同步执行（类名切换是廉价 DOM 属性更新）；
							// 揭示动画部分经 gate 提交，滚动/VT 中不洒帧。
							setImageState((s) => ({ ...s, failed: true }));
							gateCommit(() => setImageState((s) => ({ ...s, loaded: true })));
						}}
					/>
				</div>
			)}
		</div>
	);
}

function IdGameCardSkeleton({ ref, ...props }: ComponentProps<"div">) {
	return (
		<div ref={ref} {...props}>
			<div className="flex gap-4 mt-10">
				<Skeleton className="h-50 w-67.5 w-min-[270px]" />
				<div className="space-y-4 w-full">
					<Skeleton className="h-10 max-w-50" />
					<Skeleton className="h-4 max-w-50" />
					{SKELETON_KEYS.map((key) => (
						<Skeleton className="h-4 w-full" key={key} />
					))}
				</div>
			</div>
			<div className="space-y-4">
				<div className="flex gap-2">
					{SKELETON_KEYS.map((key) => (
						<Skeleton className="h-7 w-12.5" key={key} />
					))}
				</div>
				{SKELETON_KEYS.map((key) => (
					<Skeleton className="h-4 w-3/5" key={key} />
				))}
			</div>
		</div>
	);
}

function GameSkeleton({ ref, ...props }: ComponentProps<"div">) {
	return (
		<div className="space-y-2 aspect-[9/13] p-0" ref={ref} {...props}>
			<Skeleton className="h-full w-full inset-0 rounded-lg border bg-muted shadow" />
			<Skeleton className="flex p-2 w-full shadow" />
		</div>
	);
}

export function Images({
	className,
	cSexualAvg,
	thumbhash,
	...props
}: ThumbHashImageProps & { cSexualAvg?: number | null }) {
	const THRESHOLD = 1.0;
	const showR18 = useSelector(r18Store, (s) => s.showR18);
	const isSensitive = !showR18 && (cSexualAvg ?? 0) >= THRESHOLD;
	const coarse = useCoarsePointer();
	const [revealed, setRevealed] = useState(false);
	const sensitiveHidden = isSensitive && !revealed;
	const ratio = getImageRatio(
		props.width as number | undefined,
		props.height as number | undefined,
		DETAIL_IMAGE_RATIO,
	);

	return (
		<AspectRatio
			ratio={ratio}
			className="w-full overflow-hidden rounded-lg border bg-muted shadow"
		>
			<div className="relative w-full h-full">
				<ThumbHashImage
					{...props}
					thumbhash={thumbhash}
					placeholderOnly={coarse && sensitiveHidden}
					className={`w-full h-full object-cover transition-[filter] duration-500 ease-out${sensitiveHidden && !coarse ? " blur-xl" : ""} ${className ?? ""}`}
				/>
				{sensitiveHidden && (
					<div
						className={`absolute inset-0 flex flex-col items-center justify-center z-10 rounded-lg text-center px-2 pb-12 ${coarse ? "bg-black/40" : "bg-black/40 backdrop-blur-sm"}`}
					>
						<span className="text-white text-2xl font-bold">涩！</span>
						<span className="text-white/70 text-xs mt-1">
							图片包含不宜在公共场合查看的内容喵～
						</span>
						<Button
							size="sm"
							className="absolute bottom-2 right-2"
							onClick={() => setRevealed(true)}
						>
							显示
						</Button>
					</div>
				)}
			</div>
		</AspectRatio>
	);
}

function SensitiveImage({
	cSexualAvg,
	className,
	thumbhash,
	revealed: revealedProp,
	onReveal,
	...imageProps
}: ThumbHashImageProps & {
	cSexualAvg?: number | null;
	/** 受控揭示态：详情页灯箱只在揭示后挂载触发器，避免绕过遮挡直接开大图。 */
	revealed?: boolean;
	onReveal?: () => void;
}) {
	const THRESHOLD = 1.0;
	const showR18 = useSelector(r18Store, (s) => s.showR18);
	const isSensitive = !showR18 && (cSexualAvg ?? 0) >= THRESHOLD;
	const coarse = useCoarsePointer();
	const [internalRevealed, setInternalRevealed] = useState(false);
	const revealed = revealedProp ?? internalRevealed;
	const reveal = () => {
		if (revealedProp === undefined) setInternalRevealed(true);
		onReveal?.();
	};
	const sensitiveHidden = isSensitive && !revealed;

	const w = (imageProps as Record<string, unknown>).width as number | undefined;
	const h = (imageProps as Record<string, unknown>).height as
		| number
		| undefined;
	const ratio = getImageRatio(w, h, DETAIL_IMAGE_RATIO);

	return (
		<AspectRatio ratio={ratio} className="w-full overflow-hidden rounded-lg">
			<div className="relative w-full h-full">
				<ThumbHashImage
					{...imageProps}
					thumbhash={thumbhash}
					placeholderOnly={coarse && sensitiveHidden}
					className={`w-full h-full object-cover transition-[filter] duration-500 ease-out${sensitiveHidden && !coarse ? " blur-xl" : ""} ${className ?? ""}`}
				/>
				{sensitiveHidden && (
					<div
						className={`absolute inset-0 flex flex-col items-center justify-center z-10 rounded-lg text-center px-2 pb-12 ${coarse ? "bg-black/40" : "bg-black/40 backdrop-blur-sm"}`}
					>
						<span className="text-white text-2xl font-bold">涩！</span>
						<span className="text-white/70 text-xs mt-1">
							图片包含不宜在公共场合查看的内容喵～
						</span>
						<Button
							size="sm"
							className="absolute bottom-2 right-2"
							onClick={reveal}
						>
							显示
						</Button>
					</div>
				)}
			</div>
		</AspectRatio>
	);
}

export type GameCardItemProps = {
	gameid: string;
	title: string;
	width?: number;
	height?: number;
	src: string;
	thumbhash?: string | null;
	cSexualAvg?: number | null;
	/** 仅被点击（去程）/上次点击（回程）的卡保留 view-transition-name：
	 * N 页列表的 2N 个共享元素会让 VT 快照 + tracker 扫描随页数线性爆炸，
	 * 去/回导航各卡一次。封面飞入动画只配对这一张卡，其余卡不参与。 */
	hasVT?: boolean;
	/** R18 开关由列表层统一订阅后下发，避免每张卡各自订阅 store
	 *（N 张卡 = N 个订阅，切换/更新时全量重渲染）。缺省时回退到 store。 */
	showR18?: boolean;
	/** 首屏行优先加载：首行传 high，其余 low，避免几十张图同时抢带宽 */
	fetchPriority?: "high" | "low" | "auto";
	/** 点击时同步回写（state + sessionStorage），供回程恢复配对。
	 * 第二个参数是被点卡片顶部的文档绝对 Y（调用方无需再自行计算 scrollY）。 */
	onActivate?: (id: string, cardTopY?: number) => void;
};

function ItemInner({
	gameid,
	title,
	width,
	height,
	src,
	thumbhash,
	cSexualAvg,
	hasVT = false,
	showR18: showR18Prop,
	fetchPriority = "low",
	onActivate,
}: GameCardItemProps) {
	const THRESHOLD = 1.0;
	const storeShowR18 = useSelector(r18Store, (s) => s.showR18);
	const showR18 = showR18Prop ?? storeShowR18;
	const isSensitive = !showR18 && (cSexualAvg ?? 0) >= THRESHOLD;
	const coarse = useCoarsePointer();
	const [revealed, setRevealed] = useState(false);
	const sensitiveHidden = isSensitive && !revealed;
	// 触屏下不渲染 hover:scale-105（Tailwind v4 独立 scale 属性，触屏点按粘滞
	// 且 inline transform 覆盖不了它）；桌面保持现状。
	const hoverClasses = coarse
		? ""
		: " hover:scale-105 transition duration-500 ease-out";
	// 仅用视口预取（内部有 MAX_CONCURRENT 并发队列）：进入视口才预热详情，
	// 未请求过的条目点击也秒开，且不触发 view 计数（onEnter 仅在真实进入页面时计）。
	// 注意：不要再叠加挂载即 idle 预取 —— 「加载更多」一次性挂载几十张卡时
	// 会形成不受控并发洪峰，抢在点击前打爆 server function/API，导致点击顿挫、
	// 列表图片集体闪烁（返回列表再次挂载还会重放一次洪峰）。
	const linkRef = useRef<HTMLAnchorElement>(null);
	const coverRef = useRef<HTMLDivElement>(null);
	const titleRef = useRef<HTMLParagraphElement>(null);
	useViewportPreload(
		linkRef,
		(router) => () =>
			router.preloadRoute({ to: "/$id", params: { id: gameid } }),
	);
	// 大列表降级时视口预取自动停用，hover/focus 意图预取接管：
	// 滚动零请求，悬停卡仍秒开。
	useIntentPreload(
		linkRef,
		(router) => () =>
			router.preloadRoute({ to: "/$id", params: { id: gameid } }),
	);

	return (
		<Link
			ref={linkRef}
			to="/$id"
			params={{ id: gameid }}
			onClick={() => {
				// 同步写 DOM：VT 旧快照在 startViewTransition 调用瞬间采集，
				// React state 重渲染赶不上，必须在导航前直接给被点卡挂上名字；
				// 回程靠 hasVT（sessionStorage 恢复）提前渲染配对。
				coverRef.current?.style.setProperty(
					"view-transition-name",
					`game-cover-${gameid}`,
				);
				titleRef.current?.style.setProperty(
					"view-transition-name",
					`game-title-${gameid}`,
				);
				// 卡片顶部的文档绝对位置：link 元素 bounding rect + scrollY。
				// 同步读取，不受后续 VT/导航的 layout 变化影响；回程恢复时
				// 被点卡回到视口内同一位置（scrollY = cardTop − 点击时行内偏移，
				// 在 /games index.tsx 的 handleActivate 内换算）。
				const cardTopY =
					(linkRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
				onActivate?.(gameid, cardTopY);
				// 进入详情页前先用列表数据填充英雄区，详情 loader 完成前即可首屏渲染
				gameHeroActions.set({
					id: gameid,
					title: title || "",
					olangTitle: title || "",
					imageUrl: src,
					thumbhash,
					width,
					height,
					cSexualAvg,
				});
			}}
		>
			<AspectRatio
				ref={coverRef}
				ratio={LIST_IMAGE_RATIO}
				// 不再用卡级 [content-visibility:auto]：行级虚拟化 + measureElement
				// 已裁剪渲染范围，卡级 CVA 的 contain-intrinsic-size 估算与实测行高
				// 不一致会叠加出测量噪声（RO 全量修正 + 滚动补偿），直接移除。
				className="block relative overflow-hidden rounded-lg"
				style={
					hasVT ? { viewTransitionName: `game-cover-${gameid}` } : undefined
				}
			>
				<div className="relative w-full h-full">
					{/* 骨架已内移到 ThumbHashImage：加载完成后条件卸载，不再常驻 animate-pulse。
						触屏敏感图未揭示态：thumbhash 小图放大替代 blur-xl 滤镜（无双重滤波）。 */}
					<ThumbHashImage
						width={width ?? 200}
						height={height ?? 300}
						thumbhash={thumbhash}
						loading="lazy"
						decoding="async"
						fetchPriority={fetchPriority}
						src={src}
						alt={title || " "}
						placeholderOnly={coarse && sensitiveHidden}
						className={`w-full h-full object-cover${hoverClasses}${sensitiveHidden && !coarse ? " blur-xl" : ""}`}
					/>
					{sensitiveHidden && (
						<div
							className={`absolute inset-0 flex flex-col items-center justify-center z-10 rounded-lg text-center px-2 pb-12 ${coarse ? "bg-black/40" : "bg-black/40 backdrop-blur-sm"}`}
						>
							<span className="text-white text-2xl font-bold">涩！</span>
							<span className="text-white/70 text-xs mt-1">
								图片包含不宜在公共场合查看的内容喵～
							</span>
							<Button
								size="sm"
								className="absolute bottom-2 right-2"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setRevealed(true);
								}}
							>
								显示
							</Button>
						</div>
					)}
				</div>
			</AspectRatio>
			<p
				ref={titleRef}
				className="text-sm truncate w-fit max-w-full mx-auto text-center px-2 pt-2"
				style={
					hasVT
						? {
								viewTransitionName: `game-title-${gameid}`,
								viewTransitionClass: "vt-text",
							}
						: undefined
				}
			>
				{title}
			</p>
		</Link>
	);
}

/**
 * memo 边界：fetchNextPage / 返回列表 / R18 以外状态变化时，
 * props 不变的卡跳过重渲染。hasVT 变化的只有被点/上次被点的两张卡。
 * 注意 memo 比较的是顶层 props —— 调用方必须传稳定引用/标量
 *（title/width/height/src/thumbhash/cSexualAvg 均为 Meili 文档标量）。
 */
const Item = memo(ItemInner);

export const GameCard = {
	ListSkeleton: GameSkeleton,
	Image: SensitiveImage,
	IdGameCardSkeleton,
	Item,
	ThumbHashImage,
};
