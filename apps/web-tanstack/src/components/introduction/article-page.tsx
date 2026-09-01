import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { elysiaErrorF } from "@web/lib";
import { authClient } from "@web/server/auth/auth-client";
import { deleteIntroduction } from "@web/server/introduction";
import { Loader2, Pencil, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CreateEditDialog } from "@web/components/-CreateEditDialog";
import { RichContent } from "@web/components/RichContent";

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

	const [dialogOpen, setDialogOpen] = useState(false);

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

	const handleEditSuccess = () => {
		setDialogOpen(false);
		queryClient.invalidateQueries({ queryKey: ["introductionList"] });
		// Also invalidate the article cache to refresh the content
		router.invalidate({
			filter: (match) =>
				match.routeId === "/$id/_layout/introduction/$articleId",
		});
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
								onClick={() => setDialogOpen(true)}
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
					<CardTitle className="text-2xl items-center text-center">
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

			{/* Edit Dialog */}
			{article && (
				<CreateEditDialog
					key={`edit-${dialogOpen}`}
					gameId={gameId}
					open={dialogOpen}
					onOpenChange={setDialogOpen}
					mode="edit"
					initialData={{
						id: articleId,
						title: article.title ?? "",
						content: article.content ?? "",
						contentType: article.contentType || "markdown",
						copyright: article.copyright ?? "",
					}}
					onSuccess={handleEditSuccess}
				/>
			)}
		</section>
	);
}
