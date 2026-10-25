import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import CountComponent from "@web/components/home/Count";
import { CollectionsSection } from "@web/components/home/collections-section";
import { HomeHero } from "@web/components/home/home-hero";
import { HomePagePending } from "@web/components/home/home-page-pending";
import { HotGamesSection } from "@web/components/home/hot-games-section";
import { HotTagsSection } from "@web/components/home/hot-tags-section";
import SearchInput from "@web/components/home/search/Search";
import { seoTemplate } from "@web/config/seoTemplate";
import { useIdlePreload } from "@web/hooks/use-idle-preload";
import { seoMeta } from "@web/lib/seo";
import { getCollectionsWithPreview } from "@web/server/collections";
import { getCritical, getTotalCount } from "@web/server/game";
import { r18Store } from "@web/stores/r18Store";

export const Route = createFileRoute("/")({
	component: App,
	head: () =>
		seoMeta({
			title: seoTemplate.title,
			description: seoTemplate.description,
			path: "/",
		}),
	loader: async ({ context }) => {
		const showR18 = r18Store.state.showR18;
		const [rankings] = await Promise.all([
			getCritical({ data: { showR18 } }),
			Promise.all([
				context.queryClient.ensureQueryData({
					queryKey: ["homeCollections", showR18],
					queryFn: () =>
						getCollectionsWithPreview({
							data: { limit: 6, previewLimit: 3, showR18 },
						}).then((r) => r.items),
				}),
				context.queryClient.ensureQueryData({
					queryKey: ["totalCount"],
					queryFn: () => getTotalCount(),
				}),
			]),
		]);
		// 预热首页热门游戏缓存（key 与 HotGamesSection 一致，SSR 渲染直接用，不重复请求）
		context.queryClient.setQueryData(["hotGames", showR18], rankings.game);
		return { rankings };
	},

	// pending 期间外壳（标题/计数文案/搜索栏/区块标题）固定渲染，只有内容出骨架
	pendingComponent: () => <HomePagePending />,
	headers: () => ({
		"Cache-Control": "public, s-maxage=10, stale-while-revalidate=60",
		"Cache-Tag": "page-home",
	}),
	staleTime: 60_000,
	gcTime: 5 * 60_000,
});

const apiroute = getRouteApi("/");

function App() {
	const { rankings } = apiroute.useLoaderData();

	// 空闲预取「更多游戏 →」「更多合集 →」及标签/会社页，点击时即时命中缓存
	useIdlePreload([
		(router) => {
			void router.preloadRoute({
				to: "/games",
				search: { sortBy: "downloads", order: "desc" },
			});
		},
		(router) => {
			void router.preloadRoute({ to: "/collections", search: { page: 1 } });
		},
		(router) => {
			void router.preloadRoute({ to: "/tags" });
		},
		(router) => {
			// 「热门标签 → 更多」的落点：热门分类页 + 本周热门排序
			void router.preloadRoute({
				to: "/tags/category/$categoryKey",
				params: { categoryKey: "hot" },
				search: { sort: "hotWeek", order: "desc" },
			});
		},
		(router) => {
			void router.preloadRoute({ to: "/producer" });
		},
	]);

	return (
		<>
			<HomeHero />

			<CountComponent />

			<div className="px-5 sm:px-20 lg:px-80 my-4">
				<SearchInput />
			</div>

			<HotTagsSection tags={rankings.tag} />

			<HotGamesSection games={rankings.game} />

			<CollectionsSection />
		</>
	);
}
