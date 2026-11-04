import { defineRoute } from "@teyik0/furin";
import { WalkthroughListPage } from "@web/components/walkthrough/walkthrough-list-page";
import { seoTemplate } from "@web/config/seoTemplate";
import { gameTitleOf } from "@web/lib/seo";
import { getGameWalkthroughs } from "@web/server/game";
import { t } from "elysia";

const paramsSchema = t.Object({ id: t.String() });

type GameSeoSource = {
	vn?: { alias?: string | null; description?: string | null } | null;
} | null;

/** 与其它页签同源：标题取作品名，description 换成攻略页的说明 */
function gameDescription(game: GameSeoSource | undefined) {
	const title = gameTitleOf(game);
	return `${title} 攻略，收录该作品的全结局路线、选项分支与存档点整理。`;
}

/**
 * 条目页「攻略」页签（/:id/walkthrough）。
 *
 * 数据源是 kungal walkthrough：站内不再有攻略文章，页签只做「收录了哪些攻略」
 * 的列表（通常 1 条）。body 全部来自 loader，客户端不二次取数。
 */
export const route = defineRoute("/[id]/walkthrough")
	.config({ mode: "ssr", params: paramsSchema })
	.loader(async ({ params }) => ({
		walkthroughs: await getGameWalkthroughs({ data: { id: params.id } }),
	}))
	.head(({ game }) => ({
		meta: [
			{ title: `${gameTitleOf(game)} 攻略 | ${seoTemplate.title}` },
			{ name: "description", content: gameDescription(game) },
		],
	}))
	.page(({ walkthroughs, id }) => (
		<WalkthroughListPage data={walkthroughs} gameId={id} />
	));
