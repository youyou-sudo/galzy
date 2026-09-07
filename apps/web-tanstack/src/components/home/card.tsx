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
import { getImageRatio, getThumbHashDataUrl } from "@web/lib/image";
import { gameHeroActions } from "@web/stores/gameHeroStore";
import { r18Store } from "@web/stores/r18Store";
import {
	type ComponentProps,
	type CSSProperties,
	type ForwardRefExoticComponent,
	type RefAttributes,
	memo,
	useEffect,
	useRef,
	useState,
} from "react";

const SKELETON_KEYS = ["first", "second", "third"] as const;
const DETAIL_IMAGE_RATIO = 9 / 12;
const LIST_IMAGE_RATIO = 9 / 13;

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
	...props
}: ThumbHashImageProps) {
	const placeholder = getThumbHashDataUrl(thumbhash);
	const [loaded, setLoaded] = useState(false);
	const [failed, setFailed] = useState(false);
	const imgRef = useRef<HTMLImageElement | null>(null);

	// 缓存命中时 load 事件可能在 hydration 前触发；未命中时使用原生事件补上加载状态。
	useEffect(() => {
		const image = imgRef.current;
		if (!image) return;

		const handleLoad = () => setLoaded(true);
		const handleError = () => {
			setFailed(true);
			setLoaded(true);
		};

		if (image.complete) {
			if (image.naturalWidth === 0) {
				handleError();
			} else {
				handleLoad();
			}
			return;
		}

		image.addEventListener("load", handleLoad, { once: true });
		image.addEventListener("error", handleError, { once: true });
		return () => {
			image.removeEventListener("load", handleLoad);
			image.removeEventListener("error", handleError);
		};
	}, []);

	return (
		<div className={wrapperClassName} style={wrapperStyle}>
			{/* 性能方案：占位图保留静态模糊（绝不动画），真实图不模糊。
				加载完成后占位图只做廉价的 opacity 淡出，露出下方清晰图，
				避免对逐帧 box-blur 的 filter 动画造成 GPU 合成压力。
				模糊半径从 24px 降到 12px：网格大量占位同时存在时显著减轻 GPU 填充。 */}
			{placeholder && (
				<img
					aria-hidden="true"
					alt=""
					className={`galzy-thumbhash-placeholder absolute inset-0 w-full h-full object-cover ${className ?? ""}`}
					src={placeholder ?? undefined}
					style={{
						opacity: loaded ? 0 : 1,
						filter: "blur(12px)",
						transition: "opacity 320ms ease-out",
						transitionDelay: "0s",
					}}
				/>
			)}
			<div className="galzy-image-reveal absolute inset-0">
				<ImageWithStyle
					{...props}
					src={failed ? NO_IMAGE_SRC : src}
					ref={imgRef}
					className={className}
					style={{
						...props.style,
						...(alwaysAnimate
							? {
									transform: loaded ? "scale(1)" : "scale(1.04)",
									// 同时保留 filter 过渡：R18 遮盖的 blur-xl → 清晰时仍平滑
									transition: "transform 320ms ease-out, filter 320ms ease-out",
								}
							: {}),
					}}
					onLoad={(event) => {
						setLoaded(true);
						onLoad?.(event);
					}}
					onError={() => {
						setFailed(true);
						setLoaded(true);
					}}
				/>
			</div>
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
	const [revealed, setRevealed] = useState(false);
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
					className={`w-full h-full object-cover transition-[filter] duration-500 ease-out ${isSensitive && !revealed ? "blur-xl" : ""} ${className ?? ""}`}
				/>
				{isSensitive && !revealed && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10 rounded-lg text-center px-2 pb-12">
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
	...imageProps
}: ThumbHashImageProps & { cSexualAvg?: number | null }) {
	const THRESHOLD = 1.0;
	const showR18 = useSelector(r18Store, (s) => s.showR18);
	const isSensitive = !showR18 && (cSexualAvg ?? 0) >= THRESHOLD;
	const [revealed, setRevealed] = useState(false);

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
					className={`w-full h-full object-cover transition-[filter] duration-500 ease-out ${isSensitive && !revealed ? "blur-xl" : ""} ${className ?? ""}`}
				/>
				{isSensitive && !revealed && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10 rounded-lg text-center px-2 pb-12">
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
	/** 点击时同步回写（state + sessionStorage），供回程恢复配对 */
	onActivate?: (id: string) => void;
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
	const [revealed, setRevealed] = useState(false);
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
				onActivate?.(gameid);
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
				className="block relative overflow-hidden rounded-lg [content-visibility:auto] [contain-intrinsic-size:auto_320px]"
				style={hasVT ? { viewTransitionName: `game-cover-${gameid}` } : undefined}
			>
				<div className="relative w-full h-full">
					{/* 无 thumbhash 的图片加载期间露出骨架（有占位时被占位层盖住） */}
					<Skeleton className="absolute inset-0 w-full h-full" />
					<ThumbHashImage
						width={width ?? 200}
						height={height ?? 300}
						thumbhash={thumbhash}
						loading="lazy"
						decoding="async"
						fetchPriority={fetchPriority}
						src={src}
						alt={title || " "}
						className={`w-full h-full object-cover hover:scale-105 transition duration-500 ease-out${isSensitive && !revealed ? " blur-xl" : ""}`}
					/>
					{isSensitive && !revealed && (
						<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10 rounded-lg text-center px-2 pb-12">
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
				style={hasVT ? { viewTransitionName: `game-title-${gameid}` } : undefined}
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
