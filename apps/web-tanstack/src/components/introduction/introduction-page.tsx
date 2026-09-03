import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { useViewportPreload } from "@web/hooks/use-viewport-preload";
import { elysiaErrorF } from "@web/lib";
import { authClient } from "@web/server/auth/auth-client";
import { deleteIntroduction } from "@web/server/introduction";
import { Loader2, NotepadText, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

/**
 * 列表条目链接：进入视口即预取文章详情路由数据，点击秒开；
 * 标题与详情页 CardTitle 同名 view-transition-name，路由切换时标题「飞入」详情页
 */
function ArticleLink({ item, gameId }: { item: any; gameId: string }) {
	const linkRef = useRef<HTMLAnchorElement>(null);
	useViewportPreload(
		linkRef,
		(router) => () =>
			router.preloadRoute({
				to: "/$id/introduction/$articleId",
				params: { id: gameId, articleId: String(item.id) },
			}),
	);

	return (
		<Link
			ref={linkRef}
			to="/$id/introduction/$articleId"
			params={{ id: gameId, articleId: String(item.id) }}
			resetScroll={false}
			className="w-full min-w-0"
		>
			<div className="py-2 flex items-center w-full min-w-0">
				<NotepadText className="size-4 mr-1 shrink-0" />
				<span
					className="truncate"
					style={{
						viewTransitionName: `article-title-${item.id}`,
						viewTransitionClass: "article-title",
					}}
				>
					{item.title}
				</span>
				{item.status === "pending" && (
					<Badge variant="outline" className="ml-2 shrink-0">
						待审核
					</Badge>
				)}
				{item.status === "rejected" && (
					<Badge variant="secondary" className="ml-2 shrink-0">
						已驳回
					</Badge>
				)}
			</div>
		</Link>
	);
}

export default function IntroductionPage({
	introductionList,
	id,
}: {
	introductionList: any;
	id: string;
}) {
	const router = useRouter();
	const navigate = useNavigate();

	// Get current user session
	const { data: session, isPending: sessionPending } = useQuery({
		queryKey: ["auth"],
		queryFn: async () => {
			const { data: res, error } = await authClient.getSession();
			elysiaErrorF(error);
			return res;
		},
	});

	const isAdmin = session?.user?.role === "admin";
	const isLoggedIn = !!session?.user;

	const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

	const deleteMutation = useMutation({
		mutationFn: deleteIntroduction,
		onSuccess: () => {
			toast.success("文章已删除～");
			router.invalidate({
				filter: (match) => match.routeId === "/$id/_layout/introduction/",
			});
		},
		onError: (error: any) => {
			toast.error(error?.message || "删除失败，请稍后重试");
		},
		onSettled: (_data, _error, variables) => {
			setDeletingIds((prev) => {
				const next = new Set(prev);
				next.delete(variables.data.strategyId);
				return next;
			});
		},
	});

	const handleDelete = (strategyId: number) => {
		setDeletingIds((prev) => new Set(prev).add(strategyId));
		deleteMutation.mutate({
			data: {
				strategyId,
				gameId: id,
			},
		});
	};

	return (
		<section>
			{/* Header with create button */}
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-semibold">攻略文章</h2>
				{isLoggedIn && !sessionPending && (
					<Button
						onClick={() => {
							navigate({
								to: "/introduction/create",
								search: { gameId: id },
							});
						}}
						size="sm"
						variant="outline"
					>
						<Plus className="size-4 mr-1" />
						{isAdmin ? "创建文章" : "提交攻略"}
					</Button>
				)}
			</div>

			{(!introductionList || introductionList.length === 0) && (
				<div className="text-center text-muted-foreground py-8">
					暂无攻略文章喵～
					{isLoggedIn && !sessionPending && (
						<div className="mt-2">
							<Button
								onClick={() => {
									navigate({
										to: "/introduction/create",
										search: { gameId: id },
									});
								}}
								variant="outline"
								size="sm"
							>
								<Plus className="size-4 mr-1" />
								{isAdmin ? "来写第一篇攻略吧～" : "来提交第一篇攻略吧～"}
							</Button>
						</div>
					)}
				</div>
			)}

			{introductionList && introductionList.length > 0 && (
				<div className="rounded-lg">
					{introductionList.map((item: any) => {
						const isMine =
							item.author === session?.user?.id &&
							(item.status === "pending" || item.status === "rejected");
						const canEdit = isAdmin || isMine;
						return (
							<div
								key={item.id}
								className="flex items-center justify-between px-2 gap-2 rounded-lg group hover:bg-muted/50"
							>
								<ArticleLink item={item} gameId={id} />

								{/* Admin / author action buttons */}
								{canEdit && (
									<div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button
											variant="ghost"
											size="icon-sm"
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												navigate({
													to: "/introduction/$articleId/edit",
													params: { articleId: String(item.id) },
												});
											}}
											title="编辑"
										>
											<Pencil className="size-3.5" />
										</Button>
										{isAdmin && (
											<Button
												variant="ghost"
												size="icon-sm"
												onClick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													handleDelete(item.id);
												}}
												disabled={deletingIds.has(item.id)}
												title="删除"
											>
												{deletingIds.has(item.id) ? (
													<Loader2 className="size-3.5 animate-spin" />
												) : (
													<Trash2 className="size-3.5 text-destructive" />
												)}
											</Button>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
