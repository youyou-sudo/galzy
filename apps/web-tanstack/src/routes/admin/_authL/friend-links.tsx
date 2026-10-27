import { createFileRoute } from "@tanstack/react-router";
import FriendLinksAdminPage from "@web/components/admin/friend-links-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { adminGetFriendLinks } from "@web/server/admin/friend-links";

export const Route = createFileRoute("/admin/_authL/friend-links")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: adminKeys.friendLinks(),
			queryFn: async () => await adminGetFriendLinks({ data: {} }),
		});
	},
	component: FriendLinksAdminPage,
});
