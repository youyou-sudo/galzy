import { createFileRoute } from "@tanstack/react-router";
import CommentsPage from "@web/components/admin/comments-page";
import { adminGetAllComments } from "@web/server/admin/comments";

export const Route = createFileRoute("/admin/_authL/comments")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: [
				"admin-all-comments",
				{
					searchValue: "",
					status: "",
					type: "",
					excludeReplies: false,
					offset: 0,
					limit: 20,
				},
			],
			queryFn: async () => {
				const res = await adminGetAllComments({
					data: { page: 1, limit: 20 },
				});
				return res as any;
			},
		});
	},
	component: CommentsPage,
});
