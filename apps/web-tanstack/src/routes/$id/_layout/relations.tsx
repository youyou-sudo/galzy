import { createFileRoute } from "@tanstack/react-router";
import { GameTabSkeleton } from "@web/components/game/game-tab-skeleton";
import { RelationsPage } from "@web/components/home/game/relations/relations-page";
import { seoTemplate } from "@web/config/seoTemplate";
import { gameTitleOf, parentGameFromMatches } from "@web/lib/seo";
import { getGameRelations } from "@web/server/game";

export const Route = createFileRoute("/$id/_layout/relations")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const { id } = params;
		return {
			relations: await getGameRelations({ data: { id } }),
		};
	},
	head: ({ matches }) => ({
		// 复用父布局已加载的 game detail，避免重复请求
		meta: [
			{
				title: `${gameTitleOf(parentGameFromMatches(matches))} 系列关系 | ${seoTemplate.title}`,
			},
		],
	}),
	headers: () => ({
		// Cache at CDN for 1 hour, allow stale content for up to 1 day
		"Cache-Control": "public, max-age=300, stale-while-revalidate=600",
	}),

	// Client-side caching (via TanStack Router)
	staleTime: 60_000, // Consider data fresh for 60 seconds on client
	gcTime: 5 * 60_000, // Keep in memory for 5 minutes
	pendingComponent: () => <GameTabSkeleton />,
});

function RouteComponent() {
	return <RelationsPage />;
}
