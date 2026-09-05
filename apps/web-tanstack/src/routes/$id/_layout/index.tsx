import { createFileRoute } from "@tanstack/react-router";
import { GameTabSkeleton } from "@web/components/game/game-tab-skeleton";
import { DownloadOptions } from "@web/components/home/game/download-options";

export const Route = createFileRoute("/$id/_layout/")({
	component: DownloadComponent,
	pendingComponent: () => <GameTabSkeleton />,
	// 文件列表改由 DownloadOptions 内 useQuery 懒加载，不再阻塞点击导航关键路径
	headers: ({ params }) => ({
		"Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
		"Cache-Tag": `game-${params.id},page-game-download`,
	}),
});

function DownloadComponent() {
	return <DownloadOptions />;
}
