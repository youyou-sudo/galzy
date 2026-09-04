import { Link } from "@tanstack/react-router";
import { GameCard } from "@web/components/home/card";
import { useViewportPreload } from "@web/hooks/use-viewport-preload";
import { cn } from "@web/lib/utils";
import { Layers, Library } from "lucide-react";
import { useRef } from "react";

interface PreviewItem {
	id: string;
	alias: string | null;
	imageId: string | null;
	imageUrl: string | null;
	imageWidth: number | null;
	imageHeight: number | null;
	imageThumbhash: string | null;
	cSexualAvg: number | null;
}

interface CollectionData {
	id: number;
	title: string;
	description?: string | null;
	type: string;
	entryCount?: number;
	previews: PreviewItem[];
}

function PokerStack({
	previews,
	count,
}: {
	previews: PreviewItem[];
	count: number;
}) {
	const stackItems = previews.slice(0, 3);

	if (stackItems.length === 0) {
		return (
			<div className="aspect-[4/5] flex items-center justify-center rounded-xl bg-muted/50">
				<Library className="size-8 text-muted-foreground/30" />
			</div>
		);
	}

	const layerStyles = [
		{ rotate: -10, x: -16, y: 4, z: 0, scale: 0.82 },
		{ rotate: 1, x: 0, y: 0, z: 10, scale: 0.9 },
		{ rotate: 10, x: 16, y: 4, z: 20, scale: 1 },
	];

	const hoverStyles = [
		"group-hover:rotate-[-7deg] group-hover:translate-x-[-13px] group-hover:translate-y-[4px]",
		"group-hover:rotate-[1deg] group-hover:-translate-x-[3px] group-hover:-translate-y-[2px]",
		"group-hover:rotate-[7deg] group-hover:translate-x-[13px] group-hover:translate-y-[4px]",
	];

	return (
		<div className="relative aspect-[4/5] w-full rounded-xl bg-muted/30">
			{stackItems.map((item, i) => {
				const layer = layerStyles[i];
				return (
					<GameCard.ThumbHashImage
						key={item.id}
						src={item.imageUrl ?? "/No-Image-Placeholder.svg.webp"}
						thumbhash={item.imageThumbhash}
						width={item.imageWidth ?? 200}
						height={item.imageHeight ?? 300}
						alt=""
						loading="lazy"
						decoding="async"
						alwaysAnimate
						wrapperClassName={cn(
							"absolute top-1/2 left-1/2",
							"w-[68%] aspect-[2/3] overflow-hidden rounded-lg border-[3px] border-background",
							"shadow-md shadow-black/15 dark:shadow-black/30",
							// 扑克层 hover 旋转/位移的过渡类（内联动画只作用于组件内部动画层，
							// 本层的 transform 恒由此类接管）
							"transition-all duration-500 ease-out",
							hoverStyles[i],
						)}
						wrapperStyle={{
							transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) translate(${layer.x}px, ${layer.y}px) scale(${layer.scale})`,
							zIndex: layer.z,
						}}
						className="w-full h-full object-cover"
					/>
				);
			})}

			{/* Count badge — bottom-right */}
			<div
				style={{ zIndex: 30 }}
				className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-white/85 dark:bg-black/55 backdrop-blur-sm px-2 py-0.5 text-xs font-medium shadow-sm"
			>
				<Layers className="size-3" />
				{count} 部
			</div>
		</div>
	);
}

export function CollectionItem({ collection }: { collection: CollectionData }) {
	const gameCount = collection.entryCount ?? collection.previews?.length ?? 0;
	const linkRef = useRef<HTMLAnchorElement>(null);
	// 进入视口即预取合集详情数据，点击秒开
	useViewportPreload(
		linkRef,
		(router) => () =>
			router.preloadRoute({
				to: "/collections/$id",
				params: { id: String(collection.id) },
			}),
	);

	return (
		<Link
			ref={linkRef}
			to="/collections/$id"
			params={{ id: String(collection.id) }}
			className="group block rounded-2xl transition-all duration-300 hover:-translate-y-1"
		>
			<PokerStack previews={collection.previews} count={gameCount} />
			<h3 className="mt-2.5 text-sm font-medium text-center line-clamp-1 group-hover:text-primary transition-colors">
				{collection.title}
			</h3>
		</Link>
	);
}

export function CollectionItemSkeleton() {
	return (
		<div>
			<div className="rounded-xl bg-muted animate-pulse aspect-[4/5]" />
			<div className="mt-2 h-4 w-2/3 mx-auto rounded bg-muted animate-pulse" />
		</div>
	);
}
