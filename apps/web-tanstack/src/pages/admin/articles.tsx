import { defineRoute } from "@teyik0/furin";
import ArticlesPage, {
	articlesQueryOptions,
	DEFAULT_ARTICLES_FILTERS,
} from "@web/components/admin/articles-page";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/**
 * 文章管理（等价旧 `routes/admin/_authL/articles.tsx`）。
 *
 * loader 与组件内 useQuery 共用 `articlesQueryOptions`：键一致，
 * 首屏才不会闪一次空列表。
 */
const DEFAULT_QUERY = articlesQueryOptions(DEFAULT_ARTICLES_FILTERS);

export const route = defineRoute("/admin/articles")
	.config({ mode: "ssr" })
	.loader(async () => ({ articles: await DEFAULT_QUERY.queryFn() }))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }) as never)
	.page(({ articles }) => (
		<ArticlesRoute articles={articles} />
	));

function ArticlesRoute({
	articles,
}: {
	articles: Awaited<ReturnType<typeof DEFAULT_QUERY.queryFn>>;
}) {
	useSeedQueries([[DEFAULT_QUERY.queryKey, articles]]);
	return <ArticlesPage />;
}
