import { defineRoute } from "@teyik0/furin";
import FriendLinksAdminPage from "@web/components/admin/friend-links-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { adminGetFriendLinks } from "@web/server/admin/friend-links";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/** 友情链接管理（等价旧 `routes/admin/_authL/friend-links.tsx`）。 */
export const route = defineRoute("/admin/friend-links")
	.config({ mode: "ssr" })
	.loader(async () => ({
		links: await adminGetFriendLinks({ data: {} }),
	}))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }) as never)
	.page(({ links }) => <FriendLinksRoute links={links} />);

function FriendLinksRoute({
	links,
}: {
	links: Awaited<ReturnType<typeof adminGetFriendLinks>>;
}) {
	useSeedQueries([[adminKeys.friendLinks(), links]]);
	return <FriendLinksAdminPage />;
}
