import { defineRoute } from "@teyik0/furin";
import { RelationsPage } from "@web/components/home/game/relations/relations-page";
import { seoTemplate } from "@web/config/seoTemplate";
import { gameTitleOf } from "@web/lib/seo";
import { getGameRelations } from "@web/server/game";
import { t } from "elysia";

const paramsSchema = t.Object({ id: t.String() });

type GameSeoSource = {
	vn?: { alias?: string | null; description?: string | null } | null;
} | null;

/** 旧布局 head 的 description 文案（页签页沿用同一份，保持 meta 合并语义） */
function gameDescription(game: GameSeoSource | undefined) {
	const title = gameTitleOf(game);
	return `${title} 资源下载，游戏别名：${game?.vn?.alias || "无"}，简介：${game?.vn?.description || "暂无简介"}`;
}

/** 系列关系页签（/$id/relations）：数据给 RelationsPage 自己从 page props 读 */
export const route = defineRoute("/[id]/relations")
	.config({ mode: "isr", revalidate: 300, params: paramsSchema })
	.loader(async ({ params }) => ({
		relations: await getGameRelations({ data: { id: params.id } }),
	}))
	.head(({ game }) => ({
		meta: [
			{
				title: `${gameTitleOf(game)} 系列关系 | ${seoTemplate.title}`,
			},
			{ name: "description", content: gameDescription(game) },
		],
	}))
	.page(() => <RelationsPage />);
