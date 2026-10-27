import { createFileRoute } from "@tanstack/react-router";
import TopicsPage, {
	DEFAULT_TOPICS_FILTERS,
	topicsQueryOptions,
} from "@web/components/admin/topics-page";

export const Route = createFileRoute("/admin/_authL/topics")({
	loader: async ({ context }) => {
		// 与页面 useQuery 共用 topicsQueryOptions，key 一致才不会首屏闪空列表
		await context.queryClient.ensureQueryData(
			topicsQueryOptions(DEFAULT_TOPICS_FILTERS),
		);
	},
	component: TopicsPage,
});
