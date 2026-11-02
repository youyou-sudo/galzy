import { defineRoute } from "@teyik0/furin";
import CollectionsPage, {
	collectionsListFilters,
	fetchCollectionsList,
} from "@web/components/admin/collections-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { documentOnly } from "@web/lib/spa-request";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/** 合集管理（等价旧 `routes/admin/_authL/collections.tsx`）。 */
const DEFAULT_FILTERS = collectionsListFilters();
const DEFAULT_KEY = adminKeys.collections(DEFAULT_FILTERS);

/** 首屏 SSR 取数，站内切页由 CollectionsPage 里的 useQuery 取数（见 `@web/lib/spa-request`）。 */
export const route = defineRoute("/admin/collections")
	.config({ mode: "ssr" })
	.loader(async ({ request }) => ({
		collections: await documentOnly(request, () =>
			fetchCollectionsList(DEFAULT_FILTERS),
		),
	}))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }) as never)
	.page(({ collections }) => <CollectionsRoute collections={collections} />);

function CollectionsRoute({
	collections,
}: {
	collections: Awaited<ReturnType<typeof fetchCollectionsList>> | null;
}) {
	// null = 站内切页：不 seed，交给页面内 useQuery 取数
	useSeedQueries(collections ? [[DEFAULT_KEY, collections]] : []);
	return <CollectionsPage />;
}
