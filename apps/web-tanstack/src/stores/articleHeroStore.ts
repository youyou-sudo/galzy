/**
 * @CLIENT_ONLY — 纯客户端 UI 状态，SSR 只读默认值。
 *
 * 从攻略列表点进文章详情时，先把已知标题存下来：详情 loader 返回前，pending 态
 * 就能用真实标题渲染页头（标题与列表条目共用同名 view-transition-name，路由
 * 切换时继续「飞入」页头），而不是整块内容区空白、标题等数据到了才出现。
 * 只存最后一处交互的文章，与 gameHeroStore / tagHeroStore / producerHeroStore
 * 同构。
 */
import { createStore } from "@tanstack/react-store";

export type ArticleHeroData = {
	id: string;
	/** 标题；入口只给了 id 时是空串，pending 会退回标题骨架 */
	title: string;
};

type ArticleHeroState = {
	/** 与当前详情页 articleId 匹配时才消费，避免切到别的文章后误用上一篇标题 */
	id: string | null;
	data: ArticleHeroData | null;
};

export const articleHeroStore = createStore<ArticleHeroState>({
	id: null,
	data: null,
});

/** 空值安全的 trim：null/undefined/纯空白一律折叠成空串 */
const trimmed = (value: string | null | undefined) => value?.trim() ?? "";

export const articleHeroActions = {
	/**
	 * 文章链接点击时回写标题。id 缺失/为空直接忽略（宁可不复用，也别污染
	 * 别的文章）；标题只做 trim，空串由 pending 退回骨架。
	 */
	fromArticle(input: { id?: string | number | null; title?: string | null }) {
		const id = trimmed(input.id == null ? "" : String(input.id));
		if (!id) return;
		articleHeroStore.setState(() => ({
			id,
			data: { id, title: trimmed(input.title) },
		}));
	},
};
