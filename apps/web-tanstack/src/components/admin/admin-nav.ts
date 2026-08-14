import {
	DatabaseIcon,
	FileTextIcon,
	LayoutDashboardIcon,
	ListTodoIcon,
	MessageSquareTextIcon,
	PackageIcon,
	SearchIcon,
	UsersIcon,
} from "lucide-react";
import type { ComponentType } from "react";

export type AdminNavItem = {
	to: string;
	label: string;
	description: string;
	icon: ComponentType<{ className?: string }>;
	exact?: boolean;
};

export type AdminNavSection = {
	section: string;
	items: AdminNavItem[];
};

// 后台导航单一配置源：侧栏（AdminShell）、仪表盘快捷入口与系统状态均由此派生
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
			},
			{
				to: "/admin/articles",
				label: "文章管理",
				description: "审核、编辑、隐藏与删除",
				icon: FileTextIcon,
			},
			{
				to: "/admin/topics",
				label: "话题管理",
				description: "审核、隐藏与删除",
				icon: MessageSquareTextIcon,
			},
			{
				to: "/admin/collections",
				label: "合集管理",
				description: "手动选品与会社绑定",
				icon: PackageIcon,
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
			},
			{
				to: "/admin/meilisearch",
				label: "Meilisearch",
				description: "索引、搜索属性与 Embedders",
				icon: SearchIcon,
			},
			{
				to: "/admin/vndb-sync",
				label: "VNDB 数据同步",
				description: "全量/增量同步与监控",
				icon: DatabaseIcon,
			},
			{
				to: "/admin/tasks",
				label: "任务队列",
				description: "后台任务状态、进度与日志",
				icon: ListTodoIcon,
			},
		],
	},
];

export const adminNavItems: AdminNavItem[] = adminNav.flatMap(
	(section) => section.items,
);
