import { Link } from "@tanstack/react-router";
import { cn } from "@web/lib/utils";
import { Layers, Library } from "lucide-react";

interface PreviewItem {
	id: string;
	alias: string | null;
	imageId: string | null;
	imageUrl: string | null;
	imageWidth: number | null;
	imageHeight: number | null;
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
		{ rotate: -4, x: -4, y: 2, z: 0, scale: 0.82 },
		{ rotate: 1, x: 0, y: 0, z: 10, scale: 0.9 },
		{ rotate: 6, x: 4, y: 2, z: 20, scale: 1 },
	];

	const hoverStyles = [
		"group-hover:rotate-[-8deg] group-hover:translate-x-[-14px] group-hover:translate-y-[6px]",
		"group-hover:rotate-[2deg] group-hover:-translate-x-[3px] group-hover:-translate-y-[2px]",
		"group-hover:rotate-[10deg] group-hover:translate-x-[14px] group-hover:translate-y-[6px]",
	];

	return (
		<div className="relative aspect-[4/5] w-full rounded-xl overflow-hidden bg-muted/30">
			{stackItems.map((item, i) => {
				const layer = layerStyles[i];
				return (
					<img
						key={item.id}
						src={item.imageUrl ?? "/No-Image-Placeholder.svg.webp"}
						alt=""
						style={{
							transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) translate(${layer.x}px, ${layer.y}px) scale(${layer.scale})`,
							zIndex: layer.z,
						}}
						className={cn(
							"absolute top-1/2 left-1/2",
							"w-[68%] aspect-[2/3] rounded-lg border-[3px] border-background",
							"shadow-md shadow-black/15 dark:shadow-black/30",
							"object-cover transition-all duration-500 ease-out",
							hoverStyles[i],
						)}
						loading="lazy"
					/>
				);
			})}

			{/* Bottom gradient */}
			<div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

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

	return (
		<Link
			to={`/collections/${collection.id}`}
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
