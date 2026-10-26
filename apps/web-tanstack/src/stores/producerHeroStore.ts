/**
 * @CLIENT_ONLY — 纯客户端 UI 状态，SSR 只读默认值。
 *
 * 从任意厂商入口（游戏条目页的开发/发行、厂商检索列表、厂商关系）点进 producer
 * 详情页时，先把 pid 与已知展示名存下来：详情 loader 返回前，pending 态就能用
 * 真实厂商名渲染面包屑与卡片标题，并挂同名 view-transition-name 做厂商名文字飞行，
 * 而不是整页骨架。只存最后一处交互的厂商。
 *
 * 与 tagHeroStore 同构；入口只给了 pid（拿不到名字）时 name 为空串，pending 退回骨架。
 */
import { createStore } from "@tanstack/react-store";

type ProducerHeroState = {
	/** 与当前详情页 pid 相同才消费，避免切换厂商后误用旧名字 */
	pid: string | null;
	/** 展示名；入口拿不到名字时是空串，pending 会退回骨架 */
	name: string;
};

export const producerHeroStore = createStore<ProducerHeroState>({
	pid: null,
	name: "",
});

/** 各厂商入口的数据形状：游戏条目页/检索列表/关系链都只给 id + name */
type ProducerHeroInput = {
	id?: string | null;
	name?: string | null;
};

/** 空值安全的 trim：null/undefined/纯空白一律折叠成空串 */
const trimmed = (value: string | null | undefined) => value?.trim() ?? "";

export const producerHeroActions = {
	/**
	 * 厂商链接点击时回写 pid + 展示名。pid 缺失/为空直接忽略
	 * （宁可不复用，也别污染别的厂商）。
	 */
	fromProducer(input: ProducerHeroInput) {
		const pid = trimmed(input.id);
		if (!pid) return;
		producerHeroStore.setState(() => ({ pid, name: trimmed(input.name) }));
	},
	clear() {
		producerHeroStore.setState(() => ({ pid: null, name: "" }));
	},
};
