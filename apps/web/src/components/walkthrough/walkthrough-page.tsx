import {
	type CharacterView as RosterCharacter,
	readCharacterList,
} from "@web/components/game/characters/character-types";
import { EmptyState } from "@web/components/shared/empty-state";
import {
	CharacterView,
	chartStats,
	GraphView,
	OrderView,
	segmentAnchorId,
} from "@web/components/walkthrough/chart";
import { useShallowSearch } from "@web/lib/admin/use-shallow-search";
import { Route } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
	isWalkthroughLang,
	isWalkthroughView,
	readWalkthroughDetail,
	type WalkthroughLang,
	type WalkthroughView,
} from "./types";
import { WalkthroughGraphFullscreen } from "./walkthrough-graph-fullscreen";
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
	// 默认中文：没有中文译文的句子由 resolveText 回退原文，不必让读者先切档
	lang: "zh",
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
	roster,
	initialView,
	initialLang,
	initialCharacter,
}: {
	data: unknown;
	/** 条目页角色名册（BFF 原样）：角色路线卡的头像/身份来自这里 */
	roster?: unknown;
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
		: "zh";

	const chart = detail?.chart ?? null;
	const stats = useMemo(() => (chart ? chartStats(chart) : null), [chart]);
	const characters = detail?.characters ?? [];
	const rosterList: RosterCharacter[] = useMemo(
		() => (roster ? readCharacterList(roster) : []),
		[roster],
	);

	// 链接里的 character 可能是旧 key（攻略更新后角色被删）：不认识就当没选
	const requestedCharacter = search.character?.trim() || null;
	const characterKey = characters.some(
		(item) => item.key === requestedCharacter,
	)
		? requestedCharacter
		: null;

	const scrollToSegment = useCallback((segmentKey: string) => {
		if (typeof document === "undefined") return;
		// scrollIntoView 在 jsdom 里不存在：可选调用，测试里退化成 no-op
		document
			.getElementById(segmentAnchorId(segmentKey))
			?.scrollIntoView?.({ behavior: "smooth", block: "start" });
	}, []);

	/** 内联流程图的全屏 Modal */
	const [fullscreenOpen, setFullscreenOpen] = useState(false);
	/** 「在路线列表中查看」待滚段落：全屏里要先关 Modal，等关闭动画结束再滚 */
	const pendingSegmentRef = useRef<string | null>(null);

	/**
	 * 内联流程图里点「在路线列表中查看」：切到「按顺序」（那就是路线清单，每段带锚点）
	 * 再滚过去。滚动要放到下一帧——同一帧里刚 setState 的 DOM 还没渲染出来，
	 * 直接查会扑空。
	 */
	const handleInlineSegment = useCallback(
		(segmentKey: string) => {
			setSearch({ view: "order" });
			if (typeof requestAnimationFrame !== "function") return;
			requestAnimationFrame(() => scrollToSegment(segmentKey));
		},
		[scrollToSegment, setSearch],
	);

	/**
	 * 全屏 Modal 里点「在路线列表中查看」：先记下段落、切到「按顺序」并关掉
	 * Modal，等 `onOpenChangeComplete`（退场动画结束、焦点归还完毕）再滚。
	 * 在同一帧滚会被 Modal 关闭时的焦点复位盖掉。
	 */
	const handleFullscreenSegment = useCallback(
		(segmentKey: string) => {
			pendingSegmentRef.current = segmentKey;
			setSearch({ view: "order" });
			setFullscreenOpen(false);
		},
		[setSearch],
	);
	const handleFullscreenClosed = useCallback(() => {
		const segmentKey = pendingSegmentRef.current;
		if (!segmentKey) return;
		pendingSegmentRef.current = null;
		scrollToSegment(segmentKey);
	}, [scrollToSegment]);

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
			// 角色只是过滤条件，和视图正交：在流程图 Modal 里点角色药丸只换图，
			// 不能把 URL 里的视图改回「按角色」。
			setSearch({ character: next ?? undefined });
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
			<WalkthroughOverview detail={detail} />
			{chart && stats ? (
				<div className="space-y-4">
					<WalkthroughToolbar
						lang={lang}
						onLangChange={handleLangChange}
						onViewChange={handleViewChange}
						view={view}
					/>
					{/* 角色卡只给需要它的视图：「按顺序」列的是整份攻略的阅读顺序，
					    本来就不按角色过滤，摆一排点了没反应的卡只会误导。
					    位置上它排在视图选项卡之后：先选看哪张视图，再决定只看哪条线 */}
					{view === "order" ? null : (
						<WalkthroughRoutes
							characters={characters}
							onSelect={handleCharacterChange}
							roster={rosterList}
							selectedKey={characterKey}
							stats={stats}
						/>
					)}
					{view === "graph" ? (
						// 流程图仍是内联视图；「全屏」只是画布操作按钮里的一个入口
						<GraphView
							characterKey={characterKey}
							chart={chart}
							lang={lang}
							onOpenSegment={handleInlineSegment}
							onToggleFullscreen={() => setFullscreenOpen(true)}
						/>
					) : view === "order" ? (
						// 按顺序 = 整份攻略拍平成可勾选进度的折叠清单（不按角色过滤）
						<OrderView
							characters={characters}
							chart={chart}
							lang={lang}
							storageKey={detail.id}
						/>
					) : (
						<>
							{/* 按角色 = 段落目录 + 长文正文，过滤条件跟着 characterKey 走 */}
							<WalkthroughSegments
								characterKey={characterKey}
								chart={chart}
								lang={lang}
								onSelect={scrollToSegment}
							/>
							<CharacterView
								characterKey={characterKey}
								chart={chart}
								lang={lang}
							/>
						</>
					)}
					<WalkthroughLegend chart={chart} lang={lang} />
					<WalkthroughGraphFullscreen
						characterKey={characterKey}
						characters={characters}
						chart={chart}
						lang={lang}
						onCharacterChange={handleCharacterChange}
						onLangChange={handleLangChange}
						onOpenChange={setFullscreenOpen}
						onOpenChangeComplete={(open) => {
							if (!open) handleFullscreenClosed();
						}}
						onOpenSegment={handleFullscreenSegment}
						open={fullscreenOpen}
						stats={stats}
					/>
				</div>
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
