import { defineRoute } from "@teyik0/furin";
import VndbSyncPage from "@web/components/admin/vndb-sync-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { getSyncProgress } from "@web/server/admin/vndb-sync";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/** VNDB 数据同步（等价旧 `routes/admin/_authL/vndb-sync.tsx`）。 */
export const route = defineRoute("/admin/vndb-sync")
	.config({ mode: "ssr" })
	.loader(async () => ({ progress: await getSyncProgress() }))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }) as never)
	.page(({ progress }) => <VndbSyncRoute progress={progress} />);

function VndbSyncRoute({
	progress,
}: {
	progress: Awaited<ReturnType<typeof getSyncProgress>>;
}) {
	useSeedQueries([[adminKeys.vndbSyncProgress(), progress]]);
	return <VndbSyncPage />;
}
