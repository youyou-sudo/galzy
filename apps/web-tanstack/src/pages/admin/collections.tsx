import { defineRoute } from "@teyik0/furin";
import CollectionsPage, {
	collectionsListFilters,
	fetchCollectionsList,
} from "@web/components/admin/collections-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/** 合集管理（等价旧 `routes/admin/_authL/collections.tsx`）。 */
const DEFAULT_FILTERS = collectionsListFilters();
const DEFAULT_KEY = adminKeys.collections(DEFAULT_FILTERS);

export const route = defineRoute("/admin/collections")
	.config({ mode: "ssr" })
	.loader(async () => ({
		collections: await fetchCollectionsList(DEFAULT_FILTERS),
	}))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }) as never)
	.page(({ collections }) => (
		<CollectionsRoute collections={collections} />
	));

function CollectionsRoute({
	collections,
}: {
	collections: Awaited<ReturnType<typeof fetchCollectionsList>>;
}) {
	useSeedQueries([[DEFAULT_KEY, collections]]);
	return <CollectionsPage />;
}
