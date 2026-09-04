import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { RichContent } from "@web/components/RichContent";
import { Button } from "@web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { elysiaErrorF } from "@web/lib";
import { useFlipIn } from "@web/lib/flip";
import { authClient } from "@web/server/auth/auth-client";
import { deleteIntroduction } from "@web/server/introduction";
import { Loader2, Pencil, Trash2, User } from "lucide-react";
import { toast } from "sonner";

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
	// 与列表条目标题同名共享元素，路由切换时标题「飞入」详情页（FLIP，见 lib/flip）
	const titleFlipRef = useFlipIn<HTMLDivElement>(`article-title-${articleId}`);

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

	return (
		<section>
			<Card>
				<CardHeader>
					{isAdmin && (
						<div className="flex items-center justify-end gap-1 mb-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									navigate({
										to: "/introduction/$articleId/edit",
										params: { articleId },
									});
								}}
							>
								<Pencil className="size-4 mr-1" />
								编辑
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleDelete}
								disabled={deleteMutation.isPending}
							>
								{deleteMutation.isPending ? (
									<Loader2 className="size-4 mr-1 animate-spin" />
								) : (
									<Trash2 className="size-4 mr-1 text-destructive" />
								)}
								删除
							</Button>
						</div>
					)}
					{/* 与列表条目标题同名共享元素，路由切换时标题「飞入」详情页。
					    w-fit 让盒子贴合文本宽度，与列表端随文本的盒子宽高比相近，
					    飞行位移与列表端起点契合（仅 transform 动画，无拉伸） */}
					<CardTitle
						className="text-2xl items-center text-center w-fit mx-auto"
						ref={titleFlipRef}
						data-flip-name={`article-title-${articleId}`}
					>
						{article?.title}
					</CardTitle>
					<CardDescription>
						<div className="flex items-center justify-center gap-2">
							<span className="inline-flex items-center gap-1">
								<User className="size-4" />
								{article?.user?.name ?? "喵喵喵？"}
							</span>
							<span>|</span>
							<span># 攻略</span>
							<span>|</span>
							<span>
								{article?.createdAt
									? new Date(article.createdAt).toISOString().split("T")[0]
									: ""}
							</span>
						</div>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<RichContent
							content={article?.content}
							contentType={article?.contentType || "markdown"}
						/>
					</div>
					<div className="text-right">
						{article?.copyright && (
							<p className="text-sm items-center">
								来源：
								<a
									href={article.copyright}
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-500 hover:underline"
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
				</CardContent>
			</Card>
		</section>
	);
}
