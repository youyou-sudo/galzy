import { createFileRoute } from "@tanstack/react-router";
import UsersPage from "@web/components/admin/users-page";
import { adminListUsers } from "@web/server/auth/auth.functions";

export const Route = createFileRoute("/admin/_authL/users")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: ["admin-users", { searchValue: "", offset: 0, limit: 15 }],
			queryFn: async () => {
				return await adminListUsers({ data: { limit: 15, offset: 0 } });
			},
		});
	},
	component: UsersPage,
});
