import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { RichContent } from "@web/components/RichContent";
import { PageHeader } from "@web/components/shared/page-header";
import { Button } from "@web/components/ui/button";
import { elysiaErrorF } from "@web/lib";
import { authClient } from "@web/server/auth/auth-client";
import { deleteIntroduction } from "@web/server/introduction";
import {
	ArrowLeft,
	FileText,
	Loader2,
	Pencil,
	Trash2,
	User,
} from "lucide-react";
import { toast } from "sonner";

/**
 * 攻略文章详情。
 *
 * 本页渲染在游戏详情页的内容卡里（外层已提供圆角/发丝边），所以自身不再套 Card，
 * 只保留 PageHeader + 正文。正文与页头同宽铺满内容卡（攻略多为短句/流程，
 * 居中窄栏会留下大片空白，也与标题的左右边界对不齐）。
 */
export default function ArticlePage({
	article,
	gameId,
	articleId,
}: {
	article: any;
	gameId: string;
	articleId: string;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	// Get current user session
	const { data: session } = useQuery({
		queryKey: ["auth"],
		queryFn: async () => {
			const { data: res, error } = await authClient.getSession();
			elysiaErrorF(error);
			return res;
		},
	});

	const isAdmin = session?.user?.role === "admin";

	const deleteMutation = useMutation({
		mutationFn: deleteIntroduction,
		onSuccess: () => {
			toast.success("文章已删除～");
			queryClient.invalidateQueries({ queryKey: ["introductionList"] });
			router.navigate({ to: "/$id/introduction", params: { id: gameId } });
		},
		onError: (error: any) => {
			toast.error(error?.message || "删除失败，请稍后重试");
		},
	});

	const handleDelete = () => {
		if (window.confirm(`确定要删除「${article?.title}」吗？此操作不可撤销。`)) {
			deleteMutation.mutate({
				data: {
					strategyId: Number(articleId),
					gameId,
				},
			});
		}
	};

	const createdDate = article?.createdAt
		? new Date(article.createdAt).toISOString().split("T")[0]
		: "";

	return (
		<section>
			{/* 标题与列表条目共用同名 view-transition-name：路由切换时标题「飞入」详情页。
			    w-fit 让盒子贴合文本宽度，与列表端随文本的盒子宽高比相近，
			    共享元素飞行的缩放近乎等比，不会把文本拉变形 */}
			<PageHeader
				icon={FileText}
				title={
					<span
						className="w-fit"
						style={{
							viewTransitionName: `article-title-${articleId}`,
							viewTransitionClass: "article-title",
						}}
					>
						{article?.title}
					</span>
				}
				description={
					<span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
						<span className="inline-flex items-center gap-1">
							<User aria-hidden="true" className="size-3.5" />
							{article?.user?.name ?? "喵喵喵？"}
						</span>
						<span aria-hidden="true">·</span>
						<span>攻略</span>
						{createdDate && (
							<>
								<span aria-hidden="true">·</span>
								<span className="tabular-nums">{createdDate}</span>
							</>
						)}
					</span>
				}
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							render={<Link to="/$id/introduction" params={{ id: gameId }} />}
						>
							<ArrowLeft className="size-4" />
							返回列表
						</Button>
						{isAdmin && (
							<>
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										navigate({
											to: "/introduction/$articleId/edit",
											params: { articleId },
										});
									}}
								>
									<Pencil className="size-4" />
									编辑
								</Button>
								<Button
									variant="destructive"
									size="sm"
									onClick={handleDelete}
									disabled={deleteMutation.isPending}
								>
									{deleteMutation.isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Trash2 className="size-4" />
									)}
									删除
								</Button>
							</>
						)}
					</>
				}
			/>

			{/* 正文与页头/内容卡同宽：攻略正文按原始排版左对齐铺满，不再收成居中的窄栏 */}
			<div className="w-full">
				<RichContent
					content={article?.content}
					contentType={article?.contentType || "markdown"}
				/>
				{article?.copyright && (
					<p className="mt-8 border-t border-border/60 pt-4 text-xs text-muted-foreground">
						来源：
						<a
							href={article.copyright}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary transition-colors duration-200 hover:text-primary/80"
						>
							{(() => {
								try {
									return new URL(article.copyright).hostname.replace(
										/\.\w+$/,
										"",
									);
								} catch {
									return article.copyright;
								}
							})()}
						</a>
					</p>
				)}
			</div>
		</section>
	);
}
