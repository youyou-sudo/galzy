import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@web/components/ui/card";
import { Heart } from "lucide-react";

function formatTime(dateStr: string) {
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
		title: string;
		content: string;
		createdAt: string;
		likeCount?: number;
		user: {
			id: string;
			name: string;
			image: string;
		} | null;
	};
}

export function TopicCard({ topic }: TopicCardProps) {
	return (
		<Link to="/topics/$topicId" params={{ topicId: String(topic.id) }}>
			<Card className="hover:bg-accent/50 transition-colors cursor-pointer">
				<CardHeader className="pb-2">
					<div className="flex items-center gap-2">
						<Avatar className="size-6">
							<AvatarImage
								src={topic.user?.image || ""}
								alt={topic.user?.name}
							/>
							<AvatarFallback className="bg-muted text-muted-foreground text-xs">
								{topic.user?.name?.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<span className="text-sm text-muted-foreground">
							{topic.user?.name}
						</span>
						<span className="text-xs text-muted-foreground ml-auto">
							{formatTime(topic.createdAt)}
						</span>
					</div>
					<h3 className="text-lg font-semibold mt-1">{topic.title}</h3>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground line-clamp-2">
						{topic.content}
					</p>
					<div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
						<Heart className="size-3.5" />
						<span>{topic.likeCount ?? 0}</span>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}
