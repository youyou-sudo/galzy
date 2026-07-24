import { createFileRoute } from "@tanstack/react-router";
import TopicsPage from "@web/components/admin/topics-page";
import { adminGetAllTopics } from "@web/server/admin/topics";

export const Route = createFileRoute("/admin/_authL/topics")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: ["admin-all-topics", { status: "", offset: 0, limit: 20 }],
			queryFn: async () => {
				const res = await adminGetAllTopics({ data: { page: 1, limit: 20 } });
				return res as any;
			},
		});
	},
	component: TopicsPage,
});
