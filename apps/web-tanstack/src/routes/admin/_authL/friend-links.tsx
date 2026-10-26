import { createFileRoute } from "@tanstack/react-router";
import FriendLinksAdminPage from "@web/components/admin/friend-links-page";
import { adminGetFriendLinks } from "@web/server/admin/friend-links";

export const Route = createFileRoute("/admin/_authL/friend-links")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: ["admin-friend-links"],
			queryFn: async () => await adminGetFriendLinks({ data: {} }),
		});
	},
	component: FriendLinksAdminPage,
});
