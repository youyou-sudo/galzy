import { useQuery, useQueryClient } from "@tanstack/react-query";
import { defineRoute } from "@teyik0/furin";
import { ArticleForm } from "@web/components/introduction/article-form";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import { invalidations } from "@web/lib/admin/query-keys";
import { useNavigate } from "@web/lib/nav";
import { seoMeta } from "@web/lib/seo";
import { documentOnly, isSpaDataRequest } from "@web/lib/spa-request";
import { adminUpdateArticle } from "@web/server/admin/articles";
import { getIntroductionArticle } from "@web/server/introduction";
import { t } from "elysia";
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

const ARTICLE_QUERY_KEY = ["admin", "articles", "edit"] as const;

/**
 * 后台文章编辑（等价旧 `routes/admin/_authL/articles.$articleId.edit.tsx`）。
 *
 * params 必须用 TypeBox：furin 的路由校验读 `schema.properties` 判断
 * 路径参数是否被声明（zod 没有这个字段，会直接启动失败）。
 *
 * 取数分两条路（同其它后台页）：文档请求时 loader 带数据进水合；
 * 站内切页时 loader 返回 null，表单页自己用 useQuery 拉一次并先显示骨架，
 * 这样「点进编辑」不必等一个服务端往返就能切过去。
 */
export const route = defineRoute("/admin/articles/[articleId]/edit")
	.config({ mode: "ssr", params: t.Object({ articleId: t.String() }) })
	.loader(async ({ params, request }) => ({
		seeded: !isSpaDataRequest(request),
		article: await documentOnly(request, async () => {
			const article = (await getIntroductionArticle({
				data: { id: params.articleId },
			})) as ArticleDetail | null;
			return article;
		}),
		articleId: params.articleId,
	}))
	.head(
		() =>
			seoMeta({
				title: "编辑文章 | GalZY - Galgame 资源站",
				noindex: true,
			}) as never,
	)
	.page(({ article, articleId, seeded }) => (
		<EditArticlePage article={article} articleId={articleId} seeded={seeded} />
	));

function EditArticlePage({
	article,
	articleId,
	seeded,
}: {
	article: ArticleDetail | null;
	articleId: string;
	seeded: boolean;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	// 站内切页（seeded=false）才需要客户端补取；文档请求直接用 loader 数据
	const fallback = useQuery({
		queryKey: [...ARTICLE_QUERY_KEY, articleId],
		queryFn: async () =>
			(await getIntroductionArticle({
				data: { id: articleId },
			})) as ArticleDetail | null,
		enabled: !seeded,
		staleTime: 30_000,
	});

	const resolved: ArticleDetail | null = seeded
		? article
		: (fallback.data ?? null);

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
		// 后台统一 key 前缀：一次失效文章列表、编辑页缓存与仪表盘统计
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

			{!seeded && fallback.isLoading ? (
				<ArticleFormSkeleton />
			) : (
				<ArticleForm
					articleId={articleId}
					initialData={{
						title: resolved?.title ?? "",
						content: resolved?.content ?? "",
						contentType: (resolved?.contentType || "markdown") as
							| "markdown"
							| "html",
						copyright: resolved?.copyright ?? "",
					}}
					draftKey={`galzy:draft:intro:admin-${articleId}`}
					title="编辑文章"
					submitLabel="保存"
					customSubmit={handleCustomSubmit}
				/>
			)}
		</div>
	);
}

/** 编辑器的骨架：只占位，不渲染空编辑器（避免把空内容写进草稿）。 */
function ArticleFormSkeleton() {
	return (
		<div
			className="flex flex-col gap-3"
			aria-busy="true"
			aria-label="文章加载中"
		>
			<Skeleton className="h-9 w-2/3 rounded-lg" />
			<Skeleton className="h-11 w-full rounded-xl" />
			<Skeleton className="h-72 w-full rounded-2xl" />
		</div>
	);
}
