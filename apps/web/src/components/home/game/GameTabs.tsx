import { Tabs, TabsList, TabsTrigger } from "@web/components/ui/tabs";
import { Link, usePathname, useRouter } from "@web/lib/nav";
import { cn } from "@web/lib/utils";
import {
	ArrowDownToLine,
	GitFork,
	MessageCircle,
	Route,
	TrendingUp,
	Users,
} from "lucide-react";
import { type RefObject, useLayoutEffect, useRef } from "react";

const TAB_SEGMENTS = new Set([
	"characters",
	"walkthrough",
	"comment",
	"translate",
	"relations",
]);

/** 页签容器：与顶栏同样的药丸底 + 发丝边；窄屏横向滚动但隐藏滚动条 */
const tabListClass = cn(
	// p-0.5 + h-8 trigger = 36px，正好等于 h-9；p-1 会让内容比容器高 4px，
	// 而 overflow-x-auto 会把 overflow-y 也计算成 auto → 右侧冒出一条竖向滚动条。
	"overflow-x-auto overflow-y-hidden gap-0.5 justify-start p-0.5 max-w-full h-9 bg-muted/40 rounded-xl ring-1 ring-border/60",
	"[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
);

/** 页签本身：圆角/高度/选中态直接对齐 header/desktop-nav 的导航药丸 */
const tabTriggerClass = cn(
	"flex-none gap-1.5 px-2.5 h-8 text-sm font-medium rounded-lg sm:px-3",
	"text-muted-foreground transition-colors duration-200",
	"hover:text-foreground hover:bg-muted/60",
	"data-active:text-foreground data-active:bg-muted/60 data-active:shadow-none",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
);

/**
 * 由 pathname 推断当前页签：/<id>/<segment> 的第二段属于页签段就用它，
 * 否则（含 /<id> 本身，以及 walkthrough 下嵌套的 /:walkthroughId）归到默认的下载页签。
 * 详情页 pending 态（game-detail-pending.tsx）复用同一判定，避免两处逻辑漂移：
 * 以后新增页签只改这里，pending 的内容区骨架不会掉回文件列表。
 */
export function gameTabOf(pathname: string): string {
	const segment = pathname.split("/").filter(Boolean)[1];
	return segment && TAB_SEGMENTS.has(segment) ? segment : "download";
}

/** 页签栏根元素上的锚点属性：单测/浏览器调试靠它认出「被锚定的那一条」。 */
export const GAME_TAB_ANCHOR_ATTR = "data-game-tab-anchor";

/** 需要「导航后把页签栏顶到视口顶部」的页签：攻略正文紧贴页签下方，页签在顶才够读。 */
const ANCHORED_TAB = "walkthrough";

/**
 * 进入「攻略」页签（`/<id>/walkthrough` 列表与 `/<id>/walkthrough/<id>` 详情）后，
 * 把页签栏滚到视口顶部，让攻略正文从页签下方开始。
 *
 * 取信号用 furin 的**已提交**路由（`router.currentHref`），不用地址栏的
 * `usePathname()`：
 * - 点击导航时，地址栏在提交前就变了、新内容还没上屏；等路由提交再滚，DOM 已是终态；
 * - 浏览器前进/后退是异步加载的，用地址栏会在「加载中就把还在显示的上一个页面滚一次」；
 *   用提交后的信号，浏览器后退时 furin 按历史记录恢复位置（恢复在父级 layout effect，
 *   晚于这里的滚动，恢复优先），不会被抢跳。
 *
 * 首屏直达/刷新不滚：保持「先整页」（面包屑 + 作品概览卡）的默认落点，只在站内导航时锚定。
 *
 * 配合：攻略相关的 Link 都传 `resetScroll={false}`（本组件的页签、
 * walkthrough-list-page 的攻略卡）：furin 的复位也在 RouterProvider 的 layout effect 里执行，
 * 比这里的滚动晚，会把位置清零。
 *
 * `scrollIntoView` 会遵守 html 上的 `scroll-padding-top`（固定顶栏 + 余量），
 * 并把滚动距离夹到文档能到的位置 —— 内容不够长时就是「尽量靠上」。
 *
 * 已知的小漂移：页签上方的概览卡里 TagsCard 是客户端异步查询，首访时若标签数据
 * 晚于这次滚动到达，页签会被向下推几十像素。只出现在「刚进页签标签才返回」的窄窗口。
 */
function useGameTabAnchor(target: RefObject<HTMLDivElement | null>): void {
	const router = useRouter();
	// currentHref 已由 furin 剥掉 basePath，是「逻辑路径 + query」；页签判定只看路径
	const pathname = (router.currentHref || "/").split("?")[0];
	const previousPathname = useRef(pathname);

	useLayoutEffect(() => {
		const from = previousPathname.current;
		previousPathname.current = pathname;
		// 首帧、同路径重渲染（数据/查询更新）都不滚
		if (from === pathname) return;
		// 只有落到攻略页签才锚定；切到其它页签保持原有滚动手感
		if (gameTabOf(pathname) !== ANCHORED_TAB) return;
		target.current?.scrollIntoView({ behavior: "instant", block: "start" });
	}, [pathname, target]);
}

export function GameTabs({ id, path }: { id: string; path?: string }) {
	const pathname = usePathname();
	// SSR 首帧 getServerSnapshot 已给出真实 pathname；path prop 仍优先，
	// 用于 context 缺失时兜底，保证首屏 HTML 的选中页签与 URL 一致。
	const currentTab = gameTabOf(path ?? pathname);
	// 页签栏自己就是攻略锚定的滚动目标：ref 直接交给 hook，不必按属性全局查 DOM
	const rootRef = useRef<HTMLDivElement>(null);
	useGameTabAnchor(rootRef);

	return (
		<div data-game-tab-anchor="" ref={rootRef}>
			<Tabs value={currentTab}>
				<TabsList className={tabListClass}>
					<TabsTrigger
						value="download"
						nativeButton={false}
						className={tabTriggerClass}
						render={<Link to="/:id" params={{ id: id }} resetScroll={false} />}
					>
						<ArrowDownToLine aria-hidden="true" />
						下载
					</TabsTrigger>
					<TabsTrigger
						value="characters"
						nativeButton={false}
						className={tabTriggerClass}
						render={
							<Link
								to="/:id/characters"
								params={{ id: id }}
								resetScroll={false}
							/>
						}
					>
						<Users aria-hidden="true" />
						详情
					</TabsTrigger>
					<TabsTrigger
						value="walkthrough"
						nativeButton={false}
						className={tabTriggerClass}
						render={
							<Link
								to="/:id/walkthrough"
								params={{ id: id }}
								resetScroll={false}
							/>
						}
					>
						<Route aria-hidden="true" />
						攻略
					</TabsTrigger>
					<TabsTrigger
						value="comment"
						nativeButton={false}
						className={tabTriggerClass}
						render={
							<Link to="/:id/comment" params={{ id: id }} resetScroll={false} />
						}
					>
						<MessageCircle aria-hidden="true" />
						讨论
					</TabsTrigger>
					<TabsTrigger
						value="translate"
						nativeButton={false}
						className={tabTriggerClass}
						render={
							<Link
								to="/:id/translate"
								params={{ id: id }}
								resetScroll={false}
							/>
						}
					>
						<TrendingUp aria-hidden="true" />
						统计
					</TabsTrigger>
					<TabsTrigger
						value="relations"
						nativeButton={false}
						className={tabTriggerClass}
						render={
							<Link
								to="/:id/relations"
								params={{ id: id }}
								resetScroll={false}
							/>
						}
					>
						<GitFork aria-hidden="true" />
						系列
					</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
}
