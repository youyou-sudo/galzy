import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { Image, type ImageProps } from "@unpic/react";
import { AspectRatio } from "@web/components/ui/aspect-ratio";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import { useViewportPreload } from "@web/hooks/use-viewport-preload";
import { getImageRatio } from "@web/lib/image";
import { r18Store } from "@web/stores/r18Store";
import { type ComponentProps, useRef, useState } from "react";

const SKELETON_KEYS = ["first", "second", "third"] as const;
const DETAIL_IMAGE_RATIO = 9 / 12;

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
		<div className="space-y-2 aspect-2/3 p-0" ref={ref} {...props}>
			<Skeleton className="h-full w-full inset-0 rounded-lg border bg-muted shadow" />
			<Skeleton className="flex p-2 w-full shadow" />
		</div>
	);
}

export function Images({
	className,
	cSexualAvg,
	...props
}: ImageProps & { cSexualAvg?: number | null }) {
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
				<Image
					{...props}
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
	...imageProps
}: ImageProps & { cSexualAvg?: number | null }) {
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
				<Image
					{...imageProps}
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
	cSexualAvg,
}: {
	gameid: string;
	title: string;
	width?: number;
	height?: number;
	src: string;
	cSexualAvg?: number | null;
}) {
	const THRESHOLD = 1.0;
	const showR18 = useSelector(r18Store, (s) => s.showR18);
	const isSensitive = !showR18 && (cSexualAvg ?? 0) >= THRESHOLD;
	const [revealed, setRevealed] = useState(false);
	const ratio = getImageRatio(width, height);
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
				ratio={ratio}
				className="block relative overflow-hidden rounded-lg"
				style={{ contentVisibility: "auto" }}
			>
				<Skeleton className="absolute inset-0 w-full h-full" />
				<div className="relative w-full h-full">
					<Image
						width={width ?? 200}
						height={height ?? 300}
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
};
