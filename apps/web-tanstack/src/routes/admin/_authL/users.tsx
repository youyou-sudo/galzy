import { createFileRoute } from "@tanstack/react-router";
import UsersPage, {
	USERS_PAGE_SIZE,
	usersListFilters,
} from "@web/components/admin/users-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { adminListUsers } from "@web/server/auth/auth.functions";

/** 首屏预取与组件内 useQuery 共用 usersListFilters，键完全一致才不会闪空列表。 */
const DEFAULT_FILTERS = usersListFilters({ limit: USERS_PAGE_SIZE });

export const Route = createFileRoute("/admin/_authL/users")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: adminKeys.users(DEFAULT_FILTERS),
			queryFn: async () =>
				await adminListUsers({ data: { limit: USERS_PAGE_SIZE, offset: 0 } }),
		});
	},
	component: UsersPage,
});
