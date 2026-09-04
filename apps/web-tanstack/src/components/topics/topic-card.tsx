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
		>
			<Card className="hover:bg-accent/50 transition-colors cursor-pointer gap-1">
				<CardHeader>
					<div className="flex items-center gap-2">
						<Avatar
							className="size-6"
							style={{ viewTransitionName: `topic-avatar-${topic.id}` }}
						>
							<AvatarImage
								src={topic.user?.image || ""}
								alt={topic.user?.name}
							/>
							<AvatarFallback className="bg-muted text-muted-foreground text-xs">
								{topic.user?.name?.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<span
							className="text-sm text-muted-foreground inline-block"
							style={{ viewTransitionName: `topic-nick-${topic.id}` }}
						>
							{topic.user?.name}
						</span>
						<span className="text-xs text-muted-foreground ml-auto">
							{formatTime(topic.createdAt)}
						</span>
					</div>
					<h3
						className="text-lg font-semibold mt-1 w-fit"
						style={{ viewTransitionName: `topic-title-${topic.id}` }}
					>
						{topic.title}
					</h3>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground line-clamp-2 wrap-break-word">
						{topic.summary}
					</p>
					<div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
						<span className="flex items-center gap-1">
							<Heart className="size-3.5" />
							<span>{topic.likeCount ?? 0}</span>
						</span>
						<span className="flex items-center gap-1">
							<MessageSquare className="size-3.5" />
							<span>{topic.replyCount ?? 0}</span>
						</span>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}
