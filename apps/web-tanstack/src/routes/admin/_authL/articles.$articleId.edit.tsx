import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArticleForm } from "@web/components/introduction/article-form";
import { Button } from "@web/components/ui/button";
import { invalidations } from "@web/lib/admin/query-keys";
import { seoMeta } from "@web/lib/seo";
import { adminUpdateArticle } from "@web/server/admin/articles";
import { getIntroductionArticle } from "@web/server/introduction";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/_authL/articles/$articleId/edit")({
	component: RouteComponent,
	head: () =>
		seoMeta({
			title: "编辑文章 | GalZY - Galgame 资源站",
			noindex: true,
		}),
	loader: async ({ params }) => {
		const article = await getIntroductionArticle({
			data: { id: params.articleId },
		});
		return { article, articleId: params.articleId };
	},
});

function RouteComponent() {
	const { article, articleId } = Route.useLoaderData();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const handleCustomSubmit = async (values: {
		title: string;
		content: string;
		contentType: "markdown" | "html";
		copyright?: string;
	}) => {
		await adminUpdateArticle({
			data: {
				id: Number(articleId),
				title: values.title,
				content: values.content,
				contentType: values.contentType,
			},
		});
		toast.success("文章已更新");
		// 后台统一 key 前缀：一次失效文章列表与仪表盘统计
		for (const queryKey of invalidations.articles) {
			void queryClient.invalidateQueries({ queryKey });
		}
		navigate({ to: "/admin/articles" });
	};

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
			<div className="flex flex-wrap gap-2 justify-between items-center">
				<Button
					variant="ghost"
					size="sm"
					className="-ml-2 gap-1 text-muted-foreground"
					onClick={() => navigate({ to: "/admin/articles" })}
				>
					<ArrowLeftIcon className="size-3.5" />
					返回文章列表
				</Button>
				<span className="text-xs text-muted-foreground">
					编辑内容会自动保存草稿，刷新或离开后可恢复
				</span>
			</div>

			<ArticleForm
				articleId={articleId}
				initialData={{
					title: article?.title ?? "",
					content: article?.content ?? "",
					contentType: (article?.contentType || "markdown") as
						| "markdown"
						| "html",
					copyright: article?.copyright ?? "",
				}}
				draftKey={`galzy:draft:intro:admin-${articleId}`}
				title="编辑文章"
				submitLabel="保存"
				customSubmit={handleCustomSubmit}
			/>
		</div>
	);
}
