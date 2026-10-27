import { Button } from "@web/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@web/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@web/components/ui/popover";
import { Separator } from "@web/components/ui/separator";
import { Toggle } from "@web/components/ui/toggle";
import { cn } from "@web/lib/utils";
import {
	CalendarIcon,
	ChevronDownIcon,
	FilterIcon,
	LayersIcon,
	RotateCcwIcon,
	SlidersHorizontalIcon,
	TimerIcon,
	XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { TaskFilterChips } from "./task-filter-chips";
import {
	TASK_RANGE_LABELS,
	TASK_STATUS_FALLBACK_LABELS,
	type TaskChip,
	type TaskFiltersPatch,
	type TaskFiltersView,
	type TaskOption,
	type TaskStatusKey,
} from "./types";

/** 分段控件的状态顺序：先「进行中」，再终态，最后异常态。 */
const STATUS_ORDER: TaskStatusKey[] = [
	"queued",
	"running",
	"completed",
	"failed",
	"dead-letter",
	"interrupted",
];

const RANGE_ORDER: TaskFiltersView["range"][] = ["today", "7d", "30d", "all"];

export type TaskFilterBarProps = {
	filters: TaskFiltersView;
	/** 各状态计数，用于分段控件与队列下拉的徽标 */
	statusCounts?: Record<string, number>;
	queueOptions: TaskOption[];
	typeOptions: TaskOption[];
	isFiltered: boolean;
	/** 当前筛选下的总条数 */
	total: number;
	onPatch: (patch: TaskFiltersPatch) => void;
	/** 清空全部筛选（chips 行与空态复用同一个回调） */
	onClearAll: () => void;
	chips: TaskChip[];
	/** 队列/类型字典是否还在加载：下拉里显示「加载中…」而不是「暂无」 */
	optionsLoading?: boolean;
	/** 右侧视图控件（列显隐 / 行高密度），由页面注入保持本组件无状态 */
	viewControls?: ReactNode;
	/** 高级筛选气泡里的附加内容 */
	advancedExtra?: ReactNode;
	className?: string;
};

/** 筛选按钮的统一外观：未生效时虚线边框，生效后实线 + 淡底，与工具条一致。 */
function filterTriggerClass(active: boolean, extra?: string) {
	return cn(
		"gap-1.5 h-8 rounded-xl font-normal",
		active ? "border-solid bg-accent/60 text-foreground" : "border-dashed",
		extra,
	);
}

function CountBadge({ value }: { value: number }) {
	return (
		<span className="inline-flex justify-center items-center px-1 h-4 min-w-4 text-[10px] font-medium tabular-nums bg-primary text-primary-foreground rounded-full">
			{value}
		</span>
	);
}

function Segment({
	label,
	count,
	active,
	onClick,
}: {
	label: string;
	count?: number;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				"inline-flex shrink-0 gap-1 justify-center items-center px-2 h-6 text-xs font-medium whitespace-nowrap rounded-md border border-transparent transition-colors",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
				active
					? "bg-background text-foreground shadow-sm dark:bg-input/30 dark:border-input"
					: "text-muted-foreground hover:text-foreground",
			)}
		>
			{label}
			{typeof count === "number" && count > 0 && (
				<span className="text-[10px] tabular-nums text-muted-foreground">
					{count}
				</span>
			)}
		</button>
	);
}

/** 状态分段控件：单选语义 = 多选筛选里的「恰好一个」，全部 = 空数组。 */
function StatusSegments({
	filters,
	statusCounts,
	total,
	onPatch,
}: {
	filters: TaskFiltersView;
	statusCounts?: Record<string, number>;
	total: number;
	onPatch: (patch: TaskFiltersPatch) => void;
}) {
	const toggleStatus = (status: TaskStatusKey) => {
		const next = filters.status.includes(status)
			? filters.status.filter((item) => item !== status)
			: [...filters.status, status];
		onPatch({ status: next });
	};

	return (
		<fieldset
			aria-label="按状态筛选"
			className="flex min-w-0 gap-0.5 items-center p-[3px] h-8 max-w-full overflow-x-auto bg-muted rounded-lg"
		>
			<Segment
				label="全部"
				count={total}
				active={filters.status.length === 0}
				onClick={() => onPatch({ status: [] })}
			/>
			{STATUS_ORDER.map((status) => (
				<Segment
					key={status}
					label={TASK_STATUS_FALLBACK_LABELS[status]}
					count={statusCounts?.[status]}
					active={filters.status.includes(status)}
					onClick={() => toggleStatus(status)}
				/>
			))}
		</fieldset>
	);
}

