import { createFileRoute } from "@tanstack/react-router";
import CollectionsPage, {
	collectionsListFilters,
	fetchCollectionsList,
} from "@web/components/admin/collections-page";
import { adminKeys } from "@web/lib/admin/query-keys";

/** 首屏预取与组件内 useQuery 共用同一 queryFn / 键，避免首屏闪一次空列表。 */
const DEFAULT_FILTERS = collectionsListFilters();

export const Route = createFileRoute("/admin/_authL/collections")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: adminKeys.collections(DEFAULT_FILTERS),
			queryFn: () => fetchCollectionsList(DEFAULT_FILTERS),
		});
	},
	component: CollectionsPage,
});
