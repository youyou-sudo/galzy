import type { LinkProps } from "@web/lib/nav";
import type { LucideIcon } from "lucide-react";
import {
	Building2,
	ExternalLink,
	Home,
	Library,
	Mail,
	Megaphone,
	MessageSquare,
	Tags,
	Wrench,
} from "lucide-react";

/**
 * 顶栏导航的唯一数据源。
 *
 * 桌面下拉面板、移动端全屏菜单都从这里取条目——文案、图标、描述、链接只写一份，
 * 不会再出现「桌面改了、移动端忘改」或两处顺序漂移。
 * **key 列表的顺序就是按钮顺序**，调整导航只需要改下面的 `*Keys`。
 *
 * 推广位（顶栏最后一格）不在这里：它归后台「广告位」（广告位 key = header_nav），
 * 链接与文案由后台下发，见 components/adverts/nav-ad.tsx。
 */

type HeaderNavBase = {
	/** 按钮文案 */
	label: string;
	/** 下拉面板 / 全屏菜单里的补充说明 */
	description: string;
	icon: LucideIcon;
};

/** 站内条目用 to（TanStack Link），站外条目用 href，渲染时按 type 分支。 */
export type HeaderNavItem =
	| (HeaderNavBase & { type: "internal"; to: LinkProps["to"] })
	| (HeaderNavBase & { type: "external"; href: string });

const nav = {
	home: {
		type: "internal",
		label: "主站",
		description: "GalZY 游戏资源主页",
		icon: Home,
		to: "/",
	},
	oplist: {
		type: "external",
		label: "OpList 站",
		description: "Openlist 搭建 · list.galzy.moe",
		icon: ExternalLink,
		href: "https://list.galzy.moe",
	},
	notice: {
		type: "external",
		label: "防失联&发布页",
		description: "维护公告 · 防失联 · 地址发布",
		icon: Megaphone,
		href: "https://galzy.top/",
	},
	contact: {
		type: "internal",
		label: "联系",
		description: "问题反馈 · 合作赞助",
		icon: Mail,
		to: "/contact",
	},
	tags: {
		type: "internal",
		label: "标签",
		description: "按标签分类浏览游戏",
		icon: Tags,
		to: "/tags",
	},
	producer: {
		type: "internal",
		label: "会社",
		description: "按制作会社检索作品",
		icon: Building2,
		to: "/producer",
	},
	collections: {
		type: "internal",
		label: "合集",
		description: "编辑精选的主题合集",
		icon: Library,
		to: "/collections",
	},
	topics: {
		type: "internal",
		label: "论坛",
		description: "玩家交流与讨论",
		icon: MessageSquare,
		to: "/topics",
	},
	tools: {
		type: "internal",
		label: "所有工具",
		description: "查看全部实用工具",
		icon: Wrench,
		to: "/tools",
	},
	plate: {
		type: "internal",
		label: "车牌号跳转",
		description: "快速跳转到 nhentai、禁漫天堂等网站",
		icon: ExternalLink,
		to: "/tools/plate",
	},
} satisfies Record<string, HeaderNavItem>;

export type HeaderNavKey = keyof typeof nav;

/** 对外暴露同一份对象（不抹平字面量，Link 的 to 才能保持精确） */
export const headerNav = nav;

export const navItem = (key: HeaderNavKey): HeaderNavItem => headerNav[key];

/** 「主页」下拉面板：主站 / OpList / 防失联&发布页 / 联系 */
export const homeMenuKeys = [
	"home",
	"oplist",
	"notice",
	"contact",
] as const satisfies readonly HeaderNavKey[];

/** 「工具」下拉面板：所有工具 / 车牌号跳转 */
export const toolMenuKeys = [
	"tools",
	"plate",
] as const satisfies readonly HeaderNavKey[];

/** 下拉面板的宽度：按面板里最长的一行描述定，避免逐行省略号 */
export const menuPanels = {
	home: { keys: homeMenuKeys, width: "w-[300px]" },
	tools: { keys: toolMenuKeys, width: "w-[280px]" },
} as const;

export type HeaderMenuId = keyof typeof menuPanels;

/**
 * 桌面端主导航的按钮顺序（数组顺序即渲染顺序）：
 * 主页（下拉）→ 标签 → 会社 → 合集 → 工具（下拉）→ 论坛 → 推广位（广告）。
 */
export type DesktopNavEntry =
	| { kind: "menu"; id: HeaderMenuId; label: string }
	| { kind: "link"; key: HeaderNavKey }
	/** 后台广告位 header_nav 下发的推广入口（复用普通链接的排版，带 sponsored 标记） */
	| { kind: "ad" };

// 显式标注成宽类型（而非 as const）：渲染层需要按 HeaderNavItem 的
// internal / external 分支窄化，条目以后换成外链时不用改渲染代码。
export const desktopNavEntries: readonly DesktopNavEntry[] = [
	{ kind: "menu", id: "home", label: "主页" },
	{ kind: "link", key: "tags" },
	{ kind: "link", key: "producer" },
	{ kind: "link", key: "collections" },
	{ kind: "menu", id: "tools", label: "工具" },
	{ kind: "link", key: "topics" },
	{ kind: "ad" },
];

/**
 * 移动端全屏菜单的按钮顺序：
 * 主站 → OpList → 防失联&发布页 → 标签 → 会社 → 合集 → 论坛 → 联系 → 推广位。
 * 推广位排在「联系」之后：它是外链推广，不夹在站内入口中间打断导航动线。
 * 工具分组的 key 在 toolMenuKeys，单独渲染在分隔线下。
 */
export type MobileNavEntry =
	| { kind: "link"; key: HeaderNavKey }
	/** 后台广告位 header_nav 下发的推广入口 */
	| { kind: "ad" };

export const mobileNavEntries: readonly MobileNavEntry[] = [
	{ kind: "link", key: "home" },
	{ kind: "link", key: "oplist" },
	{ kind: "link", key: "notice" },
	{ kind: "link", key: "tags" },
	{ kind: "link", key: "producer" },
	{ kind: "link", key: "collections" },
	{ kind: "link", key: "topics" },
	{ kind: "link", key: "contact" },
	{ kind: "ad" },
];

/** 移动端主菜单里参与错峰入场延迟的条目数（工具分组接在它后面继续编号）。 */
export const MOBILE_NAV_ENTRY_COUNT = mobileNavEntries.length;
