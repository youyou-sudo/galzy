import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { GameCard } from "@web/components/home/card";
import {
	SectionHeader,
	sectionActionClass,
} from "@web/components/shared/section-header";
import { cn } from "@web/lib/utils";
import { getCritical } from "@web/server/game";
import { r18Store } from "@web/stores/r18Store";
import { Flame } from "lucide-react";

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

// 24 张骨架 + 与真实栅格相同的断点隐藏：移动端 3×4=12、sm 4×4=16、md+ 6×4=24，
// 各断点下骨架行数与数据到达后的真实行数一致，桌面端不会从两行跳到四行。
const HOT_GAME_SKELETON_KEYS = Array.from(
	{ length: 24 },
	(_, index) => `hot-game-skeleton-${index}`,
);

/**
 * 本周热门区块的标题行（图标 + 「本周热门」+「更多游戏 →」）。
 *
 * 真实区块、切 R18 时的加载态与首页 pending 骨架共用，标题行始终是真实 HTML。
 */
export function HotGamesSectionHeader() {
	return (
		<SectionHeader
			icon={Flame}
			title="本周热门"
			action={
				<Link
					to="/games"
					search={{ sortBy: "downloads", order: "desc" }}
					className={sectionActionClass}
				>
					更多游戏 →
				</Link>
			}
		/>
	);
}

/**
 * 本周热门列表。首屏数据由路由 loader 取（SSR 直接出真实卡片），这里用 useQuery
 * 订阅同一 key：切 R18 或 loader 未提供时自己补拉，加载窗口期只显示内容骨架。
 */
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
			<HotGamesSectionHeader />
			<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
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
						<span className="flex absolute top-1.5 left-1.5 z-20 justify-center items-center size-5 text-xs font-semibold text-foreground bg-background/85 rounded-full ring-1 ring-border/60 backdrop-blur-sm pointer-events-none">
							{index + 1}
						</span>
					</div>
				))}
			</div>
		</section>
	);
}

// pending 期间外壳固定：标题行与「更多游戏 →」是真实 HTML，只有卡片栅格出加载态
export function HotGamesSectionSkeleton() {
	return (
		<section className="mb-8">
			<HotGamesSectionHeader />
			<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
				{HOT_GAME_SKELETON_KEYS.map((key, index) => (
					// 与真实栅格的断点隐藏规则保持一致（见 HotGamesSection 里的同款 cn）
					<div
						key={key}
						className={cn(
							"relative",
							index >= 12 && index < 16 && "hidden sm:block",
							index >= 16 && "hidden md:block",
						)}
					>
						<GameCard.ListSkeleton />
					</div>
				))}
			</div>
		</section>
	);
}
