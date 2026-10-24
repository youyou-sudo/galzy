import { Link, useRouterState } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@web/components/ui/tabs";
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
			<TabsList>
				<TabsTrigger
					value="download"
					nativeButton={false}
					render={
						<Link
							to="/$id"
							params={{ id: id }}
							resetScroll={false}
							viewTransition={false}
						/>
					}
				>
					<ArrowDownToLine className="size-4" />
					下载
				</TabsTrigger>
				<TabsTrigger
					value="introduction"
					nativeButton={false}
					render={
						<Link
							to="/$id/introduction"
							params={{ id: id }}
							resetScroll={false}
							viewTransition={false}
						/>
					}
				>
					<Swords />
					攻略
				</TabsTrigger>
				<TabsTrigger
					value="comment"
					nativeButton={false}
					render={
						<Link
							to="/$id/comment"
							params={{ id: id }}
							resetScroll={false}
							viewTransition={false}
						/>
					}
				>
					<MessageCircle />
					讨论
				</TabsTrigger>
				<TabsTrigger
					value="translate"
					nativeButton={false}
					render={
						<Link
							to="/$id/translate"
							params={{ id: id }}
							resetScroll={false}
							viewTransition={false}
						/>
					}
				>
					<TrendingUp />
					统计
				</TabsTrigger>
				<TabsTrigger
					value="relations"
					nativeButton={false}
					render={
						<Link
							to="/$id/relations"
							params={{ id: id }}
							resetScroll={false}
							viewTransition={false}
						/>
					}
				>
					<GitFork />
					系列
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
