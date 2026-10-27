import { EmptyState } from "@web/components/shared/empty-state";
import { Pagination } from "@web/components/shared/pagination";
import { Skeleton } from "@web/components/ui/skeleton";
import { cn } from "@web/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * 后台表格「原子层」：状态徽标、卡片外壳、表头/行/单元格等最小组件。
 *
 * 列表页请优先使用 `@web/components/admin/data-table` 的 <AdminDataTable>
 * （列定义驱动、内置选择/骨架/空态/移动端卡片）。这里保留给：
 * - StatusPill：全站唯一的状态徽标（语义色 + 图标 + 可选 spin）；
 * - TableCard：需要一块独立圆角卡片但内容不是表格时使用（如死信列表）。
 *
 * 视觉契约：rounded-2xl + ring-1 ring-border/60（不用 border）、
 * 表头用 --table-header 底色、行 hover 用 muted/40、状态只用语义令牌。
 */

/** 列表容器：圆角 + 发丝描边，移动端不溢出页面（横滚交给 TableScroll）。 */
export function TableCard({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex overflow-hidden flex-col bg-card rounded-2xl ring-1 ring-border/60",
				className,
			)}
		>
			{children}
		</div>
	);
}

/** 工具条：搜索 / 筛选 / 操作，移动端纵向堆叠，sm 起同一行。 */
export function TableToolbar({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-2 p-4 border-b border-border/60 sm:flex-row sm:flex-wrap sm:items-center",
				className,
			)}
		>
			{children}
		</div>
	);
}

/** 表格横向滚动外壳：375px 下表格横滚，容器宽度不撑破页面。 */
export function TableScroll({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("overflow-x-auto w-full", className)}>{children}</div>
	);
}

/** 表格本体：最小宽度随列数变化，保证窄屏可横滚而不是挤成一列。 */
export function Table({
	children,
	className,
	minWidth = "min-w-[640px]",
}: {
	children: ReactNode;
	className?: string;
	minWidth?: string;
}) {
	return (
		<table
			className={cn("w-full text-sm border-collapse", minWidth, className)}
		>
			{children}
		</table>
	);
}

export function THead({ children }: { children: ReactNode }) {
	return <thead className="bg-[color:var(--table-header)]">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
	return <tbody>{children}</tbody>;
}

/** 表头单元格。 */
export function Th({
	children,
	align = "left",
	className,
}: {
	children?: ReactNode;
	align?: "left" | "right" | "center";
	className?: string;
}) {
	return (
		<th
			scope="col"
			className={cn(
				"px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap",
				align === "right" && "text-right",
				align === "center" && "text-center",
				align === "left" && "text-left",
				className,
			)}
		>
			{children}
		</th>
	);
}

/** 表格行。 */
export function Tr({
	children,
	className,
	muted = false,
}: {
	children: ReactNode;
	className?: string;
	muted?: boolean;
}) {
	return (
		<tr
			className={cn(
				"border-b border-border/60 transition-colors duration-200 last:border-0 hover:bg-muted/40",
				muted && "bg-muted/20",
				className,
			)}
		>
			{children}
		</tr>
	);
}

/** 表格单元格。 */
export function Td({
	children,
	align = "left",
	className,
}: {
	children?: ReactNode;
	align?: "left" | "right" | "center";
	className?: string;
}) {
	return (
		<td
			className={cn(
				"px-4 py-3 align-middle",
				align === "right" && "text-right",
				align === "center" && "text-center",
				className,
			)}
		>
			{children}
		</td>
	);
}

/** 空态行：统一用 shared EmptyState，禁止再手写居中图标。 */
export function TableEmpty({
	colSpan,
	icon,
	title,
	description,
	action,
}: {
	colSpan: number;
	icon?: LucideIcon;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<tr>
			<td colSpan={colSpan} className="p-0">
				<EmptyState
					icon={icon}
					title={title}
					description={description}
					action={action}
					size="sm"
				/>
			</td>
		</tr>
	);
}

/** 加载态骨架行：替代整块 spinner，保持表格结构稳定。 */
export function TableSkeleton({
	columns = 4,
	rows = 6,
}: {
	columns?: number;
	rows?: number;
}) {
	return (
		<tbody aria-busy="true">
			{Array.from({ length: rows }).map((_, rowIndex) => (
				<tr
					// biome-ignore lint/suspicious/noArrayIndexKey: 骨架行无稳定 id
					key={rowIndex}
					className="border-b border-border/60 last:border-0"
				>
					{Array.from({ length: columns }).map((__, cellIndex) => (
						<td
							// biome-ignore lint/suspicious/noArrayIndexKey: 骨架列无稳定 id
							key={cellIndex}
							className="px-4 py-3"
						>
							<Skeleton
								className={cn("h-4", cellIndex === 0 ? "w-32" : "w-20")}
							/>
						</td>
					))}
				</tr>
			))}
		</tbody>
	);
}

/** 分页脚：统一 shared Pagination（回调式），页数不足时自动不渲染。 */
export function TablePagination({
	page,
	totalPages,
	totalItems,
	onPageChange,
}: {
	page: number;
	totalPages: number;
	totalItems: number;
	onPageChange: (page: number) => void;
}) {
	if (totalPages <= 1) return null;
	return (
		<div className="px-4 py-3 border-t border-border/60">
			<Pagination
				page={page}
				totalPages={totalPages}
				totalItems={totalItems}
				onPageChange={onPageChange}
				className="pt-0"
			/>
		</div>
	);
}

/**
 * 状态徽标：只有语义色调，不接受原始调色板。
 * 图标保留（运行中可转），文字 + 淡色底成对使用。
 */
const statusTones = {
	primary: "bg-primary/10 text-primary",
	success: "bg-success/10 text-success",
	warning: "bg-warning/10 text-warning",
	info: "bg-info/10 text-info",
	destructive: "bg-destructive/10 text-destructive",
	neutral: "bg-muted text-muted-foreground",
} as const;

export type StatusTone = keyof typeof statusTones;

export function StatusPill({
	tone = "neutral",
	icon: Icon,
	spin = false,
	children,
	className,
}: {
	tone?: StatusTone;
	icon?: LucideIcon;
	spin?: boolean;
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex gap-1 items-center px-2 h-5 text-xs font-medium whitespace-nowrap rounded-full",
				statusTones[tone],
				className,
			)}
		>
			{Icon && (
				<Icon className={cn("shrink-0 size-3", spin && "animate-spin")} />
			)}
			{children}
		</span>
	);
}
