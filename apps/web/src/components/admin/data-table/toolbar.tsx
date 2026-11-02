import { SearchField } from "@web/components/shared/search-field";
import { Button } from "@web/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@web/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@web/components/ui/popover";
import { cn } from "@web/lib/utils";
import {
	ChevronDownIcon,
	Columns3Icon,
	FilterIcon,
	Rows3Icon,
	SlidersHorizontalIcon,
	XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AdminTableDensity } from "./data-table";

/* ── 筛选器 ─────────────────────────────────────────────────── */

export type AdminFilterOption = {
	value: string;
	label: string;
	/** 可选：数量徽标（如「运行中 3」） */
	count?: number;
	icon?: ReactNode;
};

type FilterBase = {
	/** 用于 key 与 chip 的可读名称 */
	id: string;
	label: string;
	options: AdminFilterOption[];
	/** 「全部」选项的展示文案，默认「全部{label}」 */
	allLabel?: string;
	/**
	 * 清空这一个维度的筛选。传入后 chip 右侧出现独立的「×」按钮，
	 * 用户不必为去掉一个条件再点开下拉去找「全部」。
	 */
	onClear?: () => void;
	/**
	 * primary（默认）= 常用筛选，常驻工具条；
	 * advanced = 高级筛选，收进「高级筛选」气泡，仅在生效时浮成 chip。
	 */
	group?: "primary" | "advanced";
	/** 是否渲染 chip 上的「×」，默认跟随 onClear（传 false 可强制不显示） */
	removable?: boolean;
};

export type AdminFilter =
	| (FilterBase & {
			multi?: false;
			value: string;
			onChange: (value: string) => void;
	  })
	| (FilterBase & {
			multi: true;
			value: string[];
			onChange: (value: string[]) => void;
	  });

function activeLabelOf(filter: AdminFilter): string | null {
	const selected = filter.multi
		? filter.value.length === 1
			? filter.value[0]
			: filter.value.length > 1
				? "__multi__"
				: ""
		: filter.value;
	if (!selected) return null;
	if (selected === "__multi__" && filter.multi) {
		return `${filter.value.length} 项`;
	}
	return (
		filter.options.find((option) => option.value === selected)?.label ??
		selected
	);
}