/** 队列多选下拉（带计数徽标）。 */
function QueueMenu({
	filters,
	queueOptions,
	onPatch,
	loading,
}: {
	filters: TaskFiltersView;
	queueOptions: TaskOption[];
	onPatch: (patch: TaskFiltersPatch) => void;
	loading: boolean;
}) {
	const selected = filters.queue;

	const toggleQueue = (value: string, checked: boolean) => {
		onPatch({
			queue: checked
				? [...selected, value]
				: selected.filter((item) => item !== value),
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className={filterTriggerClass(selected.length > 0)}
					/>
				}
			>
				<LayersIcon className="size-3.5 opacity-60" />
				队列
				{selected.length > 0 && <CountBadge value={selected.length} />}
				<ChevronDownIcon className="size-3 opacity-50" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				{/* GroupLabel 只能在 Menu.Group 内使用，否则 Base UI 抛 MenuGroupContext is missing */}
				<DropdownMenuGroup>
					<DropdownMenuLabel>队列</DropdownMenuLabel>
					{loading && queueOptions.length === 0 ? (
						<DropdownMenuItem disabled>队列加载中…</DropdownMenuItem>
					) : queueOptions.length === 0 ? (
						<DropdownMenuItem disabled>暂无队列</DropdownMenuItem>
					) : (
						queueOptions.map((option) => (
							<DropdownMenuCheckboxItem
								key={option.value}
								checked={selected.includes(option.value)}
								onCheckedChange={(checked) =>
									toggleQueue(option.value, checked === true)
								}
							>
								<span className="flex-1 truncate">{option.label}</span>
								{typeof option.count === "number" && (
									<span className="text-xs tabular-nums text-muted-foreground">
										{option.count}
									</span>
								)}
							</DropdownMenuCheckboxItem>
						))
					)}
					{selected.length > 0 && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => onPatch({ queue: [] })}>
								<XIcon className="size-3.5 opacity-60" />
								清除队列筛选
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** 时间范围下拉（单选）。 */
function RangeMenu({
	filters,
	onPatch,
}: {
	filters: TaskFiltersView;
	onPatch: (patch: TaskFiltersPatch) => void;
}) {
	const active = filters.range !== "all";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className={filterTriggerClass(active)}
					/>
				}
			>
				<CalendarIcon className="size-3.5 opacity-60" />
				<span className="text-muted-foreground">时间</span>
				<span className="font-medium">{TASK_RANGE_LABELS[filters.range]}</span>
				<ChevronDownIcon className="size-3 opacity-50" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-40">
				<DropdownMenuGroup>
					<DropdownMenuLabel>时间范围</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={filters.range}
						onValueChange={(value) =>
							onPatch({ range: value as TaskFiltersView["range"] })
						}
					>
						{RANGE_ORDER.map((range) => (
							<DropdownMenuRadioItem key={range} value={range}>
								{TASK_RANGE_LABELS[range]}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** 高级筛选气泡：任务类型多选 + 仅逾期 + 仅可重试，角标显示生效项数。 */
function AdvancedFilterPopover({
	filters,
	typeOptions,
	onPatch,
	advancedExtra,
	loading,
}: {
	filters: TaskFiltersView;
	typeOptions: TaskOption[];
	onPatch: (patch: TaskFiltersPatch) => void;
	advancedExtra?: ReactNode;
	loading: boolean;
}) {
	const advancedCount =
		filters.type.length +
		(filters.overdue ? 1 : 0) +
		(filters.retryable ? 1 : 0);

	const toggleType = (value: string, pressed: boolean) => {
		onPatch({
			type: pressed
				? [...filters.type, value]
				: filters.type.filter((item) => item !== value),
		});
	};

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className={filterTriggerClass(advancedCount > 0)}
					/>
				}
			>
				<SlidersHorizontalIcon className="size-3.5 opacity-60" />
				高级筛选
				{advancedCount > 0 && <CountBadge value={advancedCount} />}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72">
				<PopoverHeader>
					<PopoverTitle className="text-sm">高级筛选</PopoverTitle>
					<PopoverDescription className="text-xs">
						按任务类型与执行状态叠加条件
					</PopoverDescription>
				</PopoverHeader>

				<Separator />

				<div className="flex flex-col gap-1.5">
					<span className="text-xs font-medium text-muted-foreground">
						任务类型
					</span>
					{loading && typeOptions.length === 0 ? (
						<p className="text-xs text-muted-foreground">任务类型加载中…</p>
					) : typeOptions.length === 0 ? (
						<p className="text-xs text-muted-foreground">暂无任务类型字典</p>
					) : (
						<div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-36">
							{typeOptions.map((option) => (
								<Toggle
									key={option.value}
									variant="outline"
									size="sm"
									pressed={filters.type.includes(option.value)}
									onPressedChange={(pressed) =>
										toggleType(option.value, pressed)
									}
									className="text-xs"
								>
									{option.label}
									{typeof option.count === "number" && option.count > 0 && (
										<span className="text-[10px] tabular-nums text-muted-foreground">
											{option.count}
										</span>
									)}
								</Toggle>
							))}
						</div>
					)}
				</div>

				<Separator />

				<div className="flex flex-wrap gap-1.5">
					<Toggle
						variant="outline"
						size="sm"
						pressed={filters.overdue}
						onPressedChange={(pressed) => onPatch({ overdue: pressed })}
						className="text-xs"
					>
						<TimerIcon className="size-3.5" />
						仅逾期
					</Toggle>
					<Toggle
						variant="outline"
						size="sm"
						pressed={filters.retryable}
						onPressedChange={(pressed) => onPatch({ retryable: pressed })}
						className="text-xs"
					>
						<RotateCcwIcon className="size-3.5" />
						仅可重试
					</Toggle>
				</div>

				{advancedExtra && <div className="min-w-0">{advancedExtra}</div>}

				{advancedCount > 0 && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							onPatch({ type: [], overdue: false, retryable: false })
						}
						className="justify-start gap-1 h-8 px-2 font-normal text-muted-foreground"
					>
						<XIcon className="size-3.5" />
						清空高级筛选
					</Button>
				)}
			</PopoverContent>
		</Popover>
	);
}

/**
 * 筛选条：状态分段 / 队列多选 / 时间范围 / 高级筛选 + 生效 chips。
 *
 * 全部交互都走 onPatch 单入口，页面（状态层）负责把 patch 合并进 URL search
 * 并重置页码；本组件不持有任何筛选状态，也不读 URL。
 * chip 的删除按钮由 TaskChip.onRemove 自带，因此这里刻意不提供
 * onRemoveChip 回调，避免出现两套「谁删 chip」的约定。
 */
export function TaskFilterBar({
	filters,
	statusCounts,
	queueOptions,
	typeOptions,
	isFiltered,
	total,
	onPatch,
	onClearAll,
	chips,
	optionsLoading = false,
	viewControls,
	advancedExtra,
	className,
}: TaskFilterBarProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-2 p-3 border-b border-border/60",
				className,
			)}
		>
			<div className="flex flex-wrap gap-2 items-center min-w-0">
				<StatusSegments
					filters={filters}
					statusCounts={statusCounts}
					total={total}
					onPatch={onPatch}
				/>
				<QueueMenu
					filters={filters}
					queueOptions={queueOptions}
					onPatch={onPatch}
					loading={optionsLoading}
				/>
				<RangeMenu filters={filters} onPatch={onPatch} />
				<AdvancedFilterPopover
					filters={filters}
					typeOptions={typeOptions}
					onPatch={onPatch}
					advancedExtra={advancedExtra}
					loading={optionsLoading}
				/>

				<div className="flex flex-wrap gap-1.5 items-center ml-auto">
					<span className="hidden gap-1 items-center text-xs text-muted-foreground md:inline-flex">
						<FilterIcon className="size-3" />共{" "}
						<span className="font-medium tabular-nums text-foreground">
							{total.toLocaleString()}
						</span>{" "}
						条
						{isFiltered && (
							<span className="text-muted-foreground/70">· 已筛选</span>
						)}
					</span>
					{viewControls}
				</div>
			</div>

			<TaskFilterChips chips={chips} onClearAll={onClearAll} />
		</div>
	);
}
