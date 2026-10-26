import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { EmptyState } from "@web/components/shared/empty-state";
import { SectionHeader } from "@web/components/shared/section-header";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import { useViewportPreload } from "@web/hooks/use-viewport-preload";
import { elysiaErrorF } from "@web/lib";
import { cn } from "@web/lib/utils";
import { authClient } from "@web/server/auth/auth-client";
import { deleteIntroduction } from "@web/server/introduction";
import { articleHeroActions } from "@web/stores/articleHeroStore";
import {
	BookOpen,
	Loader2,
	NotepadText,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

/**
 * 列表条目链接：进入视口即预取文章详情路由数据，点击秒开；
 * 标题与详情页 PageHeader 同名 view-transition-name，路由切换时标题「飞入」详情页
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
			// 点击时回写标题：详情 pending 态直接复用，与列表条目同一组 VT 衔接
			onClick={() =>
				articleHeroActions.fromArticle({ id: item.id, title: item.title })
			}
			className="flex flex-1 gap-2 items-center py-2.5 min-w-0 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
		>
			<NotepadText
				aria-hidden="true"
				className="shrink-0 size-4 text-muted-foreground"
			/>
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
				<Badge variant="outline" className="shrink-0 ml-2 text-warning">
					待审核
				</Badge>
			)}
			{item.status === "rejected" && (
				<Badge variant="secondary" className="shrink-0 ml-2">
					已驳回
				</Badge>
			)}
		</Link>
	);
}

/**
 * 攻略文章列表（详情页「攻略」页签）。
 *
 * 区块头走 SectionHeader、空态走 EmptyState，与列表/首页同一套标题语言；
 * 行内编辑/删除在触屏上常显，桌面端 hover/focus 才出现（不依赖 hover 表达关键操作）。
 */
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
	const canCreate = isLoggedIn && !sessionPending;

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

	const goCreate = () => {
		navigate({
			to: "/introduction/create",
			search: { gameId: id },
		});
	};

	const createButton = canCreate ? (
		<Button size="sm" variant="outline" onClick={goCreate}>
			<Plus className="size-4" />
			{isAdmin ? "创建文章" : "提交攻略"}
		</Button>
	) : undefined;

	const list: any[] = introductionList ?? [];

	return (
		<section>
			<SectionHeader
				icon={BookOpen}
				title="攻略文章"
				count={list.length > 0 ? list.length : undefined}
				action={createButton}
			/>

			{list.length === 0 ? (
				<EmptyState
					icon={BookOpen}
					size="sm"
					title="暂无攻略文章"
					description="还没有人分享这部作品的攻略"
					action={
						canCreate ? (
							<Button size="sm" variant="outline" onClick={goCreate}>
								<Plus className="size-4" />
								{isAdmin ? "创建第一篇" : "提交第一篇"}
							</Button>
						) : undefined
					}
				/>
			) : (
				<ul className="flex flex-col divide-y divide-border/60">
					{list.map((item: any) => {
						const isMine =
							item.author === session?.user?.id &&
							(item.status === "pending" || item.status === "rejected");
						const canEdit = isAdmin || isMine;
						return (
							<li
								key={item.id}
								className={cn(
									"group/row flex gap-2 justify-between items-center px-2 -mx-2 rounded-xl",
									"transition-colors duration-200 hover:bg-muted/40",
								)}
							>
								<ArticleLink item={item} gameId={id} />

								{/* Admin / author action buttons：触屏常显，桌面 hover 才浮出 */}
								{canEdit && (
									<div className="flex shrink-0 gap-1 items-center opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-focus-within/row:opacity-100 sm:group-hover/row:opacity-100">
										<Tooltip>
											<TooltipTrigger
												render={
													<Button
														variant="ghost"
														size="icon-sm"
														aria-label="编辑"
														onClick={(e) => {
															e.preventDefault();
															e.stopPropagation();
															navigate({
																to: "/introduction/$articleId/edit",
																params: { articleId: String(item.id) },
															});
														}}
													>
														<Pencil className="size-4 text-muted-foreground" />
													</Button>
												}
											/>
											<TooltipContent>编辑</TooltipContent>
										</Tooltip>
										{isAdmin && (
											<Tooltip>
												<TooltipTrigger
													render={
														<Button
															variant="ghost"
															size="icon-sm"
															aria-label="删除"
															onClick={(e) => {
																e.preventDefault();
																e.stopPropagation();
																handleDelete(item.id);
															}}
															disabled={deletingIds.has(item.id)}
														>
															{deletingIds.has(item.id) ? (
																<Loader2 className="size-4 animate-spin" />
															) : (
																<Trash2 className="size-4 text-destructive" />
															)}
														</Button>
													}
												/>
												<TooltipContent>删除</TooltipContent>
											</Tooltip>
										)}
									</div>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
