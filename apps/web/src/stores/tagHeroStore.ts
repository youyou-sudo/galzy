/**
 * @CLIENT_ONLY — 纯客户端 UI 状态，SSR 只读默认值。
 *
 * 从任意标签入口（游戏页标签、标签库、分类页、热门标签、层级图）点进标签详情时，
 * 先把已知的展示名存下来：详情 loader 返回前，pending 态就能用真实标题渲染首屏，
 * 而不是整页骨架。只存最后一处交互的标签。
 *
 * 与 gameHeroStore 同构；区别是标签入口散落在多个组件里，所以回写统一走
 * tagHeroActions.fromTag（各入口传各自的数据形状，展示名兜底链在 store 里收敛）。
 */
import { createStore } from "@tanstack/react-store";

export type TagHeroData = {
	id: string;
	/** 展示名（中文名优先）。入口只给了 id 时可能是空字符串，pending 会退回骨架 */
	name: string;
};

type TagHeroState = {
	/** 与当前详情页 tagId 匹配时才消费，避免切换标签后误用旧名字 */
	id: string | null;
	data: TagHeroData | null;
};

export const tagHeroStore = createStore<TagHeroState>({
	id: null,
	data: null,
});

/** 各入口的标签数据形状：标签流/标签库/分类页/热门标签/层级图各取各的字段 */
type TagHeroInput = {
	id?: string | null;
	/** 中文名（VNDB 标签同步表字段） */
	zht_name?: string | null;
	/** 标签库接口字段 */
	zh_name?: string | null;
	/** 展示名原文 */
	name?: string | null;
};

/** 空值安全的 trim：null/undefined/纯空白一律折叠成空串 */
const trimmed = (value: string | null | undefined) => value?.trim() ?? "";

export const tagHeroActions = {
	/**
	 * 标签链接点击时回写展示名。id 缺失/为空直接忽略（宁可不复用，也别污染别的标签）；
	 * 展示名按「中文名 → 标签库中文名 → 原文」兜底。
	 *
	 * 注意候选值要各自 trim 后再判空：先取第一个真值再统一 trim 的话，纯空白的中文名
	 * 会把整串短路成空串，原文就永远轮不上了。
	 */
	fromTag(input: TagHeroInput) {
		const id = trimmed(input.id);
		if (!id) return;
		const name =
			[input.zht_name, input.zh_name, input.name]
				.map(trimmed)
				.find((value) => value.length > 0) ?? "";
		tagHeroStore.setState(() => ({ id, data: { id, name } }));
	},
};
