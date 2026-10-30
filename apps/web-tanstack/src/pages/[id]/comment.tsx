import { defineRoute } from "@teyik0/furin";
import { CommentItem } from "@web/components/cmments";
import { ReplyEidtInput } from "@web/components/cmments/reply-edit-input";
import { seoTemplate } from "@web/config/seoTemplate";
import { gameTitleOf } from "@web/lib/seo";
import { getCmments } from "@web/server/comments";
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

/**
 * 评论页签（/$id/comment）。
 *
 * 评论数据由 loader 直取（旧实现同样走 loader），并作为 CommentItem 的
 * initialData —— CommentItem 通过 getRouteApi("/$id/_layout/comment") 读取
 * 本页 loader data，因此这里返回的字段名必须保持 commentsData / id 不变。
 */
export const route = defineRoute("/[id]/comment")
	.config({ mode: "ssr", params: paramsSchema })
	.loader(async ({ params }) => ({
		commentsData: await getCmments({
			data: {
				targetType: "game",
				targetId: params.id,
			},
		}),
	}))
	.head(({ game }) => ({
		meta: [
			{ title: `${gameTitleOf(game)} 评论 | ${seoTemplate.title}` },
			{ name: "description", content: gameDescription(game) },
		],
	}))
	.page(({ id }) => (
		<div>
			<ReplyEidtInput targetId={id} commentscomp={true} targetType="game" />
			<CommentItem targetType="game" />
		</div>
	));
