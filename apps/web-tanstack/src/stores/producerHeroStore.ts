/**
 * @CLIENT_ONLY — 纯客户端 UI 状态，SSR 只读默认值。
 *
 * 游戏详情页点击厂商名进入 producer 详情页时，暂存 pid 供路由 pending
 * 骨架屏挂同名 view-transition-name 使用，实现厂商名文字飞行。
 * 只存最后一处交互的条目。
 */
import { createStore } from "@tanstack/react-store";

type ProducerHeroState = {
	/** 骨架屏按 pid 挂 viewTransitionName，null 时不挂 */
	pid: string | null;
};

export const producerHeroStore = createStore<ProducerHeroState>({
	pid: null,
});

export const producerHeroActions = {
	set(pid: string) {
		producerHeroStore.setState(() => ({ pid }));
	},
	clear() {
		producerHeroStore.setState(() => ({ pid: null }));
	},
};
