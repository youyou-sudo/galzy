import { useQueryClient } from "@tanstack/react-query";
import { defineRoute } from "@teyik0/furin";
import { t } from "elysia";
import { ArticleForm } from "@web/components/introduction/article-form";
import { Button } from "@web/components/ui/button";
import { invalidations } from "@web/lib/admin/query-keys";
import { useNavigate } from "@web/lib/nav";
import { seoMeta } from "@web/lib/seo";
import { adminUpdateArticle } from "@web/server/admin/articles";
import { getIntroductionArticle } from "@web/server/introduction";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";

/**
 * 后台文章表单只用到这 4 个字段。BFF `getIntroductionArticle` 的返回类型是
 * Eden 透传（旧代码靠 @ts-nocheck 绕过），这里就地声明表单需要的形状。
 */
type ArticleDetail = {
	id?: number | string;
	title?: string | null;
	content?: string | null;
	contentType?: string | null;
	copyright?: string | null;
};

/**
 * 后台文章编辑（等价旧 `routes/admin/_authL/articles.$articleId.edit.tsx`）。
 *
 * params 必须用 TypeBox：furin 的路由校验读 `schema.properties` 判断
 * 路径参数是否被声明（zod 没有这个字段，会直接启动失败）。
 */
export const route = defineRoute("/admin/articles/[articleId]/edit")
	.config({ mode: "ssr", params: t.Object({ articleId: t.String() }) })
	.loader(async ({ params }) => {
		const article = (await getIntroductionArticle({
			data: { id: params.articleId },
		})) as ArticleDetail | null;
		return { article, articleId: params.articleId };
	})
	.head(
		() =>
			seoMeta({
				title: "编辑文章 | GalZY - Galgame 资源站",
				noindex: true,
			}) as never,
	)
	.page(({ article, articleId }) => (
		<EditArticlePage article={article} articleId={articleId} />
	));

function EditArticlePage({
	article,
	articleId,
}: {
	article: ArticleDetail | null;
	articleId: string;
}) {
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
		void navigate({ to: "/admin/articles" });
	};

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
			<div className="flex flex-wrap gap-2 justify-between items-center">
				<Button
					variant="ghost"
					size="sm"
					className="-ml-2 gap-1 text-muted-foreground"
					onClick={() => void navigate({ to: "/admin/articles" })}
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