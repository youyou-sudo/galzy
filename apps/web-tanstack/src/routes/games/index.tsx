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
import { waitForViewTransitionEnd } from "@web/lib/view-transition";
import { getGameList } from "@web/server/game";
import { r18Store } from "@web/stores/r18Store";
import { ArrowUpDown, Flame, ListFilter } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { object, string } from "zod/schemas";

/** 上次点击的游戏 id：回程时从列表页返回该卡，且只有它保留 view-transition-name
 * 与详情页封面/标题配对（2N group → 2）。sessionStorage 保证刷新/重开后仍有效。 */
const CLICKED_GAME_KEY = "galzy:clicked-game";
/** 点击瞬间记录的 window.scrollY：虚拟列表离开时 DOM 高度不完整，
 * 浏览器原生 scrollRestoration 恢复失败，回程据此精确落位（误差 <50px）。 */
const CLICKED_GAME_SCROLL_KEY = "galzy:games-scroll-y";
/** 被点卡片顶部的文档绝对位置（handleActivate 同步实测）。 */
const CLICKED_GAME_CARD_TOP_KEY = "galzy:games-card-top";
/** 点击瞬间卡片顶部相对视口的偏移（cardTop − scrollY）。
 * 恢复目标 scrollY = 回程实测 cardTop − 该偏移：header 高度变化等
 * 系统噪音在差值中抵消，被点卡回到点击时的视口位置。 */
const CLICKED_GAME_CARD_OFFSET_KEY = "galzy:games-card-offset";
/** 点击瞬间记录的 virtualizer.takeSnapshot()：上方所有行的真实测量尺寸。
 * 回程时作为 initialMeasurementsCache 预埋 —— 重挂载后各行 offset 直接就是
 * 真实值，resizeItem 不再产生 delta，也就不会触发 applyScrollAdjustment
 * 把 window.scrollY 推离保存的位置（这正是之前 +100~200px 漂移的根因）。 */
const CLICKED_GAME_SNAPSHOT_KEY = "galzy:games-snapshot";
/** 点击瞬间当前 history 条目的 __TSR_key（TanStack Router 写入 history.state）。
 * SPA 返回（popstate）时浏览器会恢复出该条目的 state —— 若本次挂载时
 * history.state.__TSR_key 与保存值一致，即可确认这是「回程」而非首次加载
 * /F5（后两者 key 不同）。这是 SPA 内可靠的 back 判定（performance
 * navigation.type 在 SPA 里永远是 navigate，不能用于区分返回）。 */
const CLICKED_GAME_HISTORY_KEY = "galzy:games-history-key";

/** 保存当前 history 条目的 key：供返回判定使用。 */
function readHistoryEntryKey(): string | null {
	return readSessionStorage(CLICKED_GAME_HISTORY_KEY);
}

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

function readStoredNumber(key: string): number | null {
	const raw = readSessionStorage(key);
	if (raw === null) return null;
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
}

type SnapshotRow = {
	index: number;
	key: string | number;
	start: number;
	size: number;
	end: number;
	lane: number;
};