function FilterChip({ filter }: { filter: AdminFilter }) {
	const current = activeLabelOf(filter);
	const active = current != null;
	const showClear = !!filter.onClear && filter.removable !== false;

	const toggleOption = (value: string, isSelected: boolean) => {
		if (filter.multi) {
			const next = isSelected
				? filter.value.filter((item) => item !== value)
				: [...filter.value, value];
			filter.onChange(next);
			return;
		}
		filter.onChange(isSelected ? value : "");
	};

	const isSelected = (value: string) =>
		filter.multi ? filter.value.includes(value) : filter.value === value;

	const menu = (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className={cn(
							"gap-1.5 h-8 rounded-xl border-dashed font-normal",
							active && "border-solid bg-accent/60 text-foreground",
						)}
					/>
				}
			>
				<FilterIcon className="size-3.5 opacity-60" />
				{filter.label}
				{active && (
					<>
						<span className="w-px h-3.5 bg-border" />
						<span className="font-medium text-foreground">{current}</span>
					</>
				)}
				<ChevronDownIcon className="size-3 opacity-50" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-52">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{filter.label}</DropdownMenuLabel>
					{filter.multi ? (
						<>
							{filter.options.map((option) => (
								<DropdownMenuCheckboxItem
									key={option.value}
									checked={isSelected(option.value)}
									onCheckedChange={(checked) =>
										toggleOption(option.value, checked === true)
									}
								>
									{option.icon}
									<span className="flex-1 truncate">{option.label}</span>
									{typeof option.count === "number" && (
										<span className="text-xs tabular-nums text-muted-foreground">
											{option.count}
										</span>
									)}
								</DropdownMenuCheckboxItem>
							))}
						</>
					) : (
						<DropdownMenuRadioGroup
							value={filter.value}
							onValueChange={(value) =>
								filter.onChange(value === "__all__" ? "" : value)
							}
						>
							<DropdownMenuRadioItem value="__all__">
								{filter.allLabel ?? `全部${filter.label}`}
							</DropdownMenuRadioItem>
							{filter.options.map((option) => (
								<DropdownMenuRadioItem key={option.value} value={option.value}>
									{option.icon}
									<span className="flex-1 truncate">{option.label}</span>
									{typeof option.count === "number" && (
										<span className="text-xs tabular-nums text-muted-foreground">
											{option.count}
										</span>
									)}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					)}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	if (!showClear) return menu;

	// 「×」与下拉按钮是兄弟节点：button 内再套 button 是无效 HTML，
	// 且读屏会把「清空」念成筛选开关的一部分。
	return (
		<div className="inline-flex items-center">
			{menu}
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				aria-label={`移除筛选：${filter.label}`}
				title={`移除筛选：${filter.label}`}
				onClick={(event) => {
					event.stopPropagation();
					filter.onClear?.();
				}}
				className="-ml-1 size-7 shrink-0 text-muted-foreground hover:text-foreground"
			>
				<XIcon className="size-3.5" />
			</Button>
		</div>
	);
}

/* ── 列显隐 ─────────────────────────────────────────────────── */

export type ColumnVisibilityControls = {
	columns: { id: string; label: string; hidden: boolean }[];
	onToggle: (id: string, visible: boolean) => void;
};

export function ColumnVisibilityMenu({
	columns,
	onToggle,
}: ColumnVisibilityControls) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5 h-8 rounded-xl font-normal"
					/>
				}
			>
				<Columns3Icon className="size-3.5 opacity-70" />列
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuLabel>显示列</DropdownMenuLabel>
				{columns.map((column) => (
					<DropdownMenuCheckboxItem
						key={column.id}
						checked={!column.hidden}
						onCheckedChange={(checked) => onToggle(column.id, checked === true)}
					>
						{column.label}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function DensityMenu({
	density,
	onDensityChange,
}: {
	density: AdminTableDensity;
	onDensityChange: (density: AdminTableDensity) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="outline" size="icon-sm" aria-label="行高密度" />
				}
			>
				<Rows3Icon className="size-3.5 opacity-70" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-36">
				<DropdownMenuLabel>行高</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={density}
					onValueChange={(value) => onDensityChange(value as AdminTableDensity)}
				>
					<DropdownMenuRadioItem value="comfortable">
						标准
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="compact">紧凑</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/* ── 工具条 ─────────────────────────────────────────────────── */

export type DataTableToolbarProps = {
	/** 搜索框（受控）；不传则不渲染 */
	search?: {
		value: string;
		onChange: (value: string) => void;
		onSubmit?: (value: string) => void;
		placeholder?: string;
		ariaLabel?: string;
	};
	filters?: AdminFilter[];
	/**
	 * 搜索框是否处于生效状态。不传时按 search.value 是否非空推导；
	 * 页面自己做防抖/提交式搜索时用它可以避免「输入了但没生效」也点亮重置。
	 */
	searchActive?: boolean;
	/** 是否有任何生效中的筛选（决定重置按钮是否可点） */
	isFiltered?: boolean;
	onReset?: () => void;
	/**
	 * 高级筛选内容。工具条自己渲染「高级筛选」气泡的触发器，
	 * 传进来的节点作为气泡内容；不传则不出现该入口。
	 */
	advanced?: ReactNode;
	/** 高级筛选按钮上的计数徽标；不传时按 group="advanced" 的生效项数推导 */
	advancedCount?: number;
	/** 筛选行下方的附加行（如生效条件 chips），独占整行宽度 */
	chips?: ReactNode;
	visibility?: ColumnVisibilityControls;
	density?: AdminTableDensity;
	onDensityChange?: (density: AdminTableDensity) => void;
	/** 右侧业务操作（新建 / 手动触发 / 刷新） */
	actions?: ReactNode;
	/** 左侧额外内容 */
	leading?: ReactNode;
	className?: string;
};

/**
 * 后台列表工具条。
 *
 * 结构：搜索 → 筛选 chips →（弹性空隙）→ 重置 / 列 / 密度 / 业务操作。
 * 窄屏自动换行成两段：第一段搜索+筛选，第二段操作，避免按钮被压成图标。
 */
export function DataTableToolbar({
	search,
	filters = [],
	searchActive,
	isFiltered,
	onReset,
	advanced,
	advancedCount,
	chips,
	visibility,
	density,
	onDensityChange,
	actions,
	leading,
	className,
}: DataTableToolbarProps) {
	// 常用筛选常驻工具条；高级筛选收进气泡，只在生效时以可删除的 chip 浮上来。
	const primaryFilters = filters.filter(
		(filter) => filter.group !== "advanced",
	);
	const activeAdvancedFilters = filters.filter(
		(filter) => filter.group === "advanced" && activeLabelOf(filter) != null,
	);
	const visibleFilters = [...primaryFilters, ...activeAdvancedFilters];
	const advancedBadge = advancedCount ?? activeAdvancedFilters.length;
	const hasActiveFilter = filters.some(
		(filter) => activeLabelOf(filter) != null,
	);
	const searchIsActive =
		searchActive ?? (search ? search.value.trim().length > 0 : false);
	const filtered = isFiltered ?? (hasActiveFilter || searchIsActive);

	return (
		<div
			className={cn(
				"flex flex-col gap-2 p-3 border-b border-border/60 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:p-4",
				className,
			)}
		>
			{leading}
			{search && (
				<SearchField
					value={search.value}
					onChange={search.onChange}
					onSubmit={search.onSubmit}
					placeholder={search.placeholder}
					ariaLabel={search.ariaLabel}
					className="w-full sm:max-w-64"
					// 工具条里其它控件都是 h-8，搜索框跟随，避免基线错位
					inputClassName="h-8"
				/>
			)}
			{(visibleFilters.length > 0 || advanced) && (
				<div className="flex flex-wrap gap-1.5 items-center">
					{visibleFilters.map((filter) => (
						<FilterChip key={filter.id} filter={filter} />
					))}
					{advanced && (
						<Popover>
							<PopoverTrigger
								render={
									<Button
										variant="outline"
										size="sm"
										className={cn(
											"gap-1.5 h-8 rounded-xl border-dashed font-normal",
											advancedBadge > 0 &&
												"border-solid bg-accent/60 text-foreground",
										)}
									/>
								}
							>
								<SlidersHorizontalIcon className="size-3.5 opacity-60" />
								高级筛选
								{advancedBadge > 0 && (
									<span className="inline-flex justify-center items-center px-1 h-4 min-w-4 rounded-full text-[10px] font-medium tabular-nums bg-primary text-primary-foreground">
										{advancedBadge}
									</span>
								)}
							</PopoverTrigger>
							<PopoverContent align="start" className="w-72">
								{advanced}
							</PopoverContent>
						</Popover>
					)}
				</div>
			)}

			<div className="flex flex-wrap gap-1.5 items-center sm:ml-auto">
				{filtered && onReset && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onReset}
						className="gap-1 h-8 px-2 font-normal text-muted-foreground"
					>
						<XIcon className="size-3.5" />
						重置
					</Button>
				)}
				{visibility && (
					<ColumnVisibilityMenu
						columns={visibility.columns}
						onToggle={visibility.onToggle}
					/>
				)}
				{density && onDensityChange && (
					<DensityMenu density={density} onDensityChange={onDensityChange} />
				)}
				{actions}
			</div>

			{chips && (
				<div className="w-full min-w-0 sm:shrink-0 sm:basis-full">{chips}</div>
			)}
		</div>
	);
}
