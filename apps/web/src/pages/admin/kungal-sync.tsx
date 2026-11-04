import { defineRoute } from "@teyik0/furin";
import { KungalSyncPage } from "@web/components/admin/kungal-sync-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { documentOnly } from "@web/lib/spa-request";
import { getKungalSyncProgress } from "@web/server/admin/kungal-sync";

const ADMIN_TITLE = "Kungal 数据同步 | GalZY - Galgame 资源站";

/**
 * Kungal 数据同步（主数据源：作品 / 角色 / 攻略）。
 *
 * 与 vndb-sync 页同一套取数约定：首屏 SSR 取进度并 seed 进查询缓存，
 * 站内切页时 documentOnly 返回 null，交给页面内 useQuery 自己取。
 */
export const route = defineRoute("/admin/kungal-sync")
	.config({ mode: "ssr" })
	.loader(async ({ request }) => ({
		progress: await documentOnly(request, () => getKungalSyncProgress()),
	}))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }))
	.page(({ progress }) => <KungalSyncRoute progress={progress} />);

function KungalSyncRoute({
	progress,
}: {
	progress: Awaited<ReturnType<typeof getKungalSyncProgress>> | null;
}) {
	// null = 站内切页：不 seed，交给页面内 useQuery 取数
	useSeedQueries(progress ? [[adminKeys.kungalSyncProgress(), progress]] : []);
	return <KungalSyncPage />;
}
