import { createFileRoute, useParams } from "@tanstack/react-router";
import ArticlePage from "@web/components/introduction/article-page";
import { ArticlePagePending } from "@web/components/introduction/article-page-pending";
import { seoTemplate } from "@web/config/seoTemplate";
import { getIntroductionArticle } from "@web/server/introduction";

export const Route = createFileRoute("/$id/_layout/introduction/$articleId")({
	// 冷缓存/未预加载时内容卡里只出正文骨架，页头标题/返回按钮复用真实外壳
	pendingComponent: PendingArticle,
	loader: async ({ params }) => {
		return {
			article: await getIntroductionArticle({
				data: { id: params.articleId },
			}),
			gameId: params.id,
			articleId: params.articleId,
		};
	},
	head: ({ loaderData }) => ({
		meta: [
			{ title: `${loaderData?.article?.title} | ${seoTemplate.title}` },
			{
				name: "description",
				content: `${loaderData?.article?.title}`,
			},
		],
	}),
	headers: () => ({
		"Cache-Control": "public, max-age=300, stale-while-revalidate=600",
	}),

	staleTime: 60_000,
	gcTime: 5 * 60_000,

	component: () => {
		const loaderData = Route.useLoaderData();
		return <ArticlePage {...loaderData} />;
	},
});

// pending 态需要 articleId / gameId：前者复用列表入口带过来的标题，
// 后者让「返回列表」在数据到达前就是真实链接
function PendingArticle() {
	const { id, articleId } = useParams({
		from: "/$id/_layout/introduction/$articleId",
	});
	return <ArticlePagePending articleId={articleId} gameId={id} />;
}
