import { defineRoute } from "@teyik0/furin";
import { CharactersPage } from "@web/components/game/characters/characters-page";
import { seoTemplate } from "@web/config/seoTemplate";
import { gameTitleOf } from "@web/lib/seo";
import { getGameCharacters } from "@web/server/game";
import { t } from "elysia";

const paramsSchema = t.Object({ id: t.String() });

type GameSeoSource = {
	vn?: { alias?: string | null; description?: string | null } | null;
} | null;

/** 与其它页签同源：标题取作品名，description 换成角色页的说明 */
function gameDescription(game: GameSeoSource | undefined) {
	const title = gameTitleOf(game);
	return `${title} 角色详情，收录该作品的主要角色、次要角色与登场角色介绍。`;
}

/**
 * 条目页「详情」页签（/:id/characters）。
 *
 * 名册由 loader 直取（与攻略/统计/系列同一套写法），角色资料（性别/生日/三围/
 * 简介/属性/出演作品）在打开弹窗时按需拉取，不进首屏关键路径。
 */
export const route = defineRoute("/[id]/characters")
	.config({ mode: "ssr", params: paramsSchema })
	.loader(async ({ params }) => ({
		characters: await getGameCharacters({ data: { id: params.id } }),
	}))
	.head(({ game }) => ({
		meta: [
			{ title: `${gameTitleOf(game)} 角色详情 | ${seoTemplate.title}` },
			{ name: "description", content: gameDescription(game) },
		],
	}))
	.page(({ characters }) => <CharactersPage data={characters} />);
