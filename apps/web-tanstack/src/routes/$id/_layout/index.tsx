import { createFileRoute } from "@tanstack/react-router";
import { GameTabSkeleton } from "@web/components/game/game-tab-skeleton";
import { DownloadOptions } from "@web/components/home/game/download-options";
import { getFileList } from "@web/server/game";

export const Route = createFileRoute("/$id/_layout/")({
	component: DownloadComponent,
	pendingComponent: () => <GameTabSkeleton />,
	loader: async ({ params }) => {
		const { id } = params;
		const filelist = await getFileList({ data: { id } });
		return { filelist };
	},
	headers: ({ params }) => ({
		"Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
		"Cache-Tag": `game-${params.id},page-game-download`,
	}),

	// Client-side caching (via TanStack Router)
	staleTime: 60_000, // Consider data fresh for 60 seconds on client
	gcTime: 5 * 60_000, // Keep in memory for 5 minutes
});

function DownloadComponent() {
	return <DownloadOptions />;
}
