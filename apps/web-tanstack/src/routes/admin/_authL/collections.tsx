import { createFileRoute } from "@tanstack/react-router";
import CollectionsPage from "@web/components/admin/collections-page";
import { adminGetCollections } from "@web/server/admin/collections";

export const Route = createFileRoute("/admin/_authL/collections")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: ["admin-all-collections", { status: "", offset: 0, limit: 20 }],
			queryFn: async () => {
				const res = await adminGetCollections({ data: { page: 1, limit: 20 } });
				return res as any;
			},
		});
	},
	component: CollectionsPage,
});
