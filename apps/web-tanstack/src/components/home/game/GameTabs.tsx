import { Link, useRouterState } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@web/components/ui/tabs";
import { cn } from "@web/lib/utils";
import {
	ArrowDownToLine,
	GitFork,
	MessageCircle,
	Swords,
	TrendingUp,
} from "lucide-react";

const TAB_SEGMENTS = new Set([
	"introduction",
	"comment",
	"translate",
	"relations",
]);

/** 页签容器：与顶栏同样的药丸底 + 发丝边；窄屏横向滚动但隐藏滚动条 */
const tabListClass = cn(
	// p-0.5 + h-8 trigger = 36px，正好等于 h-9；p-1 会让内容比容器高 4px，
	// 而 overflow-x-auto 会把 overflow-y 也计算成 auto → 右侧冒出一条竖向滚动条。
	"h-9 max-w-full justify-start gap-0.5 overflow-x-auto overflow-y-hidden rounded-xl bg-muted/40 p-0.5 ring-1 ring-border/60",
	"[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
);

/** 页签本身：圆角/高度/选中态直接对齐 header/desktop-nav 的导航药丸 */
const tabTriggerClass = cn(
	"h-8 flex-none gap-1.5 rounded-lg px-2.5 text-sm font-medium sm:px-3",
	"text-muted-foreground transition-colors duration-200",
	"hover:bg-muted/60 hover:text-foreground",
	"data-active:bg-muted/60 data-active:text-foreground data-active:shadow-none",
	"focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
);

/**
 * 由 pathname 推断当前页签：/<id>/<segment> 的第二段属于页签段就用它，
 * 否则（含 /<id> 本身，以及 introduction 下嵌套的 /$articleId）归到默认的下载页签。
 * 详情页 pending 态（game-detail-pending.tsx）复用同一判定，避免两处逻辑漂移：
 * 以后新增页签只改这里，pending 的内容区骨架不会掉回文件列表。
 */
export function gameTabOf(pathname: string): string {
	const segment = pathname.split("/").filter(Boolean)[1];
	return segment && TAB_SEGMENTS.has(segment) ? segment : "download";
}

export function GameTabs({ id }: { id: string }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const currentTab = gameTabOf(pathname);

	return (
		<Tabs value={currentTab}>
			<TabsList className={tabListClass}>
				<TabsTrigger
					value="download"
					nativeButton={false}
					className={tabTriggerClass}
					render={
						<Link
							to="/$id"
							params={{ id: id }}
							resetScroll={false}
							viewTransition={false}
						/>
					}
				>
					<ArrowDownToLine aria-hidden="true" />
					下载
				</TabsTrigger>
				<TabsTrigger
					value="introduction"
					nativeButton={false}
					className={tabTriggerClass}
					render={
						<Link
							to="/$id/introduction"
							params={{ id: id }}
							resetScroll={false}
							viewTransition={false}
						/>
					}
				>
					<Swords aria-hidden="true" />
					攻略
				</TabsTrigger>
				<TabsTrigger
					value="comment"
					nativeButton={false}
					className={tabTriggerClass}
					render={
						<Link
							to="/$id/comment"
							params={{ id: id }}
							resetScroll={false}
							viewTransition={false}
						/>
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
							to="/$id/translate"
							params={{ id: id }}
							resetScroll={false}
							viewTransition={false}
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
							to="/$id/relations"
							params={{ id: id }}
							resetScroll={false}
							viewTransition={false}
						/>
					}
				>
					<GitFork aria-hidden="true" />
					系列
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
