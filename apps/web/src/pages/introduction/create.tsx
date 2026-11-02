import { defineRoute } from "@teyik0/furin";
import { ArticleForm } from "@web/components/introduction/article-form";
import { EmptyState } from "@web/components/shared/empty-state";
import { Button } from "@web/components/ui/button";
import { seoTemplate } from "@web/config/seoTemplate";
import { Link, redirect, useNavigate, useRouter } from "@web/lib/nav";
import { seoMeta } from "@web/lib/seo";
import { getSession } from "@web/server/auth/auth.functions";
import { Gamepad2 } from "lucide-react";
import * as z from "zod/mini";

const querySchema = z.object({
	gameId: z.optional(z.string()),
});

/**
 * 攻略提交页（/introduction/create?gameId=...）。
 *
 * 旧 beforeLoad 的登录守卫落在 loader；旧的 validateSearch 换成 config.query
 * （query 用 zod 是 furin 支持的 Standard Schema 形态）。
 */
export const route = defineRoute("/introduction/create")
	.config({ mode: "ssr", query: querySchema })
	.loader(async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({
				to: "/auth/login",
				search: { return_to: "/introduction/create" },
			});
		}
		return {};
	})
	.head(
		() =>
			seoMeta({
				title: `提交攻略 | ${seoTemplate.title}`,
				noindex: true,
			}) as never,
	)
	.page(({ query }) => <CreateArticlePage gameId={query.gameId} />);

function CreateArticlePage({ gameId }: { gameId?: string }) {
	const navigate = useNavigate();
	const router = useRouter();

	if (!gameId) {
		return (
			<EmptyState
				icon={Gamepad2}
				title="缺少游戏 ID"
				description="请从游戏详情页的「攻略」页签进入提交入口"
				action={
					<Button variant="outline" render={<Link to="/games" />}>
						去逛游戏
					</Button>
				}
			/>
		);
	}

	const handleSuccess = () => {
		void router.invalidate();
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
