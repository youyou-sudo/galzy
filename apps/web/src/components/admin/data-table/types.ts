import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** 排序状态：null = 不排序（服务端默认序）。 */
export type AdminSort = { id: string; desc: boolean } | null;

/**
 * 列定义。
 *
 * 一个列只声明「表头 + 单元格渲染 + 表头对齐」，排版/间距/状态行高由
 * <AdminDataTable> 统一提供，页面不再出现 ul>li 式的手写 th/td className。
 */
export type AdminColumn<T> = {
	/** 稳定 id：列显隐持久化、排序标识都用它 */
	id: string;
	header: ReactNode;
	/**
	 * 列显隐菜单的展示名。页面向 useAdminTableState 派生 ColumnMeta 时用它，
	 * 缺省由页面自行回退到 header / id。
	 */
	label?: string;
	/** 单元格渲染；返回 ReactNode。窄屏走 mobile 卡片时可省略 */
	cell: (row: T) => ReactNode;
	align?: "left" | "right" | "center";
	/** 表头是否可排序（需要配合 sort / onSortChange） */
	sortable?: boolean;
	/** 列宽 / 隐藏断点等附加类名，仅作用于 td */
	className?: string;
	headerClassName?: string;
	/** 低于该断点隐藏本列（桌面表格仍保留移动卡片） */
	hideBelow?: "sm" | "md" | "lg" | "xl";
	/** 默认是否可见（列显隐菜单的初值） */
	defaultHidden?: boolean;
	/** 在移动卡片中的角色：title=主标题行，meta=副信息行，hidden=不展示 */
	mobile?: "title" | "meta" | "body" | "hidden";
	/** 移动卡片刻意换用别的渲染（如时间显示为相对时间） */
	mobileCell?: (row: T) => ReactNode;
};

/** 空态配置。 */
export type AdminTableEmpty = {
	icon?: LucideIcon;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
};

/** 行操作下拉菜单的一个条目。 */
export type AdminRowAction = {
	label: string;
	icon?: LucideIcon;
	onSelect: () => void;
	variant?: "default" | "destructive";
	disabled?: boolean;
	/**
	 * 不可用原因（如「终态任务不可重试」）。有值时该项 disabled，
	 * 并通过 title / Tooltip 把原因解释给用户，而不是给一个点了没反应的按钮。
	 */
	disabledReason?: string;
	/** 该项是否在进行中（渲染 spinner 并禁用） */
	pending?: boolean;
	/** 是否用分隔线把该项与上一项隔开 */
	separator?: boolean;
	hidden?: boolean;
};
