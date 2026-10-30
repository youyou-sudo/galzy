import { defineRoute } from "@teyik0/furin";
import UsersPage, { USERS_PAGE_SIZE, usersListFilters } from "@web/components/admin/users-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { adminListUsers } from "@web/server/auth/auth.functions";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/** 用户管理（等价旧 `routes/admin/_authL/users.tsx`）。 */
const DEFAULT_FILTERS = usersListFilters({ limit: USERS_PAGE_SIZE });
const DEFAULT_KEY = adminKeys.users(DEFAULT_FILTERS);

export const route = defineRoute("/admin/users")
	.config({ mode: "ssr" })
	.loader(async () => ({
		users: await adminListUsers({
			data: { limit: USERS_PAGE_SIZE, offset: 0 },
		}),
	}))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }) as never)
	.page(({ users }) => <UsersRoute users={users} />);

function UsersRoute({
	users,
}: {
	users: Awaited<ReturnType<typeof adminListUsers>>;
}) {
	useSeedQueries([[DEFAULT_KEY, users]]);
	return <UsersPage />;
}
