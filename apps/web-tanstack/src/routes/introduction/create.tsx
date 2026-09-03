import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { ArticleForm } from "@web/components/introduction/article-form";
import { seoTemplate } from "@web/config/seoTemplate";
import { seoMeta } from "@web/lib/seo";
import { getSession } from "@web/server/auth/auth.functions";
import z from "zod";

export const Route = createFileRoute("/introduction/create")({
	component: RouteComponent,
	validateSearch: z.object({
		gameId: z.string().optional(),
	}),
	head: () =>
		seoMeta({
			title: `提交攻略 | ${seoTemplate.title}`,
			noindex: true,
		}),
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({
				to: "/auth/login",
				search: { return_to: "/introduction/create" },
			});
		}
	},
});

function RouteComponent() {
	const { gameId } = Route.useSearch();
	const navigate = useNavigate();
	const router = useRouter();

	if (!gameId) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				缺少游戏 ID，无法提交攻略喵～
			</div>
		);
	}

	const handleSuccess = () => {
		router.invalidate({
			filter: (match) =>
				match.routeId === "/$id/_layout/introduction/" ||
				match.routeId === "/$id/_layout/introduction/$articleId",
		});
		navigate({ to: "/$id/introduction", params: { id: gameId } });
	};

	return (
		<div>
			<ArticleForm
				gameId={gameId}
				draftKey={`galzy:draft:intro:game-${gameId}`}
				title="提交攻略"
				submitLabel="提交"
				onSuccess={handleSuccess}
			/>
		</div>
	);
}