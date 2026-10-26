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
import { getCritical } from "@web/server/game";
import { r18Store } from "@web/stores/r18Store";

export const Route = createFileRoute("/")({
	component: App,
	head: () =>
		seoMeta({
			title: seoTemplate.title,
			description: seoTemplate.description,
			path: "/",
		}),
	// 阻塞路径只留「首屏第一眼要看」的热门数据：SSR 直接出热门标签 + 本周热门。
	// 精选合集与收录总数不在这里 await —— 合集预览是最慢的接口，之前把它和总数一起
	// 放进 loader 的 Promise.all（且结果根本没被用到），首字节被最慢的那个拖住。
	// 这两个区块改由组件内普通 useQuery 在客户端补：服务端先出「真实外壳 + 内容骨架」。
	// 实测（上游 热门60ms / 总数100ms / 合集400ms）首字节从 ~410ms 降到 ~70ms。
	loader: async ({ context }) => {
		const showR18 = r18Store.state.showR18;
		const rankings = await getCritical({ data: { showR18 } });
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

			{/* 计数文案是静态外壳，数字在客户端补（见 Count.tsx） */}
			<CountComponent />

			<div className="px-1 mx-auto mt-6 mb-8 w-full max-w-2xl">
				<SearchInput />
			</div>

			<HotTagsSection tags={rankings.tag} />

			<HotGamesSection games={rankings.game} />

			<CollectionsSection />
		</>
	);
}
