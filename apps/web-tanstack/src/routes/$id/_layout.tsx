import {
	createFileRoute,
	Link,
	redirect,
	useParams,
	useRouterState,
} from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { GameDetailPending } from "@web/components/game/game-detail-pending";
import GameLayoutPage from "@web/components/game/game-layout-page";
import { filelistQueryOptions } from "@web/components/home/game/download-options-queries";
import { gameTagsQueryOptions } from "@web/components/home/game/game-tags-queries";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import { seoTemplate } from "@web/config/seoTemplate";
import {
	canonicalGameId,
	isGameRouteId,
	isSameGameRouteId,
	normalizeGameRouteId,
} from "@web/lib/game-id";
import { gameTitleOf } from "@web/lib/seo";
import { getGameDetail } from "@web/server/game";
import { recordGameView } from "@web/server/views";
import { articleHeroStore } from "@web/stores/articleHeroStore";

export const Route = createFileRoute("/$id/_layout")({
	params: {
		parse: ({ id }) => {
			// 路由身份命名空间见 lib/game-id.ts：vNNN / dNNN（vndb 侧）与
			// kgX（kungal work id，大小写敏感、原样保留）。非法形态返回 false，
			// 由路由 404 兜底。
			if (!isGameRouteId(id)) return false;
			// v/d 归一为小写；kgX 只归一前缀，work id 保持原样（/kgAbC ≠ /kgabc）
			return {
				id: normalizeGameRouteId(id),
			};
		},
		stringify: ({ id }) => ({
			id,
		}),
	},
	loader: async ({ params, context }) => {
		const { id } = params;
		// 非阻塞预热 tags / filelist：在 await gameDetail 之前 fire-and-forget，
		// 保证 VT 动画开始前请求已发出（首访时响应大概率在动画结束前就绪，
		// 组件内 useQuery 挂载即缓存命中，不再于动画中途触发重渲染）。
		// 用 prefetchQuery 而非 ensureQueryData：不拖慢 loader 本身（VT 等待的是
		// gameDetail），prefetch 失败被内部吞掉，不影响导航。
		void context.queryClient.prefetchQuery(gameTagsQueryOptions(id));
		void context.queryClient.prefetchQuery(filelistQueryOptions(id));
		// 只阻塞 game，快速点击时首屏秒出；tags 由 TagsCard 组件内 useQuery 自行拉取，
		// 不进入导航关键路径（折叠面板，晚一拍出现无感知）。
		// ensureQueryData 同时把 game 写入查询缓存（key: gameDetail），
		// 由 persist 白名单持久化到 localStorage，刷新/重开后再次访问秒出。
		const game = await context.queryClient.ensureQueryData({
			queryKey: ["gameDetail", id],
			queryFn: () => getGameDetail({ data: { id } }),
			staleTime: 60_000,
		});
		// 契约 §5：canonicalId 是该条目的最终展示身份（有 vndb 锚点 → vNNN，
		// 否则 kgX）。请求 id 与展示身份不一致时（典型：旧的 /kgX 链接已被
		// vndb 锚点收编）302 到最终路由身份。必须 replace，别让别名页留在
		// 历史栈里造成后退死循环。
		const gameId = canonicalGameId(game, id);
		if (!isSameGameRouteId(gameId, id)) {
			// 把刚取到的数据挂到最终身份的缓存键上，redirect 后的第二次
			// loader 直接命中，不再多打一次 API。
			context.queryClient.setQueryData(["gameDetail", gameId], game);
			throw redirect({ to: "/$id", params: { id: gameId }, replace: true });
		}
		// loader 里的 id 一律是最终路由身份：head / Cache-Tag / recordGameView /
		// 子路由 Link 都跟随它，不再出现别名 id 与展示 id 混用。
		return {
			game,
			id: gameId,
		};
	},
	// 仅在真实进入页面(点击/直达/SSR 首屏)时计 view；悬停与空闲预加载不触发 onEnter，不会污染热榜
	onEnter: ({ params }) => {
		void recordGameView({ data: { id: params.id } }).catch(() => {
			// silently ignore recording failures
		});
	},
	pendingComponent: PendingComponent,
	head: ({ loaderData }) => {
		const title = gameTitleOf(loaderData?.game);
		return {
			meta: [
				{
					title: `${title} 下载 | ${seoTemplate.title}`,
				},
				{
					name: "description",
					content: `${title} 资源下载，游戏别名：${loaderData?.game?.vn?.alias || "无"}，简介：${loaderData?.game?.vn?.description || "暂无简介"}`,
				},
			],
		};
	},
	headers: ({ params }) => ({
		"Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
		"Cache-Tag": `game-${params.id},page-game`,
	}),
	staleTime: 60_000,
	gcTime: 5 * 60_000,

	component: () => {
		const loaderData = Route.useLoaderData();
		const routerState = useRouterState();
		const gameTitle = gameTitleOf(loaderData?.game);

		// Check if we're on an introduction article page
		const articleMatch = routerState.matches.find(
			(m) => m.routeId === "/$id/_layout/introduction/$articleId",
		);
		// pending 期间子路由的 loaderData 还没到：用列表入口回写的标题补上面包屑
		// 末项（与真实标题必然相同），末项不会等数据到达才「跳出来」
		const articleId = (
			articleMatch?.params as { articleId?: string } | undefined
		)?.articleId;
		const heroArticleTitle = useSelector(articleHeroStore, (state) =>
			state.id === articleId ? (state.data?.title ?? "") : "",
		);
		const articleTitle =
			(articleMatch?.loaderData as any)?.article?.title ||
			heroArticleTitle ||
			null;

		return (
			<div>
				<Breadcrumb className="mb-4">
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink render={<Link to="/games" />}>
								全部游戏
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink
								render={<Link to="/$id" params={{ id: loaderData.id }} />}
							>
								{gameTitle}
							</BreadcrumbLink>
						</BreadcrumbItem>
						{articleTitle && (
							<>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbLink
										render={
											<Link
												to="/$id/introduction"
												params={{ id: loaderData.id }}
											/>
										}
									>
										攻略
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage>{articleTitle}</BreadcrumbPage>
								</BreadcrumbItem>
							</>
						)}
					</BreadcrumbList>
				</Breadcrumb>
				<GameLayoutPage {...loaderData} />
			</div>
		);
	},
});

function PendingComponent() {
	const { id } = useParams({ from: "/$id/_layout" });
	return <GameDetailPending id={id} />;
}
