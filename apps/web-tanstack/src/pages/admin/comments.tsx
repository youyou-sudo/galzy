import { defineRoute } from "@teyik0/furin";
import CommentsPage, {
	commentsQueryOptions,
	DEFAULT_COMMENTS_FILTERS,
} from "@web/components/admin/comments-page";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/** 评论管理（等价旧 `routes/admin/_authL/comments.tsx`）。 */
const DEFAULT_QUERY = commentsQueryOptions(DEFAULT_COMMENTS_FILTERS);

export const route = defineRoute("/admin/comments")
	.config({ mode: "ssr" })
	.loader(async () => ({ comments: await DEFAULT_QUERY.queryFn() }))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }) as never)
	.page(({ comments }) => <CommentsRoute comments={comments} />);

function CommentsRoute({
	comments,
}: {
	comments: Awaited<ReturnType<typeof DEFAULT_QUERY.queryFn>>;
}) {
	useSeedQueries([[DEFAULT_QUERY.queryKey, comments]]);
	return <CommentsPage />;
}
