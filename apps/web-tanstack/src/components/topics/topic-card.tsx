import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@web/components/ui/card";
import { useViewportPreload } from "@web/hooks/use-viewport-preload";
import { Heart, MessageSquare } from "lucide-react";
import { useRef } from "react";

function formatTime(dateStr: Date | string | null) {
	if (!dateStr) return "未知";
	const date = new Date(dateStr);
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "刚刚";
	if (minutes < 60) return `${minutes} 分钟前`;
	if (hours < 24) return `${hours} 小时前`;
	if (days < 30) return `${days} 天前`;
	return date.toLocaleDateString("zh-CN");
}

interface TopicCardProps {
	topic: {
		id: number;
		title: string | null;
		summary?: string;
		createdAt: Date | string | null;
		likeCount?: number;
		replyCount?: number;
		user: {
			id: string;
			name: string;
			image: string | null;
		} | null;
	};
}

/**
 * 论坛帖子卡片。
 *
 * 视觉沿用顶栏语言：rounded-2xl + 发丝边（Card 自带）、hover 只提亮底/边不位移。
 * 三个 view-transition-name（头像 / 昵称 / 标题）供列表→详情做共享元素过渡，
 * 进视口即预取详情数据；这两处行为与改版前完全一致。
 */
export function TopicCard({ topic }: TopicCardProps) {
	const linkRef = useRef<HTMLAnchorElement>(null);
	// 进入视口即预取帖子详情数据，点击秒开
	useViewportPreload(
		linkRef,
		(router) => () =>
			router.preloadRoute({
				to: "/topics/$topicId",
				params: { topicId: String(topic.id) },
			}),
	);

	return (
		<Link
			ref={linkRef}
			to="/topics/$topicId"
			params={{ topicId: String(topic.id) }}
			className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
		>
			<Card className="gap-2 transition-colors duration-200 group-hover:bg-muted/40 group-hover:ring-border">
				<CardHeader className="gap-2">
					<div className="flex gap-2 items-center">
						<Avatar
							className="size-6"
							style={{ viewTransitionName: `topic-avatar-${topic.id}` }}
						>
							<AvatarImage
								src={topic.user?.image || ""}
								alt={topic.user?.name}
							/>
							<AvatarFallback className="text-xs text-muted-foreground bg-muted">
								{topic.user?.name?.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<span
							className="inline-block text-xs font-medium text-foreground/80 truncate"
							style={{ viewTransitionName: `topic-nick-${topic.id}` }}
						>
							{topic.user?.name}
						</span>
						<span className="shrink-0 ml-auto text-xs tabular-nums text-muted-foreground">
							{formatTime(topic.createdAt)}
						</span>
					</div>
					<h3
						className="w-fit text-base font-medium text-balance text-foreground transition-colors duration-200 group-hover:text-primary"
						style={{ viewTransitionName: `topic-title-${topic.id}` }}
					>
						{topic.title}
					</h3>
				</CardHeader>
				<CardContent>
					<p className="text-sm leading-relaxed line-clamp-2 wrap-break-word text-muted-foreground">
						{topic.summary}
					</p>
					<div className="flex gap-3 items-center mt-2 text-xs tabular-nums text-muted-foreground">
						<span className="flex gap-1 items-center">
							<Heart className="size-3.5" aria-hidden="true" />
							<span>{topic.likeCount ?? 0}</span>
						</span>
						<span className="flex gap-1 items-center">
							<MessageSquare className="size-3.5" aria-hidden="true" />
							<span>{topic.replyCount ?? 0}</span>
						</span>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}
