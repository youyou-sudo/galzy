import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { ArticleForm } from "@web/components/introduction/article-form";
import { seoTemplate } from "@web/config/seoTemplate";
import { seoMeta } from "@web/lib/seo";
import { getSession } from "@web/server/auth/auth.functions";
import { getIntroductionArticle } from "@web/server/introduction";

export const Route = createFileRoute("/introduction/$articleId/edit")({
	component: RouteComponent,
	head: () =>
		seoMeta({
			title: `编辑攻略 | ${seoTemplate.title}`,
			noindex: true,
		}),
	beforeLoad: async ({ params }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({
				to: "/auth/login",
				search: {
					return_to: `/introduction/${params.articleId}/edit`,
				},
			});
		}
	},
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
	const router = useRouter();
	const gameId = (article as any)?.vid ?? (article as any)?.otherid;

	const handleSuccess = () => {
		router.invalidate({
			filter: (match) =>
				match.routeId === "/$id/_layout/introduction/" ||
				match.routeId === "/$id/_layout/introduction/$articleId",
		});
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