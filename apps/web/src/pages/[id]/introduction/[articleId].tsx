import { defineRoute } from "@teyik0/furin";
import ArticlePage from "@web/components/introduction/article-page";
import { seoTemplate } from "@web/config/seoTemplate";
import { getIntroductionArticle } from "@web/server/introduction";
import { t } from "elysia";

const paramsSchema = t.Object({ id: t.String(), articleId: t.String() });

/** ArticlePage 消费的字段子集（BFF 返回类型在本轮迁移中收敛前先显式声明） */
type ArticlePayload = {
	title?: string | null;
	content?: string | null;
	contentType?: string | null;
	copyright?: string | null;
	vid?: string | null;
	otherid?: string | null;
} | null;

/** 攻略文章详情（/:id/introduction/:articleId） */
export const route = defineRoute("/[id]/introduction/[articleId]")
	.config({ mode: "ssr", params: paramsSchema })
	.loader(async ({ params }) => ({
		article: (await getIntroductionArticle({
			data: { id: params.articleId },
		})) as ArticlePayload,
		gameId: params.id,
		articleId: params.articleId,
	}))
	.head(({ article }) => ({
		meta: [
			{ title: `${article?.title} | ${seoTemplate.title}` },
			{ name: "description", content: `${article?.title ?? ""}` },
		],
	}))
	.page(({ article, gameId, articleId }) => (
		<ArticlePage article={article} gameId={gameId} articleId={articleId} />
	));
