import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Card, CardContent, CardHeader } from "@web/components/ui/card";
import { Separator } from "@web/components/ui/separator";
import { authClient } from "@web/server/auth/auth-client";
import { getCmments } from "@web/server/comments";
import { deleteTopic, getTopic, toggleTopicFavorite, toggleTopicLike } from "@web/server/topics";
import { ReplyEidtInput } from "@web/components/cmments/reply-edit-input";
import { replycardActions } from "@web/stores/reply-edit-input";
import {
	Bookmark,
	FileText,
	Heart,
	Pencil,
	Trash2,
	MessageCircleQuestionMark,
	MessageSquareHeart,
	ShieldQuestionMark,
} from "lucide-react";
import { toast } from "sonner";

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

const typeLabelMap: Record<
	string,
	{ label: string; className: string; icon: typeof ShieldQuestionMark }
> = {
	comment: {
		label: "讨论",
		className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
		icon: MessageSquareHeart,
	},
	feedback: {
		label: "反馈",
		className:
			"bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
		icon: MessageCircleQuestionMark,
	},
	question: {
		label: "提问",
		className:
			"bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
		icon: ShieldQuestionMark,
	},
};

export const Route = createFileRoute("/topics/$topicId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const data = await getTopic({ data: { id: Number(params.topicId) } });
		return data;
	},
});

