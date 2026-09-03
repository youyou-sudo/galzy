import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArticleForm } from "@web/components/introduction/article-form";
import { seoMeta } from "@web/lib/seo";
import { adminUpdateArticle } from "@web/server/admin/articles";
import { getIntroductionArticle } from "@web/server/introduction";
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
		queryClient.invalidateQueries({ queryKey: ["admin-all-articles"] });
		navigate({ to: "/admin/articles" });
	};

	return (
		<div>
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