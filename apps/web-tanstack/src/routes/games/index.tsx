import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
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
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { object, string } from "zod/schemas";

/** 上次点击的游戏 id：回程时从列表页返回该卡，且只有它保留 view-transition-name
 * 与详情页封面/标题配对（2N group → 2）。sessionStorage 保证刷新/重开后仍有效。 */
const CLICKED_GAME_KEY = "galzy:clicked-game";
/** 点击瞬间记录的 window.scrollY：虚拟列表离开时 DOM 高度不完整，
 * 浏览器原生 scrollRestoration 恢复失败，回程据此精确落位（误差 <50px）。 */
const CLICKED_GAME_SCROLL_KEY = "galzy:games-scroll-y";

function readSessionStorage(key: string): string | null {
	try {
		if (typeof sessionStorage === "undefined") return null;
		return sessionStorage.getItem(key);
	} catch {
		return null;
	}
}

function readClickedGame(): string | null {
	return readSessionStorage(CLICKED_GAME_KEY);
}

function readClickedScrollY(): number | null {
	const raw = readSessionStorage(CLICKED_GAME_SCROLL_KEY);
	if (raw === null) return null;
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
}

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
	// 回程配对：初始值从 sessionStorage 恢复（刷新/重开后回程仍有动画）
	const [clickedId, setClickedId] = useState<string | null>(() =>
		readClickedGame(),
	);
	// 精确滚动恢复：点击瞬间记录 scrollY，返回时据此落位（见下方恢复 effect）。
	// useCallback 稳定引用：memo(Item) 的 props 比较不受父组件重渲染影响，
	// 只有 clickedId 变化的两张卡（旧配对/新被点）会更新。
	const handleActivate = useCallback((id: string) => {
		setClickedId(id);
		try {
			sessionStorage.setItem(CLICKED_GAME_KEY, id);
			// 点击的同步瞬间记录滚动位置：VT 与导航可能改变 DOM，但 scrollY
			// 在这一帧最接近真实位置；返回时精确恢复。
			sessionStorage.setItem(
				CLICKED_GAME_SCROLL_KEY,
				String(window.scrollY || 0),
			);
		} catch {
			// sessionStorage 不可用时仅影响回程动画配对与精确恢复
		}
	}, []);

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
		initialPageParam: 0,
		getNextPageParam: (lastPage) =>
			lastPage && lastPage.currentPage < lastPage.totalPages
				? lastPage.currentPage + 1
				: null,
		// 返回列表页时直接用缓存渲染，不 refetch 第一页：避免挂载瞬间整屏网格重建
		// 造成顿挫/闪烁（配合路由 defaultPreloadStaleTime 30s 的预热窗口）
		staleTime: 30_000,
		refetchOnMount: false,
	});

	// 扁平数据（稳定引用，供虚拟列表与 useMemo 消费）
	const flatItems = useMemo(() => {
		const pages = gameListData?.pages ?? [];
		const out: Array<{
			key: string | number;
			id: string;
			width: number;
			height: number;
			thumbhash?: string | null;
			src: string;
			cSexualAvg?: number | null;
			title: string;
			/** 在整个列表中的序号：首屏行优先加载图片 */
			index: number;
		}> = [];
		let index = 0;
		for (const page of pages) {
			for (const item of page?.items ?? []) {
				const id = String(item.id);
				out.push({
					key: item.id,
					id,
					width: item.images?.width ?? 200,
					height: item.images?.height ?? 300,
					thumbhash: item.images?.thumbhash,
					src: item.images?.imageUrl ?? "/No-Image-Placeholder.svg.webp",
					cSexualAvg: item.images?.c_sexual_avg,
					title:
						item?.titles_obj?.find(
							(t: { lang: string | null; title: string | null }) =>
								t.lang === item.olang && (t.title ?? "").trim() !== "",
						)?.title || "null",
					index: index++,
				});
			}
		}
		return out;
	}, [gameListData]);

	// 列数与下方 grid 断点对齐：移动端 3 列、md+ 6 列
	const [cols, setCols] = useState(() =>
		typeof window !== "undefined" && window.innerWidth >= 768 ? 6 : 3,
	);
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 768px)");
		const onChange = (e: MediaQueryListEvent) => setCols(e.matches ? 6 : 3);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);

	// 排序/搜索/R18 变化 → 数据重置，回顶部并重置虚拟滚动位置
	const queryKey = `${q}|${startDate}|${endDate}|${sortBy}|${order}|${q ? "search" : storeShowR18}`;
	const prevQueryKey = useRef(queryKey);
	useEffect(() => {
		if (prevQueryKey.current !== queryKey) {
			prevQueryKey.current = queryKey;
			window.scrollTo(0, 0);
		}
	}, [queryKey]);

	const rowCount = Math.ceil(flatItems.length / cols);
	const virtualizer = useWindowVirtualizer({
		count: rowCount,
		// 行高估算：封面 13/9 + 标题 ~34px + gap 16；挂载后 measure 校准
		estimateSize: () => 320,
		overscan: 3,
		gap: 16,
	});

	const virtualItems = virtualizer.getVirtualItems();

	// 返回列表：基于 clickedId 精确滚动恢复。
	// 虚拟化下 DOM 高度不完整，TanStack scrollRestoration 恢复必然不准；
	// 这里点卡瞬间记录过 scrollY（点击时绝对位置），返回后：
	//   1. 先 scrollToIndex(clickedId 所在行) —— 触发该行渲染与 measure，
	//      让 virtualizer 拿到真实的逐行 offset；
	//   2. 下一帧再 window.scrollTo(记录值) 精确覆盖 —— 行高测量完成后
	//      内容绝对位置固定，这一帧位置就是真实内容停靠点，误差 ≈ 0。
	const scrollRestoredRef = useRef(false);
	const restoreTargetRow = useMemo(() => {
		if (!clickedId) return -1;
		const idx = flatItems.findIndex((item) => item.id === clickedId);
		if (idx < 0) return -1;
		return Math.floor(idx / cols);
	}, [clickedId, flatItems, cols]);

	const savedRestoreY = useMemo(readClickedScrollY, []);
	useEffect(() => {
		// 仅在有配对 id 且数据已就绪时恢复一次
		if (restoreTargetRow < 0 || scrollRestoredRef.current) return;
		scrollRestoredRef.current = true;
		const savedY = savedRestoreY;
		if (savedY === null) {
			// 没有精确记录（如旧版/手动刷新）→ scrollToIndex 兜底居中
			virtualizer.scrollToIndex(restoreTargetRow, { align: "auto" });
			return;
		}
		// 先锚定目标行（强制渲染 + 异步 measureElement 写真实行高），
		// 双 rAF 后再覆盖精确记录 —— 此时逐行 offset 已与真实布局一致，
		// window.scrollTo(savedY) 落在的实际内容位置与点击时相同（误差≈0）。
		virtualizer.scrollToIndex(restoreTargetRow, { align: "start" });
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				window.scrollTo(0, savedY);
			});
		});
	}, [restoreTargetRow, virtualizer, savedRestoreY]);

	// useMemo + memo(Item)：fetchNextPage / 返回挂载时只新增/复用节点，
	// 已有卡 props 不变则跳过重渲染；showR18 变化才全量更新（预期行为）。
	// 虚拟化后只渲染可视行：10 页（240 卡）的常驻 DOM 从 240 降到 ~5 行 × cols。
	const gameList = useMemo(() => {
		const renderRow = (rowIndex: number) => {
			const cells = [];
			for (let c = 0; c < cols; c++) {
				const item = flatItems[rowIndex * cols + c];
				if (!item) break;
				cells.push(
					<GameCard.Item
						key={item.key}
						gameid={item.id}
						width={item.width}
						height={item.height}
						thumbhash={item.thumbhash}
						src={item.src}
						cSexualAvg={item.cSexualAvg}
						hasVT={clickedId !== null && clickedId === item.id}
						showR18={showR18}
						// 首行（3 列移动端 / 6 列桌面端取并集，首 6 张）优先加载
						fetchPriority={item.index < 6 ? "high" : "low"}
						onActivate={handleActivate}
						title={item.title}
					/>,
				);
			}
			return cells;
		};
		return { renderRow };
	}, [flatItems, cols, clickedId, showR18, handleActivate]);

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

			<div
				style={{ height: virtualizer.getTotalSize(), position: "relative" }}
			>
				{virtualItems.map((virtualRow) => (
					<div
						key={virtualRow.key}
						data-index={virtualRow.index}
						ref={virtualizer.measureElement}
						className="grid grid-cols-3 md:grid-cols-6 gap-4 absolute top-0 left-0 w-full"
						style={{ transform: `translateY(${virtualRow.start}px)` }}
					>
						{gameList.renderRow(virtualRow.index)}
					</div>
				))}
				{isLoading || isFetchingNextPage ? (
					<div
						className="grid grid-cols-3 md:grid-cols-6 gap-4 absolute left-0 w-full"
						style={{ transform: `translateY(${virtualizer.getTotalSize()}px)` }}
					>
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
					</div>
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

		{!isLoading && flatItems.length === 0 && (
				<div className="text-center py-20 text-muted-foreground">
					<Flame className="size-12 mx-auto mb-3 opacity-30" />
					<p>暂无游戏数据</p>
				</div>
			)}
		</div>
	);
}
