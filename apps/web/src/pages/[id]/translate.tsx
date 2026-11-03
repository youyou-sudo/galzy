import { defineRoute } from "@teyik0/furin";
import { ChartAreaLinear } from "@web/components/home/game/translate/chart-area-linear";
import { seoTemplate } from "@web/config/seoTemplate";
import { gameTitleOf } from "@web/lib/seo";
import { translateData } from "@web/server/game";
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

/** 下载统计页签（/$id/translate） */
export const route = defineRoute("/[id]/translate")
	.config({ mode: "ssr", params: paramsSchema })
	.loader(async ({ params }) => ({
		translateData: await translateData({ data: { id: params.id } }),
	}))
	.head(({ game }) => ({
		meta: [
			{
				title: `${gameTitleOf(game)} 下载统计 | ${seoTemplate.title}`,
			},
			{ name: "description", content: gameDescription(game) },
		],
	}))
	.page(() => <ChartAreaLinear />);
