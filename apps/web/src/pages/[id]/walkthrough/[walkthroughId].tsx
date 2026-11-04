import { defineRoute, notFound } from "@teyik0/furin";
import { readWalkthroughDetail } from "@web/components/walkthrough/types";
import { WalkthroughPage } from "@web/components/walkthrough/walkthrough-page";
import { seoTemplate } from "@web/config/seoTemplate";
import { ApiError } from "@web/lib";
import { gameTitleOf } from "@web/lib/seo";
import { type getGameDetail, getWalkthroughInfo } from "@web/server/game";
import { t } from "elysia";
import * as z from "zod/mini";

const paramsSchema = t.Object({
	id: t.String(),
	walkthroughId: t.String(),
});

/**
 * 页内状态走查询串：view / lang / character 都只影响展示，不影响取数，
 * 所以这里用字符串兜底（旧值/手改值在组件里落回默认视图，不 500）。
 */
const searchSchema = z.object({
	view: z.optional(z.string()),
	lang: z.optional(z.string()),
	character: z.optional(z.string()),
});

type GameDetail = NonNullable<Awaited<ReturnType<typeof getGameDetail>>>;

/**
 * 作品侧元信息：概览卡要「制作会社 / 发售日期」，
 * 数据来自布局 loader 的 game（VNDB 厂商与发售日），不走攻略 DTO——
 * DTO 里的 release.companies 是发行版/汉化补丁的组名，不是制作会社。
 */
function workMetaOf(game: GameDetail | null | undefined) {
	const released = game?.released_first ?? null;
	const companies: string[] = [];
	for (const producer of game?.producers ?? []) {
		const name = producer?.name?.trim();
		if (!name || companies.includes(name)) continue;
		companies.push(name);
	}
	return { releasedAt: released, companies };
}

/**
 * 取攻略，把后端的 404 翻成路由级 notFound。
 *
 * 后端 Walkthrough.Info 对不存在的 id 直接 throw status(404)，BFF 的
 * elysiaErrorF 会把它包成 ApiError 抛出。不在这里拦下来的话，用户看到的是
 * furin 的通用错误页（「页面加载出错了…」），而不是「攻略不存在」。
 */
async function loadWalkthrough(walkthroughId: string) {
	try {
		return await getWalkthroughInfo({ data: { walkthroughId } });
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) {
			notFound({ message: "攻略不存在" });
		}
		throw error;
	}
}

/**
 * 攻略详情（/:id/walkthrough/:walkthroughId）。
 *
 * 整张选项流程图在 loader 里就取回来：图表是这页的主体内容，
 * 客户端再补一次请求只会让首屏先出现「图表加载中」。
 */
export const route = defineRoute("/[id]/walkthrough/[walkthroughId]")
	.config({ mode: "ssr", params: paramsSchema, query: searchSchema })
	.loader(async ({ params }) => {
		const walkthrough = await loadWalkthrough(params.walkthroughId);
		// BFF 正常返回时才可能为 null（API 对不存在的 id 直接 404）
		if (!walkthrough) notFound({ message: "攻略不存在" });
		return { walkthrough };
	})
	.head(({ game, walkthrough }) => {
		const detail = readWalkthroughDetail(walkthrough);
		const title = gameTitleOf(game);
		// 参考站标题带结局数（「全 13 结局路线选项与存档点」）：攻略页最有用的
		// 信息就是覆盖面，字段缺失时退回不带数字的写法
		const endingCount = detail?.endingCount ?? 0;
		return {
			meta: [
				{
					title:
						endingCount > 0
							? `${title} 全 ${endingCount} 结局攻略 | ${seoTemplate.title}`
							: `${title} 攻略 | ${seoTemplate.title}`,
				},
				{
					name: "description",
					content: `${title} 的全结局路线攻略：选项分支、存档点与流程图`,
				},
			],
		};
	})
	.page(({ walkthrough, query, id, game }) => {
		const work = workMetaOf(game);
		return (
			<WalkthroughPage
				companies={work.companies}
				data={walkthrough}
				gameId={id}
				initialCharacter={query.character}
				initialLang={query.lang}
				initialView={query.view}
				releasedAt={work.releasedAt}
			/>
		);
	});