function RouteComponent() {
	const { topicId } = Route.useParams();
	const navigate = useNavigate();
	const { data: topic } = useQuery({
		queryKey: ["topic", topicId],
		queryFn: async () => await getTopic({ data: { id: Number(topicId) } }),
		initialData: Route.useLoaderData(),
	});
	const { data: session } = useQuery({
		queryKey: ["auth"],
		queryFn: async () => {
			const { data: res, error } = await authClient.getSession();
			if (error) return null;
			return res;
		},
	});

	if (!topic) {
		return (
			<div className="text-center py-12 text-muted-foreground">帖子不存在</div>
		);
	}

	const isOwner = session?.user?.id === (topic as any).userId;
	const isAdmin = session?.user?.role === "admin";

	const handleDelete = async () => {
		if (!confirm("确定要删除这个帖子吗？")) return;
		await deleteTopic({ data: { id: Number(topicId) } });
		toast.success("删除成功喵～");
		navigate({ to: "/topics" });
	};

	return (
		<div className="max-w-3xl mx-auto space-y-4">
			<Link
				to="/topics"
				className="text-sm text-muted-foreground hover:text-foreground"
			>
				← 返回论坛
			</Link>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<FileText className="size-5 text-muted-foreground" />
							<h1 className="text-2xl font-bold">{(topic as any).title}</h1>
						</div>
						<Badge variant="secondary">{(topic as any).status}</Badge>
					</div>
					<div className="flex items-center gap-2 mt-2">
						<Avatar className="size-6">
							<AvatarImage
								src={(topic as any).user?.image || ""}
								alt={(topic as any).user?.name}
							/>
							<AvatarFallback className="bg-muted text-muted-foreground text-xs">
								{(topic as any).user?.name?.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<span className="text-sm text-muted-foreground">
							{(topic as any).user?.name}
						</span>
						<span className="text-xs text-muted-foreground">
							{formatTime((topic as any).createdAt)}
						</span>
						{(isOwner || isAdmin) && (
							<div className="ml-auto flex items-center gap-1">
								<Link to="/topics/$topicId/edit" params={{ topicId }}>
									<Button variant="ghost" size="sm">
										<Pencil className="size-3.5 mr-1" />
										编辑
									</Button>
								</Link>
								<Button
									variant="ghost"
									size="sm"
									className="text-destructive"
									onClick={handleDelete}
								>
									<Trash2 className="size-3.5 mr-1" />
									删除
								</Button>
							</div>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<p className="whitespace-pre-wrap text-foreground/80">
						{(topic as any).content}
					</p>
					{session && (
						<div className="flex items-center gap-4 mt-4 pt-3 border-t">
							<LikeButton topic={topic as any} />
							<FavoriteButton topic={topic as any} />
						</div>
					)}
				</CardContent>
			</Card>

			<Separator />

			<div>
				<h2 className="text-lg font-semibold mb-4">评论</h2>
				<TopicComments
					targetType="topic"
					targetId={topicId}
					session={session}
				/>
			</div>
		</div>
	);
}

function LikeButton({ topic }: { topic: any }) {
	const queryClient = useQueryClient();
	const { topicId } = Route.useParams();

	const handleToggle = async () => {
		await toggleTopicLike({ data: { id: Number(topicId) } });
		queryClient.invalidateQueries({ queryKey: ["topic", topicId] });
	};

	return (
		<Button
			variant="ghost"
			size="sm"
			className={`gap-1 ${topic.isLiked ? "text-red-500" : "text-muted-foreground"}`}
			onClick={handleToggle}
		>
			<Heart
				className={`size-4 ${topic.isLiked ? "fill-red-500" : ""}`}
			/>
			<span>{topic.likeCount ?? 0}</span>
		</Button>
	);
}

function FavoriteButton({ topic }: { topic: any }) {
	const queryClient = useQueryClient();
	const { topicId } = Route.useParams();

	const handleToggle = async () => {
		await toggleTopicFavorite({ data: { id: Number(topicId) } });
		queryClient.invalidateQueries({ queryKey: ["topic", topicId] });
	};

	return (
		<Button
			variant="ghost"
			size="sm"
			className={`gap-1 ${topic.isFavorited ? "text-yellow-500" : "text-muted-foreground"}`}
			onClick={handleToggle}
		>
			<Bookmark
				className={`size-4 ${topic.isFavorited ? "fill-yellow-500" : ""}`}
			/>
			<span>{topic.favoriteCount ?? 0}</span>
		</Button>
	);
}

function TopicComments({
	targetType,
	targetId,
	session,
}: {
	targetType: string;
	targetId: string;
	session: any;
}) {
	const { data: commentsData } = useQuery({
		queryKey: ["comments", targetType, targetId],
		queryFn: async () => {
			return getCmments({
				data: {
					targetType,
					targetId,
					page: 1,
					limit: 50,
				},
			});
		},
	});

	return (
		<div className="space-y-4">
			<ReplyEidtInput
				targetType={targetType}
				targetId={targetId}
				commentscomp={true}
			/>

			<div className="space-y-3">
				{commentsData?.comments?.map((comment: any) => (
					<CommentCard
						key={comment.id}
						comment={comment}
						targetType={targetType}
						targetId={targetId}
						session={session}
					/>
				))}
				{(!commentsData?.comments || commentsData.comments.length === 0) && (
					<div className="text-center text-muted-foreground py-8">
						暂无评论，来写第一条评论吧～
					</div>
				)}
			</div>
		</div>
	);
}

function CommentCard({
	comment,
	targetType,
	targetId,
	session,
}: {
	comment: any;
	targetType: string;
	targetId: string;
	session: any;
}) {
	const IconComponent = typeLabelMap[comment.type]?.icon;

	return (
		<div>
			<div className="flex gap-3">
				<Avatar className="size-8">
					<AvatarImage src={comment.user?.image || ""} alt={comment.user?.name} />
					<AvatarFallback className="bg-muted text-muted-foreground text-xs">
						{comment.user?.name?.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-foreground">
							{comment.user?.name}
						</span>
						<Badge
							variant="secondary"
							className={`text-xs ${typeLabelMap[comment.type]?.className} -mb-0.5`}
						>
							{IconComponent && <IconComponent data-icon="inline-start" />}
							{typeLabelMap[comment.type]?.label}
						</Badge>
					</div>
					<p className="text-sm text-foreground/80 mt-0.5 whitespace-pre-wrap">
						{comment.content}
					</p>
					<div className="flex items-center text-xs">
						<span className="text-muted-foreground my-2">
							{formatTime(comment.createdAt)}
						</span>
						{session && (
							<Button
								variant="ghost"
								className="text-muted-foreground text-xs"
								onClick={() => {
									replycardActions.openReId(comment.id, {
										id: comment.id,
										userId: comment.user?.id,
										userName: comment.user?.name,
									});
								}}
							>
								回复
							</Button>
						)}
					</div>

					<ReplyEidtInput
						reId={comment.id}
						targetType={targetType}
						targetId={targetId}
						commentscomp={false}
					/>

					{comment.re?.length > 0 && (
						<div className="mt-2">
							<ReplyList
								replies={comment.re}
								targetType={targetType}
								targetId={targetId}
								session={session}
							/>
						</div>
					)}
				</div>
			</div>
			{(!comment.re || comment.re.length === 0) && <Separator className="mt-2" />}
		</div>
	);
}

function ReplyList({
	replies,
	targetType,
	targetId,
	session,
}: {
	replies: any[];
	targetType: string;
	targetId: string;
	session: any;
}) {
	const sorted = [...replies].sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	);

	return sorted.map((reply) => (
		<div className="flex ml-6" key={reply.id}>
			<Separator orientation="vertical" />
			<div className="flex gap-3 pl-3 py-2 w-full">
				<Avatar className="size-8">
					<AvatarImage src={reply.user?.image || ""} alt={reply.user?.name} />
					<AvatarFallback className="bg-muted text-muted-foreground text-xs">
						{reply.user?.name?.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-foreground">
							{reply.user?.name}
						</span>
					</div>
					<p className="text-sm text-foreground/80 mt-0.5">
						{reply.reUser && (
							<span className="text-primary">回复@{reply.reUser.name}：</span>
						)}
						{reply.content}
					</p>
					<div className="flex items-center">
						<span className="text-xs text-muted-foreground">
							{formatTime(reply.createdAt)}
						</span>
						{session && (
							<Button
								variant="ghost"
								className="text-muted-foreground"
								onClick={() => {
									replycardActions.openReId(reply.id, {
										id: reply.id,
										userId: reply.user?.id,
										userName: reply.user?.name,
									});
								}}
							>
								回复
							</Button>
						)}
					</div>

					<ReplyEidtInput
						reId={reply.id}
						targetType={targetType}
						targetId={targetId}
						commentscomp={false}
					/>

					{reply.re?.length > 0 && (
						<ReplyList
							replies={reply.re}
							targetType={targetType}
							targetId={targetId}
							session={session}
						/>
					)}
				</div>
			</div>
		</div>
	));
}
