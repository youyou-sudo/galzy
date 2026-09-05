import { Link, useRouterState } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@web/components/ui/tabs";
import {
	ArrowDownToLine,
	GitFork,
	MessageCircle,
	Swords,
	TrendingUp,
} from "lucide-react";

export function GameTabs({ id }: { id: string }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	// segment after /<id>/ determines the tab; introduction handles nested /$articleId
	const segments = pathname.split("/").filter(Boolean);
	const currentTab =
		segments[1] === "introduction" ||
		segments[1] === "comment" ||
		segments[1] === "translate" ||
		segments[1] === "relations"
			? segments[1]
			: "download";

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
