/**
 * 广告（广告位 + 素材 + 排期 + 定向 + 权重 + 统计）的前端类型与查询键。
 *
 * 行业模型（Google Ad Manager / Advanced Ads 等）：广告位（Position/Slot）描述
 * 「展示在哪里」，广告素材（Creative）描述「展示什么、什么时候展示、给谁展示」。
 * 前台按广告位的 key 取投放中的素材，见 server/adverts 的 getAdSlot。
 */

/** 素材的设备定向：全部 / 仅桌面 / 仅移动（替代旧版 showOnMobile）。 */
export type AdvertDevice = "all" | "desktop" | "mobile";

/** 广告位的手机端展示方式：轮播 / 竖向堆叠 / 不展示。 */
export type AdMobileMode = "carousel" | "stack" | "hidden";

/** 由 enabled + 排期推导的投放状态（后台展示用）。 */
export type AdvertStatus = "running" | "scheduled" | "expired" | "paused";

/** 广告位（配置，后台可增删改；前台按 key 读取）。 */
export interface AdSlot {
	id: number;
	key: string;
	name: string;
	description: string | null;
	/** 同一轮最多展示几条素材（桌面并排 / 手机轮播的条数） */
	maxItems: number;
	mobileMode: AdMobileMode;
	/** 手机端自动轮播间隔（秒），0 = 不自动切换 */
	carouselInterval: number;
	enabled: boolean;
	createdAt: string | null;
	updatedAt: string | null;
}

/** 后台广告位列表附带该位下的素材总数（用于删除前提示）。 */
export interface AdSlotWithCount extends AdSlot {
	advertCount: number;
}

/** 广告素材（图片 + 链接 + 排期 + 定向 + 权重），归属于某个广告位。 */
export interface Advert {
	id: number;
	slotId: number;
	name: string;
	image: string;
	href: string;
	/** 后台备注，前台不展示 */
	description: string | null;
	enabled: boolean;
	device: AdvertDevice;
	/** 权重：候选多于展示位时按权重随机轮换，默认 10 */
	weight: number;
	/** 排期开始，null = 立即开始 */
	startAt: string | null;
	/** 排期结束，null = 长期投放 */
	endAt: string | null;
	sortOrder: number;
	impressions: number;
	clicks: number;
	/** 服务端按 enabled + 排期推导的状态 */
	status: AdvertStatus;
	createdAt: string | null;
	updatedAt: string | null;
}

/** 公开接口返回的最小素材字段（不含后台备注与统计）。 */
export interface PublicAdvert {
	id: number;
	name: string;
	image: string;
	href: string;
	device: AdvertDevice;
}

/** 公开接口 GET /adverts/slot/:key 的返回：平台/设备各自一份已选好的素材。 */
export interface AdSlotPayload {
	slot: {
		key: string;
		name: string;
		maxItems: number;
		mobileMode: AdMobileMode;
		carouselInterval: number;
	};
	/** 桌面（含 device=all）的投放素材，已按排序/权重选好 */
	desktop: PublicAdvert[];
	/** 移动（含 device=all）的投放素材，已按排序/权重选好 */
	mobile: PublicAdvert[];
}

/** 顶部横幅广告位的 key（后台可改广告配置，但位置 key 与组件绑定）。 */
export const TOP_AD_SLOT_KEY = "home_top";

/** 公开广告位数据 query key 前缀：根布局预取 / 前台组件 / 后台失效共用同一份。 */
export const AD_SLOT_QUERY_ROOT = ["adverts", "slot"] as const;

export function adSlotQueryKey(key: string) {
	return [...AD_SLOT_QUERY_ROOT, key] as const;
}

/** 后台广告位列表的默认展示条数上限（API 校验 1..4）。 */
export const AD_SLOT_MAX_ITEMS_LIMIT = 4;

/** 设备定向的中文文案（前后台共用，避免多处漂移）。 */
export const ADVERT_DEVICE_LABEL: Record<AdvertDevice, string> = {
	all: "全部设备",
	desktop: "仅桌面",
	mobile: "仅移动",
};

/** 广告位手机端展示方式的中文文案。 */
export const AD_MOBILE_MODE_LABEL: Record<AdMobileMode, string> = {
	carousel: "轮播",
	stack: "竖向堆叠",
	hidden: "不展示",
};

/** 投放状态的中文文案。 */
export const ADVERT_STATUS_LABEL: Record<AdvertStatus, string> = {
	running: "投放中",
	scheduled: "未开始",
	expired: "已结束",
	paused: "已停用",
};
