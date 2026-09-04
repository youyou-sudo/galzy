import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { GameCard } from "@web/components/home/card";
import SearchInput from "@web/components/home/search/Search";
import { GameListPageSkeleton } from "@web/components/shared/route-skeletons";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/ui/breadcrumb";
import { Button } from "@web/components/ui/button";
import { seoTemplate } from "@web/config/seoTemplate";
import { seoMeta } from "@web/lib/seo";
import { getGameList } from "@web/server/game";
import { r18Store } from "@web/stores/r18Store";
import { ArrowUpDown, Flame, ListFilter } from "lucide-react";
import { object, string } from "zod/schemas";

const searchSchema = object({
	q: string().optional().default(""),
	startDate: string().optional(),
	endDate: string().optional(),
	sortBy: string().optional().default("released"),
	order: string().optional().default("desc"),
});

export const Route = createFileRoute("/games/")({
	component: RouteComponent,
	pendingComponent: () => <GameListPageSkeleton />,
	head: () =>
		seoMeta({
			title: `全部游戏 | ${seoTemplate.title}`,
			description:
				"浏览 GalZY 收录的全部汉化 Galgame，支持按发售日期排序、按名称搜索，电脑端与手机端资源齐全。",
			path: "/games",
		}),
	validateSearch: searchSchema,
	loaderDeps: ({ search: { q, startDate, endDate, sortBy, order } }) => ({
		q,
		startDate,
		endDate,
		sortBy,
		order,
	}),
	loader: async ({
		deps: { q, startDate, endDate, sortBy, order },
		context,
	}) => {
		// 搜索模式（q 存在）不启用 R18 过滤，敏感图片由卡片模糊组件兜底
		const showR18 = q ? undefined : r18Store.state.showR18;
		// 预取/复用 useInfiniteQuery 缓存（queryKey 与其完全一致）：
		// 已访问过的排序/筛选组合直接命中缓存，排序切换零等待；首次访问只做一次请求
		await context.queryClient.ensureInfiniteQueryData({
			queryKey: [
				"gameList",
				q,
				startDate,
				endDate,
				sortBy,
				order,
				q ? "search" : showR18,
			],
			queryFn: async ({ pageParam }) => {
				const { gamelist } = await getGameList({
					data: {
						pageIndex: pageParam,
						pageSize: 24,
						sortBy,
						order,
						q,
						startDate,
						endDate,
						showR18,
					},
				});
				return gamelist ?? null;
			},
			initialPageParam: 0,
			getNextPageParam: (
				lastPage: { currentPage: number; totalPages: number } | null,
			) =>
				lastPage && lastPage.currentPage < lastPage.totalPages
					? lastPage.currentPage + 1
					: null,
		});
		return {};
	},
	headers: () => ({
		"Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
		"Cache-Tag": "page-games",
		Vary: "Accept, Accept-Encoding",
	}),
});

function RouteComponent() {
	const { q, startDate, endDate, sortBy, order } = Route.useSearch();
	const storeShowR18 = useSelector(r18Store, (s) => s.showR18);
	// 搜索模式（q 存在）不启用 R18 过滤，敏感图片由卡片模糊组件兜底
	const showR18 = q ? undefined : storeShowR18;
	const navigate = Route.useNavigate();

	const {
		data: gameListData,
		isLoading,
		isFetchingNextPage,
		fetchNextPage,
		hasNextPage,
	} = useInfiniteQuery({
		queryKey: [
			"gameList",
			q,
			startDate,
			endDate,
			sortBy,
			order,
			q ? "search" : storeShowR18,
		],
		queryFn: async ({ pageParam }) => {
			const { gamelist } = await getGameList({
				data: {
					pageIndex: pageParam,
					pageSize: 24,
					sortBy,
					order,
					q,
					startDate,
					endDate,
					showR18,
				},
			});
			return gamelist ?? null;
		},
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage && lastPage.currentPage < lastPage.totalPages
				? lastPage.currentPage + 1
				: null,
	});

	const gameList = gameListData?.pages.flatMap((page) =>
		page?.items?.map((item) => (
			<GameCard.Item
				key={item.id}
				gameid={String(item.id)}
				width={item.images?.width ?? 200}
				height={item.images?.height ?? 300}
				thumbhash={item.images?.thumbhash}
				src={item.images?.imageUrl ?? "/No-Image-Placeholder.svg.webp"}
				cSexualAvg={item.images?.c_sexual_avg}
				title={
					item?.titles_obj?.find(
						(t: { lang: string | null; title: string | null }) =>
							t.lang === item.olang && (t.title ?? "").trim() !== "",
					)?.title || "null"
				}
			/>
		)),
	);

	return (
		<div>
			<Breadcrumb className="mb-4">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>全部游戏</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className="mb-6">
				<h1 className="text-2xl font-semibold">全部游戏</h1>
				<p className="text-sm text-muted-foreground mt-1">
					浏览所有收录的 Galgame 作品
				</p>
			</div>

			<div className="mx-auto w-full max-w-lg mb-6">
				<SearchInput />
			</div>

			<div className="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b">
				<ListFilter className="size-4 text-muted-foreground shrink-0" />
				<span className="text-sm text-muted-foreground shrink-0">排序：</span>
				<Button
					variant={sortBy === "released" ? "default" : "outline"}
					size="sm"
					onClick={() =>
						navigate({
							search: { q, startDate, endDate, sortBy: "released", order },
						})
					}
				>
					发布时间
				</Button>
				<Button
					variant={sortBy === "downloads" ? "default" : "outline"}
					size="sm"
					onClick={() =>
						navigate({
							search: { q, startDate, endDate, sortBy: "downloads", order },
						})
					}
				>
					下载量
				</Button>
				<Button
					variant={sortBy === "views" ? "default" : "outline"}
					size="sm"
					onClick={() =>
						navigate({
							search: { q, startDate, endDate, sortBy: "views", order },
						})
					}
				>
					浏览量
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() =>
						navigate({
							search: {
								q,
								startDate,
								endDate,
								sortBy,
								order: order === "desc" ? "asc" : "desc",
							},
						})
					}
					className="ml-auto"
				>
					<ArrowUpDown className="size-3.5 mr-1" />
					{order === "desc" ? "降序" : "升序"}
				</Button>
			</div>

			<div className="grid grid-cols-3 md:grid-cols-6 gap-4">
				{gameList}
				{isLoading || isFetchingNextPage ? (
					<>
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
					</>
				) : null}
			</div>

			{hasNextPage && (
				<div className="flex justify-center mt-8">
					<Button
						size="lg"
						onClick={() => fetchNextPage()}
						disabled={isFetchingNextPage}
					>
						{isFetchingNextPage ? "加载中..." : "加载更多"}
					</Button>
				</div>
			)}

			{!isLoading && (!gameList || gameList.length === 0) && (
				<div className="text-center py-20 text-muted-foreground">
					<Flame className="size-12 mx-auto mb-3 opacity-30" />
					<p>暂无游戏数据</p>
				</div>
			)}
		</div>
	);
}
