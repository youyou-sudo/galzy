import type { LucideIcon } from "lucide-react";
import {
	DatabaseIcon,
	FileTextIcon,
	HeartHandshakeIcon,
	LayoutDashboardIcon,
	ListTodoIcon,
	MessageSquareTextIcon,
	PackageIcon,
	SearchIcon,
	UsersIcon,
} from "lucide-react";

export type AdminNavItem = {
	to: string;
	label: string;
	description: string;
	icon: LucideIcon;
	/** 精确匹配（仪表盘这类前缀会被所有子路由命中的页面） */
	exact?: boolean;
	/** 命令面板（⌘K）的额外检索词：拼音 / 英文 / 同义词 */
	keywords?: string[];
	/** 侧栏徽标：显示「运行中任务数」等动态计数 */
	badge?: "tasks-running";
};

export type AdminNavSection = {
	section: string;
	items: AdminNavItem[];
};

/**
 * 后台导航单一配置源。
 *
 * 侧栏、顶栏面包屑、命令面板、仪表盘快捷入口全部由这里派生 ——
 * 新增一个后台页面只需在数组里加一项。
 */
export const adminNav: AdminNavSection[] = [
	{
		section: "概览",
		items: [
			{
				to: "/admin",
				label: "仪表盘",
				description: "站点总览与管理入口",
				icon: LayoutDashboardIcon,
				exact: true,
				keywords: ["dashboard", "home", "overview", "yibiaopan"],
			},
		],
	},
	{
		section: "内容管理",
		items: [
			{
				to: "/admin/comments",
				label: "评论管理",
				description: "删除、编辑、隐藏与置顶",
				icon: MessageSquareTextIcon,
				keywords: ["comments", "回复", "pinglun"],
			},
			{
				to: "/admin/articles",
				label: "文章管理",
				description: "审核、编辑、隐藏与删除",
				icon: FileTextIcon,
				keywords: ["articles", "攻略", "wenzhang"],
			},
			{
				to: "/admin/topics",
				label: "话题管理",
				description: "审核、隐藏与删除",
				icon: MessageSquareTextIcon,
				keywords: ["topics", "论坛", "huati"],
			},
			{
				to: "/admin/collections",
				label: "合集管理",
				description: "手动选品与会社绑定",
				icon: PackageIcon,
				keywords: ["collections", "专题", "heji"],
			},
			{
				to: "/admin/friend-links",
				label: "友情链接",
				description: "添加、删除与拖动排序",
				icon: HeartHandshakeIcon,
				keywords: ["friend-links", "友链", "youqinglianjie"],
			},
		],
	},
	{
		section: "系统",
		items: [
			{
				to: "/admin/users",
				label: "用户管理",
				description: "账号、角色、封禁与权限",
				icon: UsersIcon,
				keywords: ["users", "账号", "yonghu", "封禁"],
			},
			{
				to: "/admin/meilisearch",
				label: "Meilisearch",
				description: "索引、搜索属性与 Embedders",
				icon: SearchIcon,
				keywords: ["meili", "search", "索引", "sousuo"],
			},
			{
				to: "/admin/vndb-sync",
				label: "VNDB 数据同步",
				description: "全量/增量同步与监控",
				icon: DatabaseIcon,
				keywords: ["vndb", "sync", "同步", "tongbu"],
			},
			{
				to: "/admin/tasks",
				label: "任务队列",
				description: "后台任务状态、进度与日志",
				icon: ListTodoIcon,
				keywords: ["tasks", "queue", "队列", "renwu"],
				badge: "tasks-running",
			},
		],
	},
];

export const adminNavItems: AdminNavItem[] = adminNav.flatMap(
	(section) => section.items,
);

/** 根据路径反查所属分组（面包屑用）。 */
export function findNavItem(pathname: string): {
	section: string;
	item: AdminNavItem;
} | null {
	for (const section of adminNav) {
		for (const item of section.items) {
			const matched = item.exact
				? pathname === item.to
				: pathname === item.to || pathname.startsWith(`${item.to}/`);
			if (matched) return { section: section.section, item };
		}
	}
	return null;
}

/** 侧栏当前项判定，供 AdminShell 复用。 */
export function isNavItemActive(item: AdminNavItem, pathname: string): boolean {
	return item.exact
		? pathname === item.to
		: pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/** 仪表盘用的快捷入口（排除当前页）。 */
export const adminQuickLinks = adminNavItems.filter(
	(item) => item.to !== "/admin",
);
