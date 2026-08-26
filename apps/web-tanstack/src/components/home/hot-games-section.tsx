import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { GameCard } from "@web/components/home/card";
import { cn } from "@web/lib/utils";
import { getCritical } from "@web/server/game";
import { r18Store } from "@web/stores/r18Store";
import { Flame, TrendingUp } from "lucide-react";

interface HotGame {
	id: string;
	title: string | null;
	total: number;
	imageUrl: string | null;
	imageWidth: number | null;
	imageHeight: number | null;
	imageThumbhash: string | null;
	cSexualAvg: number | null;
}

interface HotGamesSectionProps {
	games: HotGame[] | null;
}

const HOT_GAME_SKELETON_KEYS = Array.from(
	{ length: 12 },
	(_, index) => `hot-game-skeleton-${index}`,
);

export function HotGamesSection({ games: initialGames }: HotGamesSectionProps) {
	const showR18 = useSelector(r18Store, (s) => s.showR18);
	const { data: games, isLoading } = useQuery({
		queryKey: ["hotGames", showR18],
		queryFn: async () => (await getCritical({ data: { showR18 } })).game,
		// 关闭状态下 loader 数据与 key 一致直接用；开启时 key 不同，交给查询拉取（避免展示错误过滤的数据）
		initialData: showR18 === false ? initialGames : undefined,
		staleTime: 60_000,
	});

	// 切换/冷启动拉取窗口期显示骨架，避免整块空白
	if (isLoading) return <HotGamesSectionSkeleton />;

	if (!games || games.length === 0) return null;

	const displayGames = games.slice(0, 24);

	return (
		<section className="mb-8">
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<Flame className="size-5 text-orange-500" />
					<h2 className="text-xl font-semibold">本周热门</h2>
					<TrendingUp className="size-4 text-muted-foreground" />
				</div>
				<Link
					to="/games"
					search={{ sortBy: "downloads", order: "desc" }}
					className="text-sm text-muted-foreground hover:text-primary transition-colors"
				>
					更多游戏 →
				</Link>
			</div>
			<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
				{displayGames.map((game, index) => (
					// 每档断点固定四排：移动端 3×4=12、sm 4×4=16、md+ 6×4=24，超出项按断点隐藏
					<div
						key={game.id}
						className={cn(
							"relative",
							index >= 12 && index < 16 && "hidden sm:block",
							index >= 16 && "hidden md:block",
						)}
					>
						<GameCard.Item
							gameid={game.id}
							title={game.title || "未知游戏"}
							width={game.imageWidth ?? 200}
							height={game.imageHeight ?? 300}
							thumbhash={game.imageThumbhash}
							src={game.imageUrl ?? "/No-Image-Placeholder.svg.webp"}
							cSexualAvg={game.cSexualAvg ?? null}
						/>
						<span className="absolute top-1.5 left-1.5 z-20 flex size-5 items-center justify-center rounded-full bg-background/80 text-xs font-bold text-foreground backdrop-blur-sm pointer-events-none">
							{index + 1}
						</span>
					</div>
				))}
			</div>
		</section>
	);
}

export function HotGamesSectionSkeleton() {
	return (
		<section className="mb-8">
			<div className="flex items-center gap-2 mb-4">
				<div className="size-5 rounded bg-muted animate-pulse" />
				<div className="h-6 w-24 rounded bg-muted animate-pulse" />
			</div>
			<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
				{HOT_GAME_SKELETON_KEYS.map((key) => (
					<GameCard.ListSkeleton key={key} />
				))}
			</div>
		</section>
	);
}
