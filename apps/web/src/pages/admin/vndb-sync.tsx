import { defineRoute } from "@teyik0/furin";
import VndbSyncPage from "@web/components/admin/vndb-sync-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { documentOnly } from "@web/lib/spa-request";
import { getSyncProgress } from "@web/server/admin/vndb-sync";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/** VNDB 数据同步（等价旧 `routes/admin/_authL/vndb-sync.tsx`）。 */
export const route = defineRoute("/admin/vndb-sync")
	.config({ mode: "ssr" })
	.loader(async ({ request }) => ({
		progress: await documentOnly(request, () => getSyncProgress()),
	}))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }))
	.page(({ progress }) => <VndbSyncRoute progress={progress} />);

function VndbSyncRoute({
	progress,
}: {
	progress: Awaited<ReturnType<typeof getSyncProgress>> | null;
}) {
	// null = 站内切页：不 seed，交给页面内 useQuery 取数
	useSeedQueries(progress ? [[adminKeys.vndbSyncProgress(), progress]] : []);
	return <VndbSyncPage />;
}
