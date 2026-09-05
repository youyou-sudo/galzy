/**
 * @CLIENT_ONLY — 纯客户端 UI 状态，SSR 只读默认值。
 *
 * 卡片点击进入详情页时，先用列表已有的封面/标题等数据即时渲染「首屏英雄区」，
 * 完整详情（描述/发行/厂商）由 loader 完成后替换。只存最后一处交互的条目。
 */
import { createStore } from "@tanstack/react-store";

export type GameHeroData = {
	id: string;
	title: string;
	olangTitle: string;
	imageUrl: string;
	thumbhash?: string | null;
	width?: number;
	height?: number;
	cSexualAvg?: number | null;
};

type GameHeroState = {
	/** 与当前详情页 id 匹配时才消费，避免滚动换卡后误用旧数据 */
	id: string | null;
	data: GameHeroData | null;
};

export const gameHeroStore = createStore<GameHeroState>({
	id: null,
	data: null,
});

export const gameHeroActions = {
	set(data: GameHeroData) {
		gameHeroStore.setState(() => ({ id: data.id, data }));
	},
};
