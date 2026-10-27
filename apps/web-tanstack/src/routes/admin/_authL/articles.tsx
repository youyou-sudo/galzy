import { createFileRoute } from "@tanstack/react-router";
import ArticlesPage, {
	articlesQueryOptions,
	DEFAULT_ARTICLES_FILTERS,
} from "@web/components/admin/articles-page";

export const Route = createFileRoute("/admin/_authL/articles")({
	loader: async ({ context }) => {
		// 与页面 useQuery 共用 articlesQueryOptions，key 一致才不会首屏闪空列表
		await context.queryClient.ensureQueryData(
			articlesQueryOptions(DEFAULT_ARTICLES_FILTERS),
		);
	},
	component: ArticlesPage,
});
