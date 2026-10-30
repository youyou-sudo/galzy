import { defineRoute } from "@teyik0/furin";
import CountComponent from "@web/components/home/Count";
import { CollectionsSection } from "@web/components/home/collections-section";
import { HomeHero } from "@web/components/home/home-hero";
import SearchInput from "@web/components/home/search/Search";
import { HotGamesSection } from "@web/components/home/hot-games-section";
import { HotTagsSection } from "@web/components/home/hot-tags-section";
import { seoTemplate } from "@web/config/seoTemplate";
import { useIdlePreload } from "@web/hooks/use-idle-preload";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { getCritical } from "@web/server/game";

type Rankings = Awaited<ReturnType<typeof getCritical>>;

export const route = defineRoute("/")
	.config({ mode: "ssr" })
	.loader(async () => {
		// R18 visibility lives in a client store; the server always renders the
		// safe variant and the client refetches with its own flag (same as before).
		const showR18 = false;
		const rankings = await getCritical({ data: { showR18 } });
		return { rankings, showR18 };
	})
	.head(() => seoMeta({ title: seoTemplate.title, description: seoTemplate.description, path: "/" }) as never)
	.page(({ rankings, showR18 }) => <HomePage rankings={rankings} showR18={showR18} />);

function HomePage({ rankings, showR18 }: { rankings: Rankings; showR18: boolean }) {
	useSeedQueries([[['hotGames', showR18], rankings.game]] as never);

	// 空闲预取「更多游戏 →」「更多合集 →」及标签/会社页，点击时即时命中缓存
	useIdlePreload([
		(router) => {
			void router.preloadRoute({ to: "/games", search: { sortBy: "downloads", order: "desc" } });
		},
		(router) => {
			void router.preloadRoute({ to: "/collections", search: { page: 1 } });
		},
		(router) => {
			void router.preloadRoute({ to: "/tags" });
		},
		(router) => {
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
			<div className="px-1 mx-auto mt-6 mb-8 w-full max-w-2xl">
				<SearchInput />
			</div>
			<HotTagsSection tags={rankings.tag} />
			<HotGamesSection games={rankings.game} />
			<CollectionsSection />
		</>
	);
}
