import { defineRoute } from "@teyik0/furin";
import { DownloadOptions } from "@web/components/home/game/download-options";
import { seoTemplate } from "@web/config/seoTemplate";
import { gameTitleOf } from "@web/lib/seo";
import { t } from "elysia";

const paramsSchema = t.Object({ id: t.String() });

type GameSeoSource = {
	vn?: { alias?: string | null; description?: string | null } | null;
} | null;

/** 旧布局 head 的 description 文案（含别名 / 简介），页签页共用 */
function downloadDescription(game: GameSeoSource | undefined) {
	const title = gameTitleOf(game);
	return `${title} 资源下载，游戏别名：${game?.vn?.alias || "无"}，简介：${game?.vn?.description || "暂无简介"}`;
}

/**
 * 下载页签（/$id 本身）。
 *
 * 文件列表沿用「懒加载」设计：不在 loader 里阻塞，由 DownloadOptions 内部的
 * useQuery(filelistQueryOptions) 在客户端拉取；任务书里「下载 tab 懒加载」是
 * 旧实现的显式决策，迁移不改。
 */
export const route = defineRoute("/[id]")
	.config({ mode: "ssr", params: paramsSchema })
	.head(({ game }) => ({
		meta: [
			{ title: `${gameTitleOf(game)} 下载 | ${seoTemplate.title}` },
			{ name: "description", content: downloadDescription(game) },
		],
	}))
	.page(() => <DownloadOptions />);
