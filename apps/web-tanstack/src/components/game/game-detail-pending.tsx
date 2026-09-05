import { useSelector } from "@tanstack/react-store";
import { GameCard } from "@web/components/home/card";
import { GameTabSkeleton } from "@web/components/game/game-tab-skeleton";
import { Skeleton } from "@web/components/ui/skeleton";
import { gameHeroStore, type GameHeroData } from "@web/stores/gameHeroStore";

/**
 * 详情页 pending 英雄区：点击进入时先用列表已有的封面/标题即时渲染首屏，
 * 完整详情（描述/发行/厂商）由 loader 完成后无缝替换。
 * 相比整页空白骨架，用户在等待 RPC 期间立刻能看到封面与标题。
 */
export function GameDetailPending({ id }: { id: string }) {
	const hero = useSelector(gameHeroStore, (s) => (s.id === id ? s.data : null));

	return (
		<div aria-hidden>
			<div className="flex items-center gap-2 mb-4">
				<Skeleton className="h-4 w-8" />
				<Skeleton className="h-4 w-2" />
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-4 w-2" />
				<Skeleton className="h-4 w-24" />
			</div>
			<div className="space-y-3">
				{hero ? <HeroFromStore hero={hero} /> : null}
				<div className="flex gap-2">
					<Skeleton className="h-8 w-24 rounded-full" />
					<Skeleton className="h-8 w-24 rounded-full" />
					<Skeleton className="h-8 w-24 rounded-full" />
				</div>
				<GameTabSkeleton />
			</div>
		</div>
	);
}

function HeroFromStore({ hero }: { hero: GameHeroData }) {
	return (
		<>
			<div className="sm:float-right text-center sm:text-right sm:ml-4 pb-4 relative">
				<div
					className="w-55 relative overflow-hidden text-left rounded-lg"
					style={{ viewTransitionName: `game-cover-${hero.id}` }}
				>
					<Skeleton className="absolute inset-0 w-full h-full rounded-lg" />
					<GameCard.ThumbHashImage
						width={hero.width ?? 200}
						height={hero.height ?? 300}
						thumbhash={hero.thumbhash}
						src={hero.imageUrl}
						alt={hero.olangTitle || "null"}
						className="rounded-lg w-full h-full object-cover"
					/>
				</div>
			</div>
			<div className="overflow-hidden wrap-break-word">
				<h1
					className="font-semibold text-2xl leading-[1.2] mt-2 w-fit"
					style={{ viewTransitionName: `game-title-${hero.id}` }}
				>
					{hero.olangTitle || "null"}
				</h1>
				<Skeleton className="h-4 w-2/3 max-w-60 mt-2" />
				<Skeleton className="h-4 w-full max-w-xl mt-1" />
			</div>
		</>
	);
}
