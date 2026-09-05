import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { Image, type ImageProps } from "@unpic/react";
import { AspectRatio } from "@web/components/ui/aspect-ratio";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import { useIdlePreload } from "@web/hooks/use-idle-preload";
import { useViewportPreload } from "@web/hooks/use-viewport-preload";
import { getImageRatio, getThumbHashDataUrl } from "@web/lib/image";
import { gameHeroActions } from "@web/stores/gameHeroStore";
import { r18Store } from "@web/stores/r18Store";
import {
	type ComponentProps,
	type CSSProperties,
	type ForwardRefExoticComponent,
	type RefAttributes,
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
	// 挂载即空闲预取详情数据（首屏卡片立即预热），未请求过的条目点击也秒开；
	// 不触发 view 计数（onEnter 仅在真实进入页面时计）。
	const linkRef = useRef<HTMLAnchorElement>(null);
	useViewportPreload(
		linkRef,
		(router) => () =>
			router.preloadRoute({ to: "/$id", params: { id: gameid } }),
	);
	useIdlePreload([
		(router) => {
			void router.preloadRoute({ to: "/$id", params: { id: gameid } });
		},
	]);

	return (
		<Link
			ref={linkRef}
			to="/$id"
			params={{ id: gameid }}
			onClick={() => {
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
				ratio={LIST_IMAGE_RATIO}
				className="block relative overflow-hidden rounded-lg"
				style={{ viewTransitionName: `game-cover-${gameid}` }}
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
				className="text-sm truncate w-fit max-w-full mx-auto text-center px-2 pt-2"
				style={{ viewTransitionName: `game-title-${gameid}` }}
			>
				{title}
			</p>
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
