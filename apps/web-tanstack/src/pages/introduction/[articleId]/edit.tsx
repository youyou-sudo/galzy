import { defineRoute } from "@teyik0/furin";
import { ArticleForm } from "@web/components/introduction/article-form";
import { seoTemplate } from "@web/config/seoTemplate";
import { redirect, useNavigate, useRouter } from "@web/lib/nav";
import { seoMeta } from "@web/lib/seo";
import { getSession } from "@web/server/auth/auth.functions";
import { getIntroductionArticle } from "@web/server/introduction";
import { t } from "elysia";

const paramsSchema = t.Object({ articleId: t.String() });

/** ArticleForm 初始化用的字段子集 + 文章所属游戏身份 */
type EditableArticle = {
	title?: string | null;
	content?: string | null;
	contentType?: string | null;
	copyright?: string | null;
	vid?: string | null;
	otherid?: string | null;
} | null;

/**
 * 攻略编辑页（/introduction/:articleId/edit）。
 *
 * 旧 beforeLoad 的登录守卫落在 loader：未登录时 throw redirect 到登录页并带回跳
 * 地址（furin 没有 beforeLoad）。
 */
export const route = defineRoute("/introduction/[articleId]/edit")
	.config({ mode: "ssr", params: paramsSchema })
	.loader(async ({ params }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({
				to: "/auth/login",
				search: {
					return_to: `/introduction/${params.articleId}/edit`,
				},
			});
		}
		const article = (await getIntroductionArticle({
			data: { id: params.articleId },
		})) as EditableArticle;
		return { article, articleId: params.articleId };
	})
	.head(
		() =>
			seoMeta({
				title: `编辑攻略 | ${seoTemplate.title}`,
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
	article: EditableArticle;
	articleId: string;
}) {
	const navigate = useNavigate();
	const router = useRouter();

	// 文章所属游戏（vndb 锚点优先；kungal-only 条目回退 otherid）
	const gameId =
		(article as { vid?: string | null; otherid?: string | null } | null)?.vid ??
		(article as { otherid?: string | null } | null)?.otherid;

	const handleSuccess = () => {
		// 旧的 router.invalidate({ filter }) 在 furin 下退化为一次整页数据刷新
		void router.invalidate();
		if (gameId) {
			navigate({
				to: "/$id/introduction/$articleId",
				params: { id: String(gameId), articleId },
			});
		} else {
			navigate({ to: "/", search: {} });
		}
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
				draftKey={`galzy:draft:intro:article-${articleId}`}
				title="编辑攻略"
				submitLabel="保存"
				onSuccess={handleSuccess}
			/>
		</div>
	);
}
