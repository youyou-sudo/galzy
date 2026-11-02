import { defineRoute } from "@teyik0/furin";
import CommentsPage, {
	commentsQueryOptions,
	DEFAULT_COMMENTS_FILTERS,
} from "@web/components/admin/comments-page";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { documentOnly } from "@web/lib/spa-request";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/** 评论管理（等价旧 `routes/admin/_authL/comments.tsx`）。 */
const DEFAULT_QUERY = commentsQueryOptions(DEFAULT_COMMENTS_FILTERS);

/**
 * 首屏数据只在文档请求里取：直链/刷新时 SSR 带着数据进水合，首屏不闪骨架；
 * 站内切页时 loader 返回 `null`，列表交给 CommentsPage 里的 useQuery 在客户端加载
 * （命中缓存就直接渲染），切页因此不再等一次「web → API → DB」往返。
 * 机制见 `@web/lib/spa-request`。
 */
export const route = defineRoute("/admin/comments")
	.config({ mode: "ssr" })
	.loader(async ({ request }) => ({
		comments: await documentOnly(request, () => DEFAULT_QUERY.queryFn()),
	}))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }) as never)
	.page(({ comments }) => <CommentsRoute comments={comments} />);

function CommentsRoute({
	comments,
}: {
	comments: Awaited<ReturnType<typeof DEFAULT_QUERY.queryFn>> | null;
}) {
	// null = SPA 切页：不 seed，让页面自己的 useQuery 按默认筛选取数
	useSeedQueries(comments ? [[DEFAULT_QUERY.queryKey, comments]] : []);
	return <CommentsPage />;
}
