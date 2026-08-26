import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { Image, type ImageProps } from "@unpic/react";
import { AspectRatio } from "@web/components/ui/aspect-ratio";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import { useViewportPreload } from "@web/hooks/use-viewport-preload";
import { getImageRatio, getThumbHashDataUrl } from "@web/lib/image";
import { r18Store } from "@web/stores/r18Store";
import {
	type ComponentProps,
	type CSSProperties,
	useEffect,
	useRef,
	useState,
} from "react";

const SKELETON_KEYS = ["first", "second", "third"] as const;
const DETAIL_IMAGE_RATIO = 9 / 12;
const LIST_IMAGE_RATIO = 9 / 13;

type ThumbHashImageProps = ImageProps & {
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

/** 交叉过渡编排参数：真实图以模糊形态快速淡入并缓慢去模糊；占位同步淡出让位。 */
const REVEAL_BLUR_PX = 24;
const REVEAL_OPACITY_MS = 250;
const REVEAL_BLUR_MS = 600;
const PLACEHOLDER_FADE_MS = 400;

const prefersReducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
	// 过渡结束后移除动画层内联 filter/transition，把 filter（敏感图 blur-xl）与
	// transform（列表 hover:scale-105 / 扑克层 hover 旋转位移）交还给外层类接管
	const [settled, setSettled] = useState(false);
	const [placeholderGone, setPlaceholderGone] = useState(false);
	// 占位在加载期间恒定可见（thumbhash 秒出）；真实图到位后淡出，
	// 淡出完毕（placeholderGone）或秒开直出（loaded && settled）时移除
	const showPlaceholder =
		Boolean(placeholder) && !(loaded && settled) && !placeholderGone;
	const reduceMotion = prefersReducedMotion();
	const imgRef = useRef<HTMLImageElement | null>(null);

	// 缓存/秒开命中兜底：图片在 hydration 前已加载完成，onLoad/onError 事件错过。
	// ref 阶段 setLoaded 会被 React 同步 flushSync——同一帧内动画层 inline style
	// 从起始（opacity:0 blur:24）直接变目标（opacity:1 blur:0），浏览器只 paint 目标
	// 态，CSS transition 无起始帧不触发。React 19 hydration + useEffect 调度也常在同一
	// paint 循环内，setTimeout 也无法保证 paint 在前。唯一可靠：useEffect 跑后**强制
	// 同步 reflow 起始态**（读取 offsetHeight 触发浏览器同步 paint 当前 DOM），再
	// setLoaded 触发 re-render 时浏览器已开始下一帧 paint 目标态 → CSS 过渡生效。
	// 还在加载中（!complete）→ 等 onLoad 自然触发（onLoad 在 commit+paint 之后）。
	// failed 路径（complete=true 但 naturalWidth=0）→ 快速回退并 setSettled。
	useEffect(() => {
		const img = imgRef.current;
		if (!img?.complete) return;
		if (img.naturalWidth === 0) {
			setFailed(true);
			setLoaded(true);
			setSettled(true);
			return;
		}
		if (!alwaysAnimate || reduceMotion) {
			setLoaded(true);
			setSettled(true);
			return;
		}
		// 强制 reflow 起始态：访问 offsetHeight 触发浏览器同步 paint 当前 DOM
		//（起始态占位清晰可见、真实图 opacity:0 blur:24 被 paint 一次），下一帧
		// setLoaded 翻转后浏览器 paint 目标态，CSS transition 从已 paint 的起始态过渡。
		void document.body.offsetHeight;
		setLoaded(true);
	}, []);

	return (
		<div className={wrapperClassName} style={wrapperStyle}>
			{/* thumbhash 占位：加载期间完整可见，真实图到位后向下淡出让位（层级在其下） */}
			{showPlaceholder && (
				<img
					aria-hidden="true"
					alt=""
					className={`absolute inset-0 w-full h-full object-cover ${className ?? ""}`}
					src={placeholder ?? undefined}
					style={{
						opacity: loaded ? 0 : 1,
						transition: reduceMotion
							? "none"
							: `opacity ${PLACEHOLDER_FADE_MS}ms ease`,
					}}
					onTransitionEnd={(event) => {
						if (
							event.target === event.currentTarget &&
							event.propertyName === "opacity"
						) {
							setPlaceholderGone(true);
						}
					}}
				/>
			)}
			{/* 真实图动画层：加载中隐藏；到位后带模糊淡入，与占位淡出的同时去模糊至清晰。
			    内联样式只作用于该层，不污染真实图的类式 filter（敏感图 blur-xl）/transform */}
			<div
				className="absolute inset-0"
				style={
					settled || reduceMotion
						? undefined
						: loaded
							? {
									opacity: 1,
									filter: "blur(0px)",
									transition: `opacity ${REVEAL_OPACITY_MS}ms ease-out, filter ${REVEAL_BLUR_MS}ms ease-out`,
								}
							: { opacity: 0, filter: `blur(${REVEAL_BLUR_PX}px)` }
				}
				onTransitionEnd={(event) => {
					if (
						event.target === event.currentTarget &&
						event.propertyName === "filter"
					) {
						setSettled(true);
					}
				}}
			>
				<Image
					{...props}
					src={failed ? NO_IMAGE_SRC : src}
					ref={imgRef}
					className={className}
					onLoad={(event) => {
						setLoaded(true);
						if (reduceMotion) setSettled(true);
						onLoad?.(event);
					}}
					onError={() => {
						// 封面 CDN 加载失败（如 kungal 图在部分网络不可达）：
						// 回退到本地占位图并走同一套浮现动画，避免图片永远不可见
						setFailed(true);
						setLoaded(true);
						if (reduceMotion) setSettled(true);
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

function Item({
	gameid,
	title,
	width,
	height,
	src,
	thumbhash,
	cSexualAvg,
}: {
	gameid: string;
	title: string;
	width?: number;
	height?: number;
	src: string;
	thumbhash?: string | null;
	cSexualAvg?: number | null;
}) {
	const THRESHOLD = 1.0;
	const showR18 = useSelector(r18Store, (s) => s.showR18);
	const isSensitive = !showR18 && (cSexualAvg ?? 0) >= THRESHOLD;
	const [revealed, setRevealed] = useState(false);
	// 进入视口即预取详情数据，未请求过的条目点击也秒开（不触发 view 计数）
	const linkRef = useRef<HTMLAnchorElement>(null);
	useViewportPreload(
		linkRef,
		(router) => () =>
			router.preloadRoute({ to: "/$id", params: { id: gameid } }),
	);

	return (
		<Link ref={linkRef} to="/$id" params={{ id: gameid }}>
			<AspectRatio
				ratio={LIST_IMAGE_RATIO}
				className="block relative overflow-hidden rounded-lg"
				style={{ contentVisibility: "auto" }}
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
						src={src}
						alt={title || " "}
						className={`absolute inset-0 w-full h-full object-cover hover:scale-105 transition duration-500 ease-out${isSensitive && !revealed ? " blur-xl" : ""}`}
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
			<p className="text-sm truncate w-full text-center px-2 pt-2">{title}</p>
		</Link>
	);
}

export const GameCard = {
	ListSkeleton: GameSkeleton,
	Image: SensitiveImage,
	IdGameCardSkeleton,
	Item,
	ThumbHashImage,
};
