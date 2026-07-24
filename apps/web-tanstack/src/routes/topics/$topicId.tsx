import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Card, CardContent, CardHeader } from "@web/components/ui/card";
import { Separator } from "@web/components/ui/separator";
import { authClient } from "@web/server/auth/auth-client";
import { getCmments, createCmments } from "@web/server/comments";
import { deleteTopic, getTopic } from "@web/server/topics";
import { Input } from "@web/components/ui/input";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
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

function TopicComments({
	targetType,
	targetId,
	session,
}: {
	targetType: string;
	targetId: string;
	session: any;
}) {
	const queryClient = useQueryClient();
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

	const [replyContent, setReplyContent] = useState("");

	const handleSubmitComment = async () => {
		if (!replyContent.trim()) return;
		await createCmments({
			data: {
				targetType,
				targetId,
				content: replyContent.trim(),
			},
		});
		setReplyContent("");
		queryClient.invalidateQueries({
			queryKey: ["comments", targetType, targetId],
		});
		toast.success("评论成功喵～");
	};

	return (
		<div className="space-y-4">
			{session && (
				<div className="flex gap-2">
					<Input
						placeholder="写下你的评论..."
						value={replyContent}
						onChange={(e) => setReplyContent(e.target.value)}
					/>
					<Button onClick={handleSubmitComment}>回复</Button>
				</div>
			)}

			<div className="space-y-3">
				{commentsData?.comments?.map((comment: any) => (
					<CommentItem key={comment.id} comment={comment} />
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

function CommentItem({ comment }: { comment: any }) {
	return (
		<div className="flex gap-3">
			<Avatar className="size-8">
				<AvatarImage src={comment.user?.image || ""} alt={comment.user?.name} />
				<AvatarFallback className="bg-muted text-muted-foreground text-xs">
					{comment.user?.name?.slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">{comment.user?.name}</span>
					<span className="text-xs text-muted-foreground">
						{formatTime(comment.createdAt)}
					</span>
				</div>
				<p className="text-sm text-foreground/80 mt-1">{comment.content}</p>
			</div>
		</div>
	);
}
