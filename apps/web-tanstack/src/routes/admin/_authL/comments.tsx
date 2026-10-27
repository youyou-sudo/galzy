import { createFileRoute } from "@tanstack/react-router";
import CommentsPage, {
	commentsQueryOptions,
	DEFAULT_COMMENTS_FILTERS,
} from "@web/components/admin/comments-page";

export const Route = createFileRoute("/admin/_authL/comments")({
	loader: async ({ context }) => {
		// 与页面 useQuery 共用 commentsQueryOptions，key 一致才不会首屏闪空列表
		await context.queryClient.ensureQueryData(
			commentsQueryOptions(DEFAULT_COMMENTS_FILTERS),
		);
	},
	component: CommentsPage,
});