function readSnapshot(): SnapshotRow[] | null {
	const raw = readSessionStorage(CLICKED_GAME_SNAPSHOT_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return null;
		const rows = parsed.filter(
			(row): row is SnapshotRow =>
				!!row &&
				typeof row === "object" &&
				typeof (row as SnapshotRow).index === "number" &&
				typeof (row as SnapshotRow).start === "number" &&
				typeof (row as SnapshotRow).size === "number" &&
				typeof (row as SnapshotRow).end === "number",
		);
		return rows.length > 0 ? rows : null;
	} catch {
		return null;
	}
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
		// 已访问过的排序/筛选组合直接命中缓存，排序切换零等待；首次访问只做一次请求。
		// staleTime 与组件内 useInfiniteQuery 对齐：30s 内切回已看过的组合纯缓存命中。
		const ensure = context.queryClient.ensureInfiniteQueryData({
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
			staleTime: 30_000,
		});
		if (typeof window === "undefined") {
			// SSR：等待数据，保证首屏直出与 query 脱水
			await ensure;
		} else {
			// 客户端导航：不阻塞路由切换 —— await 会因 defaultPendingMs=60 把整页
			// 换成 pendingComponent（全屏骨架）。不等待时加载态由组件内
			// useInfiniteQuery 的 isLoading → 底部 GameCard.ListSkeleton 承担。
			void ensure.catch(() => {});
		}
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
	// 精确滚动恢复：点击瞬间记录 scrollY + 测量快照，返回时据此落位。
	// useCallback 稳定引用：memo(Item) 的 props 比较不受父组件重渲染影响，
	// 只有 clickedId 变化的两张卡（旧配对/新被点）会更新。
	// virtualizer 引用通过 ref 持有（创建顺序在下方，回调执行时已就绪）。
	// 类型用 Parameters 兜底：takeSnapshot 返回的 VirtualItem.key 可能是 bigint，
	// 序列化进 sessionStorage 前 JSON.stringify 会抛错，由 try/catch 兜住。
	const virtualizerRef = useRef<{
		takeSnapshot: () => Array<{
			index: number;
			key: unknown;
			start: number;
			size: number;
			end: number;
			lane: number;
		}>;
	} | null>(null);
	const handleActivate = useCallback((id: string, cardTopY?: number) => {
		setClickedId(id);
		try {
			sessionStorage.setItem(CLICKED_GAME_KEY, id);
			const scrollY = window.scrollY || 0;
			// 被点卡片顶部的文档绝对位置（调用方同步实测传入）。
			// 同时记录：绝对 scrollY + 卡片顶 + 卡片视口偏移。
			// 回程恢复 = 回程实测 cardTop − 点击时视口偏移：
			// 差值抵消 header 高度变化等系统噪音，被点卡回到点击时视口位置。
			if (typeof cardTopY === "number" && Number.isFinite(cardTopY)) {
				const top = Math.max(0, cardTopY);
				sessionStorage.setItem(CLICKED_GAME_SCROLL_KEY, String(scrollY));
				sessionStorage.setItem(CLICKED_GAME_CARD_TOP_KEY, String(top));
				sessionStorage.setItem(
					CLICKED_GAME_CARD_OFFSET_KEY,
					String(top - scrollY),
				);
			} else {
				sessionStorage.setItem(CLICKED_GAME_SCROLL_KEY, String(scrollY));
			}
			// 同时记录测量快照：上方所有行的真实尺寸回程时预埋，
			// 防止 resizeItem 的 delta 触发 applyScrollAdjustment 漂移 scrollY。
			const snapshot = virtualizerRef.current?.takeSnapshot();
			if (snapshot && snapshot.length > 0) {
				try {
					sessionStorage.setItem(
						CLICKED_GAME_SNAPSHOT_KEY,
						JSON.stringify(snapshot),
					);
				} catch {
					// 快照过大写不进 storage：回退到纯 scrollY 恢复
					sessionStorage.removeItem(CLICKED_GAME_SNAPSHOT_KEY);
				}
			}
			// 记录当前 history 条目的 key：SPA 返回（popstate）时浏览器
			// 会恢复出同一 key 的 history.state，用它精确判定「回程」。
			sessionStorage.setItem(
				CLICKED_GAME_HISTORY_KEY,
				window.history.state?.__TSR_key ?? "",
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

	// 点击瞬间保存的测量快照：重挂载时预埋，上方各行 offset 直接就是真实值。
	// 无快照（如首次访问/旧版）时传空数组，行为与之前一致。
	const initialSnapshot = useMemo(() => readSnapshot() ?? [], []);
	const rowCount = Math.ceil(flatItems.length / cols);
	// 点击瞬间记录的绝对 scrollY：回程恢复目标（见下方 restore effect）。
	const savedRestoreY = useMemo(readClickedScrollY, []);
	// 被点卡片顶的文档绝对位置 + 点击时卡片在视口内的偏移。
	// 恢复目标 scrollY = 回程实测 cardTop − 点击时视口偏移：差值抵消
	// header 高度变化等系统噪音，被点卡精确回到点击时的视口位置。
	const savedCardTop = useMemo(
		() => readStoredNumber(CLICKED_GAME_CARD_TOP_KEY),
		[],
	);
	const savedCardViewportOffset = useMemo(
		() => readStoredNumber(CLICKED_GAME_CARD_OFFSET_KEY),
		[],
	);
	// 返回导航（SPA POP）时浏览器在「新页第一次提交」时采集 VT 新快照：
	// 若列表此刻仍在顶部，被点卡还没渲染/没挂 view-transition-name，
	// 详情页封面就没有配对元素，回程动画必然缺失。解决办法是把「目标滚动位置」
	// 作为 initialOffset 预埋：virtualizer 在首个 layout effect 就会
	// `scrollToOffset(savedY)`，配合 initialMeasurementsCache 的预埋真实行高，
	// 首次提交时目标行（含被点卡）就直接处于视口内、且带 view-transition-name。
	// 这样浏览器为新快照采集到的就是「正确的恢复位置 + 带名字的卡片」，
	// 既修复了回程位置错误，也修复了回程 VT 动画缺失。
	// 只有确认「本次确实是回程」才预埋：当前 history 条目的 __TSR_key 必须
	// 与点击瞬间一致（SPA 返回会恢复出同一 key；F5/直达时 key 是新生成的）。
	const isReturnNavigation =
		typeof window !== "undefined" &&
		(window.history.state?.__TSR_key ?? "") === readHistoryEntryKey();
	const restoreTriggerRequested =
		isReturnNavigation && savedRestoreY !== null && savedRestoreY > 0;
	const virtualizer = useWindowVirtualizer({
		count: rowCount,
		// 行高估算：封面 13/9 + 标题 ~34px + gap 16；挂载后 measure 校准
		estimateSize: () => 320,
		overscan: 3,
		gap: 16,
		// 回程时预埋真实测量：resizeItem 全是 0 delta，不触发
		// applyScrollAdjustment 漂移 scrollY（见文件顶部注释）。
		initialMeasurementsCache: initialSnapshot,
		// 回程（SPA 返回）时把目标滚动位置设为初始偏移：
		// - 首个 layout effect 的 _scrollToOffset 会直接滚到该位置；
		// - 配合 initialMeasurementsCache 预埋行高，首帧就能渲染出被点卡，
		//   使浏览器 VT 新快照包含「带名字的卡片」→ 回程动画恢复。
		// 只在确认是"返回"时启用，否则普通进入/刷新为 0（默认）。
		...(restoreTriggerRequested ? { initialOffset: () => savedRestoreY } : {}),
	});
	useEffect(() => {
		virtualizerRef.current = virtualizer;
	}, [virtualizer]);

	const virtualItems = virtualizer.getVirtualItems();

	// 返回列表：基于 clickedId + 保存的绝对 scrollY 精确恢复。
	// 恢复成立的前提（缺一即放弃恢复，保持当前位置）：
	//   1. clickedId 在当前数据中（排序/搜索变化导致 id 不在 → 不恢复）；
	//   2. 有保存的 scrollY；
	//   3. 本次是「回程」：当前 history 条目的 __TSR_key 与点击瞬间一致。
	//      （SPA 内 popstate 返回会恢复出同一 key 的 history.state；
	//      首次加载/F5/直接输入 URL 的 key 是新生成的，天然不匹配。）
	//      注意不能用 performance.navigation.type —— SPA 返回不触发整页重载，
	//      其值始终是 'navigate'，无法区分返回与首次进入。
	const scrollRestoredRef = useRef(false);
	const restoreTargetRow = useMemo(() => {
		if (!clickedId) return -1;
		const idx = flatItems.findIndex((item) => item.id === clickedId);
		if (idx < 0) return -1;
		return Math.floor(idx / cols);
	}, [clickedId, flatItems, cols]);

	// 快照的行号是点击时的数据布局：若本次挂载的 queryKey（排序/搜索/R18）
	// 与点击时不同，行号/offset 全部失效 —— 必须放弃恢复并清理旧记录。
	// 注意：只校验「目标行之前」的行 —— 点击后新加载的更多页（rowCount 变大）
	// 不影响上方各行的 offset 预埋，仍可精确恢复；仅数据排列变化才无效。
	const restoreValid = useMemo(() => {
		const snapshot = initialSnapshot;
		if (snapshot.length === 0) return true;
		const targetIdx = flatItems.findIndex((item) => item.id === clickedId);
		if (targetIdx < 0 && clickedId) {
			// 被点击的卡在当前数据中不存在（排序/搜索变化）→ 放弃恢复
			return false;
		}
		return snapshot.every((row) => row.index < rowCount);
	}, [rowCount, clickedId, flatItems]);
	useEffect(() => {
		// 仅在有配对 id 且数据已就绪时恢复一次
		if (restoreTargetRow < 0 || scrollRestoredRef.current) return;
		const savedY = savedRestoreY;
		if (savedY === null || !restoreValid) {
			// 没有精确记录，或数据布局已变 → 不恢复，保持当前位置
			scrollRestoredRef.current = true;
			return;
		}
		// SPA 内返回判定：当前 history 条目的 key 必须与点击时一致。
		// 首次加载/F5/直达 URL 时 key 是新生成的，与存储值不同 → 不恢复。
		if (!isReturnNavigation) {
			scrollRestoredRef.current = true;
			return;
		}
		if (savedY <= 0) {
			// 目标在首屏附近：无需恢复，直接标记完成
			scrollRestoredRef.current = true;
			return;
		}
		let cancelled = false;
		const cancelRef: { current: () => void } = { current: () => {} };
		// 恢复逻辑（配合 initialOffset 预埋目标滚动位置）：
		//   initialOffset 让 virtualizer 在首个 layout effect 就滚动到 savedY，
		//   因此首帧渲染出的就是目标行的卡片（含被点卡的 view-transition-name），
		//   浏览器 POP 过渡的新快照能正确捕捉它 → 回程 VT 动画成立。
		//   这里只做一次「卡片回到点击时视口位置」的微调，且等到路由
		//   View Transition 结束后才执行——动画中途改滚动位置会破坏
		//   快照伪元素的对齐，产生跳变。
		void (async () => {
			// 等待当前 VT 结束（含 POP 过渡），再跑微调
			try {
				await waitForViewTransitionEnd();
			} catch {
				// 忽略
			}
			if (cancelled) return;
			let frames = 0;
			const tick = () => {
				if (cancelled) return;
				frames++;
				// 目标行已挂载（virtualItems 命中）且稳定两帧后，做一次亚像素修正
				const hasTargetRow = virtualizer
					.getVirtualItems()
					.some((item) => item.index === restoreTargetRow);
				if (hasTargetRow && frames >= 2) {
					const cardEl = document.querySelector(
						`[style*="game-cover-${CSS.escape(clickedId ?? "")}"]`,
					);
					let finalY = savedY;
					if (cardEl) {
						const cardTopNow =
							cardEl.getBoundingClientRect().top + window.scrollY;
						const viewportOffset =
							savedCardViewportOffset ??
							(savedCardTop !== null ? savedCardTop - savedY : null);
						if (viewportOffset !== null) {
							finalY = Math.max(0, cardTopNow - viewportOffset);
						}
						// 与当前相差 < 2px：不滚动（避免无谓的一次帧写）
						if (Math.abs(finalY - window.scrollY) < 2) {
							scrollRestoredRef.current = true;
							return;
						}
					}
					scrollRestoredRef.current = true;
					virtualizer.scrollToOffset(finalY, { align: "start" });
					return;
				}
				// 最多等 60 帧（约 1s）：宁可先落位也不让用户卡在顶部。
				if (frames >= 60) {
					scrollRestoredRef.current = true;
					virtualizer.scrollToOffset(savedY, { align: "start" });
					return;
				}
				requestAnimationFrame(tick);
			};
			const raf = requestAnimationFrame(tick);
			cancelRef.current = () => {
				cancelled = true;
				cancelAnimationFrame(raf);
			};
		})();
		return () => {
			cancelled = true;
			cancelRef.current();
		};
	}, [
		restoreTargetRow,
		virtualizer,
		savedRestoreY,
		restoreValid,
		clickedId,
		savedCardTop,
		savedCardViewportOffset,
	]);

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

			<div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
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
			</div>

			{isLoading || isFetchingNextPage ? (
				<div className="grid grid-cols-3 md:grid-cols-6 gap-4 mt-4">
					<GameCard.ListSkeleton />
					<GameCard.ListSkeleton />
					<GameCard.ListSkeleton />
					<GameCard.ListSkeleton />
					<GameCard.ListSkeleton />
					<GameCard.ListSkeleton />
				</div>
			) : null}

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
