import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	useMatches,
} from "@tanstack/react-router";
import { CommentMarkdown } from "@web/components/cmments/comment-markdown";
import { CommentThreadSkeleton } from "@web/components/cmments/comment-skeleton";
import { ReplyEidtInput } from "@web/components/cmments/reply-edit-input";
import { RichContent } from "@web/components/RichContent";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@web/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
import { Badge } from "@web/components/ui/badge";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import { Button } from "@web/components/ui/button";
import { Card, CardContent, CardHeader } from "@web/components/ui/card";
import { EmptyState } from "@web/components/shared/empty-state";
import { SectionHeader } from "@web/components/shared/section-header";
import { TopicDetailPageSkeleton } from "@web/components/shared/route-skeletons";
import { seoTemplate } from "@web/config/seoTemplate";
import { cn } from "@web/lib/utils";
import { seoMeta, truncateText } from "@web/lib/seo";
import { authClient } from "@web/server/auth/auth-client";
import { getCmments } from "@web/server/comments";
import {
	deleteTopic,
	getTopic,
	toggleTopicFavorite,
	toggleTopicLike,
} from "@web/server/topics";
import { replycardActions } from "@web/stores/reply-edit-input";
import { Bookmark, Heart, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
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

const byCreatedAtAsc = (a: any, b: any) =>
	Date.parse(a.createdAt) - Date.parse(b.createdAt);

export const Route = createFileRoute("/topics/$topicId")({
	component: RouteComponent,
	pendingComponent: () => <TopicDetailPageSkeleton />,
	loader: async ({ params }) => {
		const topic = await getTopic({ data: { id: Number(params.topicId) } });
		return { topic };
	},
	head: ({ loaderData, params }) =>
		seoMeta({
			title: `${loaderData?.topic?.title || "帖子"} | ${seoTemplate.title}`,
			description: loaderData?.topic?.content
				? truncateText(loaderData.topic.content, 150)
				: undefined,
			path: `/topics/${params.topicId}`,
			type: "article",
		}),
});

function RouteComponent() {
	const { topicId } = Route.useParams();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const loaderData = Route.useLoaderData();
	const { data: topic } = useQuery({
		queryKey: ["topic", topicId],
		queryFn: async () => await getTopic({ data: { id: Number(topicId) } }),
		initialData: loaderData?.topic,
		staleTime: 30_000,
	});
	const { data: session } = useQuery({
		queryKey: ["auth"],
		queryFn: async () => {
			const { data: res, error } = await authClient.getSession();
			if (error) return null;
			return res;
		},
	});

	const matches = useMatches();
	const isChildActive = matches.some(
		(m) => m.routeId === "/topics/$topicId/edit",
	);

	if (isChildActive) {
		return <Outlet />;
	}

	if (!topic) {
		return (
			<div className="mx-auto w-full max-w-4xl">
				<EmptyState
					surface
					icon={MessageSquare}
					title="帖子不存在"
					description="它可能已被删除，或者链接不对"
					action={
						<Button
							variant="outline"
							render={<Link to="/topics" search={{ page: 1 }} />}
						>
							返回论坛
						</Button>
					}
				/>
			</div>
		);
	}

	const isOwner = session?.user?.id === (topic as any).userId;
	const isAdmin = session?.user?.role === "admin";
	const status = (topic as any).status;

	const handleDelete = async () => {
		await deleteTopic({ data: { id: Number(topicId) } });
		queryClient.invalidateQueries({ queryKey: ["topics"] });
		toast.success("删除成功喵～");
		navigate({ to: "/topics", search: { page: 1 } });
	};

	return (
		<div className="mx-auto w-full max-w-4xl">
			<Breadcrumb className="mb-4">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/topics" search={{ page: 1 }} />}>
							论坛
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>{(topic as any).title}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<Card>
				<CardHeader className="gap-3">
					<div className="flex gap-3 justify-between items-start">
						<h1
							className="min-w-0 text-2xl font-semibold tracking-tight text-balance"
							style={{ viewTransitionName: `topic-title-${topicId}` }}
						>
							{(topic as any).title}
						</h1>
						{status && status !== "published" && (
							<Badge
								variant="outline"
								className="shrink-0 text-warning bg-warning/10 border-warning/30"
							>
								{status === "draft" ? "草稿" : "未发布"}
							</Badge>
						)}
					</div>

					<div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
						<Avatar
							className="size-8"
							style={{ viewTransitionName: `topic-avatar-${topicId}` }}
						>
							<AvatarImage
								src={(topic as any).user?.image || ""}
								alt={(topic as any).user?.name}
							/>
							<AvatarFallback className="text-xs text-muted-foreground bg-muted">
								{(topic as any).user?.name?.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<span
							className="inline-block text-sm font-medium text-foreground/90"
							style={{ viewTransitionName: `topic-nick-${topicId}` }}
						>
							{(topic as any).user?.name}
						</span>
						<span className="text-xs tabular-nums text-muted-foreground">
							{formatTime((topic as any).createdAt)}
						</span>
						{(isOwner || isAdmin) && (
							<div className="flex gap-1 items-center ml-auto">
								<Link to="/topics/$topicId/edit" params={{ topicId }}>
									<Button variant="ghost" size="sm">
										<Pencil className="size-3.5" aria-hidden="true" />
										编辑
									</Button>
								</Link>
								<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
									<AlertDialogTrigger
										render={
											<Button
												variant="ghost"
												size="sm"
												className="text-destructive hover:text-destructive hover:bg-destructive/10"
											>
												<Trash2 className="size-3.5" aria-hidden="true" />
												删除
											</Button>
										}
									/>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												确定要删除这个帖子吗？
											</AlertDialogTitle>
											<AlertDialogDescription>
												删除后将无法恢复，确定要继续吗？
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>取消</AlertDialogCancel>
											<AlertDialogAction
												variant="destructive"
												onClick={handleDelete}
											>
												确认删除
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<RichContent
						content={(topic as any).content}
						contentType={(topic as any).contentType || "markdown"}
					/>
					{session && (
						<div className="flex gap-2 items-center pt-3 mt-5 border-t border-border/60">
							<LikeButton topic={topic as any} />
							<FavoriteButton topic={topic as any} />
						</div>
					)}
				</CardContent>
			</Card>

			<section className="mt-8">
				<SectionHeader icon={MessageSquare} title="评论" />
				<TopicComments
					targetType="topic"
					targetId={topicId}
					session={session}
				/>
			</section>
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
			aria-pressed={!!topic.isLiked}
			className={cn(
				"gap-1 tabular-nums",
				topic.isLiked ? "text-primary" : "text-muted-foreground",
			)}
			onClick={handleToggle}
		>
			<Heart
				className={cn("size-4", topic.isLiked && "fill-current")}
				aria-hidden="true"
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
			aria-pressed={!!topic.isFavorited}
			className={cn(
				"gap-1 tabular-nums",
				topic.isFavorited ? "text-warning" : "text-muted-foreground",
			)}
			onClick={handleToggle}
		>
			<Bookmark
				className={cn("size-4", topic.isFavorited && "fill-current")}
				aria-hidden="true"
			/>
			<span>{topic.favoriteCount ?? 0}</span>
		</Button>
	);
}

function TopicCommentsSkeleton() {
	return <CommentThreadSkeleton />;
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
	const { data: commentsData, isLoading } = useQuery({
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

	if (isLoading) {
		return <TopicCommentsSkeleton />;
	}

	const comments = commentsData?.comments ?? [];

	return (
		<div className="space-y-4">
			<ReplyEidtInput
				targetType={targetType}
				targetId={targetId}
				commentscomp={true}
				showTypeSelector={false}
			/>

			{comments.length > 0 ? (
				<div className="divide-y divide-border/60">
					{comments.map((comment: any) => (
						<CommentCard
							key={comment.id}
							comment={comment}
							targetType={targetType}
							targetId={targetId}
							session={session}
						/>
					))}
				</div>
			) : (
				<EmptyState
					size="sm"
					icon={MessageSquare}
					title="暂无评论"
					description="来写第一条评论吧"
				/>
			)}
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
	return (
		<div className="py-3 first:pt-0 last:pb-0">
			<div className="flex gap-2.5">
				<Avatar className="size-7">
					<AvatarImage
						src={comment.user?.image || ""}
						alt={comment.user?.name}
					/>
					<AvatarFallback className="text-[10px] text-muted-foreground bg-muted">
						{comment.user?.name?.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 min-w-0">
					<div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center">
						<span className="text-sm font-medium text-foreground">
							{comment.user?.name}
						</span>
						<span className="flex shrink-0 gap-2 items-center ml-auto text-xs text-muted-foreground">
							<span className="tabular-nums">
								{formatTime(comment.createdAt)}
							</span>
							{session && (
								<button
									type="button"
									className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
									onClick={() => {
										replycardActions.openReId(comment.id, {
											id: comment.id,
											userId: comment.user?.id,
											userName: comment.user?.name,
										});
									}}
								>
									回复
								</button>
							)}
						</span>
					</div>

					<div className="mt-0.5">
						<CommentMarkdown content={comment.content} />
					</div>

					<ReplyEidtInput
						reId={comment.id}
						targetType={targetType}
						targetId={targetId}
						commentscomp={false}
						showTypeSelector={false}
					/>

					{comment.re?.length > 0 && (
						<div className="mt-1">
							<ReplyList
								replies={comment.re}
								targetType={targetType}
								targetId={targetId}
								session={session}
								depth={0}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function ReplyList({
	replies,
	targetType,
	targetId,
	session,
	depth = 0,
}: {
	replies: any[];
	targetType: string;
	targetId: string;
	session: any;
	depth?: number;
}) {
	const sorted = useMemo(() => [...replies].sort(byCreatedAtAsc), [replies]);

	return (
		<div className={depth === 0 ? "pl-2.5 border-l border-border/60" : ""}>
			{sorted.map((reply) => (
				<div className="py-1.5 first:pt-0 last:pb-0" key={reply.id}>
					<div className="flex gap-2">
						<Avatar className="size-6">
							<AvatarImage
								src={reply.user?.image || ""}
								alt={reply.user?.name}
							/>
							<AvatarFallback className="text-[10px] text-muted-foreground bg-muted">
								{reply.user?.name?.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center">
								<span className="text-[13px] font-medium text-foreground">
									{reply.user?.name}
								</span>
								{reply.reUser && (
									<span className="text-xs text-primary">
										回复 @{reply.reUser.name}
									</span>
								)}
								<span className="text-xs tabular-nums text-muted-foreground">
									{formatTime(reply.createdAt)}
								</span>
								{session && (
									<button
										type="button"
										className="text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
										onClick={() => {
											replycardActions.openReId(reply.id, {
												id: reply.id,
												userId: reply.user?.id,
												userName: reply.user?.name,
											});
										}}
									>
										回复
									</button>
								)}
							</div>

							<div className="mt-0.5 text-sm text-foreground/80">
								<CommentMarkdown content={reply.content} />
							</div>

							<ReplyEidtInput
								reId={reply.id}
								targetType={targetType}
								targetId={targetId}
								commentscomp={false}
								showTypeSelector={false}
							/>

							{reply.re?.length > 0 && (
								<ReplyList
									replies={reply.re}
									targetType={targetType}
									targetId={targetId}
									session={session}
									depth={depth + 1}
								/>
							)}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
