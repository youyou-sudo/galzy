import { EmptyState } from "@web/components/shared/empty-state";
import {
	chartStats,
	GraphView,
	OrderView,
	segmentAnchorId,
} from "@web/components/walkthrough/chart";
import { useShallowSearch } from "@web/lib/admin/use-shallow-search";
import { Route } from "lucide-react";
import { useCallback, useMemo } from "react";
import {
	isWalkthroughLang,
	isWalkthroughView,
	readWalkthroughDetail,
	type WalkthroughLang,
	type WalkthroughView,
} from "./types";
import { WalkthroughLegend } from "./walkthrough-legend";
import { WalkthroughOverview } from "./walkthrough-overview";
import { WalkthroughRoutes } from "./walkthrough-routes";
import { WalkthroughSegments } from "./walkthrough-segments";
import { WalkthroughToolbar } from "./walkthrough-toolbar";

/** 详情页的页内状态：全部落在地址栏，刷新/分享能还原同一个视图 */
type WalkthroughSearch = {
	view?: string;
	lang?: string;
	character?: string;
};

const SEARCH_DEFAULTS: Partial<WalkthroughSearch> = {
	view: "character",
	lang: "both",
};

/**
 * 攻略详情外壳。
 *
 * 数据全部来自页面 loader（SSR 首屏即有），页内只切 view / lang / character
 * 三个查询参数——用 useShallowSearch 改地址栏而不是 router.navigate：
 * 后者会让 furin 重新请求一次 `?_furin=data` 并重挂载整页，切个视图要等一次往返。
 */
export function WalkthroughPage({
	data,
	gameId,
	releasedAt,
	companies,
	initialView,
	initialLang,
	initialCharacter,
}: {
	data: unknown;
	gameId: string;
	/** 作品的首次发售日（概览块的「发售日期」） */
	releasedAt?: string | null;
	/** 作品的厂商展示名（概览块的「制作会社」，来自 game.producers） */
	companies?: string[];
	initialView?: string;
	initialLang?: string;
	initialCharacter?: string;
}) {
	const detail = useMemo(() => readWalkthroughDetail(data), [data]);
	const [search, setSearch] = useShallowSearch<WalkthroughSearch>(
		{
			view: initialView,
			lang: initialLang,
			character: initialCharacter,
		},
		SEARCH_DEFAULTS,
	);

	// URL 里的旧值/手改值落到默认视图，而不是把整页打成 500
	const view: WalkthroughView = isWalkthroughView(search.view)
		? search.view
		: "character";
	const lang: WalkthroughLang = isWalkthroughLang(search.lang)
		? search.lang
		: "both";

	const chart = detail?.chart ?? null;
	const stats = useMemo(() => (chart ? chartStats(chart) : null), [chart]);
	const characters = detail?.characters ?? [];

	// 链接里的 character 可能是旧 key（攻略更新后角色被删）：不认识就当没选
	const requestedCharacter = search.character?.trim() || null;
	const characterKey = characters.some(
		(item) => item.key === requestedCharacter,
	)
		? requestedCharacter
		: null;

	const scrollToSegment = useCallback((segmentKey: string) => {
		if (typeof document === "undefined") return;
		document
			.getElementById(segmentAnchorId(segmentKey))
			?.scrollIntoView({ behavior: "smooth", block: "start" });
	}, []);

	/**
	 * 流程图里点节点/边：锚点只存在于顺序视图（OrderView），所以先切视图，
	 * 下一帧再滚——同一帧里刚 setState 的 DOM 还没渲染出来，直接查会扑空。
	 */
	const handleGraphSegment = useCallback(
		(segmentKey: string) => {
			setSearch({ view: "order" });
			if (typeof requestAnimationFrame !== "function") return;
			requestAnimationFrame(() => scrollToSegment(segmentKey));
		},
		[scrollToSegment, setSearch],
	);

	const handleViewChange = useCallback(
		(next: WalkthroughView) => setSearch({ view: next }),
		[setSearch],
	);
	const handleLangChange = useCallback(
		(next: WalkthroughLang) => setSearch({ lang: next }),
		[setSearch],
	);
	const handleCharacterChange = useCallback(
		(next: string | null) => {
			setSearch((previous) => ({
				character: next ?? undefined,
				// 选角色即进入「按角色」；清空选择时保持当前视图
				view: next ? "character" : previous.view,
			}));
		},
		[setSearch],
	);

	if (!detail) {
		return (
			<EmptyState
				description="这份攻略可能已被移除，回到游戏页面看看其它内容"
				icon={Route}
				size="sm"
				title="攻略不存在"
			/>
		);
	}

	return (
		<div className="space-y-6">
			<WalkthroughOverview
				companies={companies}
				detail={detail}
				gameId={gameId}
				releasedAt={releasedAt}
			/>
			{chart && stats ? (
				<>
					<WalkthroughRoutes
						characters={characters}
						onSelect={handleCharacterChange}
						selectedKey={characterKey}
						stats={stats}
					/>
					<div className="space-y-4">
						<WalkthroughToolbar
							lang={lang}
							onLangChange={handleLangChange}
							// 参考站的「显示全部路线」只出现在流程图视图：那张图按角色
							// 过滤后会少一半节点，必须有一步能退回来
							onShowAll={
								view === "graph" && characterKey
									? () => handleCharacterChange(null)
									: undefined
							}
							onViewChange={handleViewChange}
							view={view}
						/>
						{view === "graph" ? (
							<GraphView
								chart={chart}
								characterKey={characterKey}
								lang={lang}
								onSegmentSelect={handleGraphSegment}
							/>
						) : (
							<>
								{/* 按角色与按顺序共用同一套段落卡片：两页只有 URL 不同，
								    所以不写两套布局，只是过滤条件跟着 characterKey 走 */}
								<WalkthroughSegments
									characterKey={characterKey}
									chart={chart}
									lang={lang}
									onSelect={scrollToSegment}
								/>
								<OrderView
									characterKey={characterKey}
									chart={chart}
									lang={lang}
								/>
							</>
						)}
						<WalkthroughLegend chart={chart} lang={lang} />
					</div>
				</>
			) : (
				<EmptyState
					description="这份攻略还没有可展示的选项流程"
					icon={Route}
					size="sm"
					title="暂无流程数据"
				/>
			)}
		</div>
	);
}
