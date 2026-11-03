import { defineRoute } from "@teyik0/furin";
import UsersPage, {
	USERS_PAGE_SIZE,
	usersListFilters,
} from "@web/components/admin/users-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { documentOnly } from "@web/lib/spa-request";
import { adminListUsers } from "@web/server/auth/auth.functions";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/** 用户管理（等价旧 `routes/admin/_authL/users.tsx`）。 */
const DEFAULT_FILTERS = usersListFilters({ limit: USERS_PAGE_SIZE });
const DEFAULT_KEY = adminKeys.users(DEFAULT_FILTERS);

/** 首屏 SSR 取数，站内切页由 UsersPage 里的 useQuery 取数（见 `@web/lib/spa-request`）。 */
export const route = defineRoute("/admin/users")
	.config({ mode: "ssr" })
	.loader(async ({ request }) => ({
		users: await documentOnly(request, () =>
			adminListUsers({
				data: { limit: USERS_PAGE_SIZE, offset: 0 },
			}),
		),
	}))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }))
	.page(({ users }) => <UsersRoute users={users} />);

function UsersRoute({
	users,
}: {
	users: Awaited<ReturnType<typeof adminListUsers>> | null;
}) {
	// null = 站内切页：不 seed，交给页面内 useQuery 取数
	useSeedQueries(users ? [[DEFAULT_KEY, users]] : []);
	return <UsersPage />;
}
