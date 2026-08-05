import { createFileRoute } from "@tanstack/react-router";
import { GameTabSkeleton } from "@web/components/game/game-tab-skeleton";
import IntroductionPage from "@web/components/introduction/introduction-page";
import { seoTemplate } from "@web/config/seoTemplate";
import { gameTitleOf, parentGameFromMatches } from "@web/lib/seo";
import { getintroductionList } from "@web/server/introduction";

export const Route = createFileRoute("/$id/_layout/introduction/")({
	loader: async ({ params }) => {
		const { id } = params;
		return {
			introductionList: await getintroductionList({ data: { id } }),
			id,
		};
	},
	head: ({ matches }) => ({
		// 复用父布局已加载的 game detail，避免重复请求
		meta: [
			{
				title: `${gameTitleOf(parentGameFromMatches(matches))} 攻略文章列表 | ${seoTemplate.title}`,
			},
		],
	}),
	headers: () => ({
		"Cache-Control": "public, max-age=300, stale-while-revalidate=600",
	}),

	staleTime: 60_000,
	gcTime: 5 * 60_000,
	pendingComponent: () => <GameTabSkeleton />,

	component: () => {
		const loaderData = Route.useLoaderData();
		return <IntroductionPage {...loaderData} />;
	},
});
