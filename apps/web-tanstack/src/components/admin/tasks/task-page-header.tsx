import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { SearchField } from "@web/components/shared/search-field";
import { Button } from "@web/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@web/components/ui/dropdown-menu";
import { Spinner } from "@web/components/ui/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import { cn } from "@web/lib/utils";
import {
	ActivityIcon,
	ArrowRightIcon,
	ChevronDownIcon,
	ListTodoIcon,
	PauseIcon,
	PlayIcon,
	RefreshCwIcon,
} from "lucide-react";
import { Fragment, useState } from "react";
import type { TaskEnqueueGroup } from "./types";

/** 自动刷新间隔（毫秒），0 = 暂停轮询。 */
const REFRESH_OPTIONS = [
	{ value: 2000, label: "实时 2 秒" },
	{ value: 5000, label: "5 秒" },
	{ value: 15000, label: "15 秒" },
	{ value: 0, label: "暂停刷新" },
] as const;

const DEFAULT_REFRESH = REFRESH_OPTIONS[1];

/**
 * 队列键：BFF 的 /tasks/meta 用 `key`，而本目录 types.ts 的 TaskEnqueueGroup
 * 用 `queue`。两处都读，避免展示层被上游字段命名绑死（缺字段时退化为空串，
 * 由调用方保证 enqueue 回调可用）。
 */
function queueKeyOf(group: { queue?: string; key?: string }): string {
	return group.queue ?? group.key ?? "";
}

export type TaskPageHeaderProps = {
	/** 服务端搜索词（受控） */
	query: string;
	onQueryChange: (query: string) => void;
	/** 可手动触发的任务预设，按队列分组（来自 /tasks/meta） */
	enqueueGroups: TaskEnqueueGroup[];
	onEnqueue: (preset: { queue: string; type: string; label: string }) => void;
	enqueuePending: boolean;
	/** 任务字典（/tasks/meta）是否还在加载：菜单里显示「加载中…」而不是「尚未加载」 */
	metaLoading?: boolean;
	/** 队列（Redis/BullMQ）是否启用；关闭时「手动触发」禁用并解释原因 */
	queueEnabled: boolean;
	isFetching: boolean;
	onRefresh: () => void;
	/** 轮询间隔，0 = 暂停 */
	refreshMs: number;
	onRefreshChange: (ms: number) => void;
};

/**
 * 刷新间隔下拉。
 *
 * 项目里筛选/密度这类「一小组枚举」统一用 DropdownMenu + RadioItem
 * （见 data-table/toolbar.tsx 的 DensityMenu），比 Select 少一层 label 映射。
 */
function RefreshIntervalMenu({
	value,
	onChange,
}: {
	value: number;
	onChange: (ms: number) => void;
}) {
	const current =
		REFRESH_OPTIONS.find((option) => option.value === value) ?? DEFAULT_REFRESH;
	const paused = value === 0;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5 font-normal"
						aria-label={`刷新间隔：${current.label}`}
					/>
				}
			>
				{paused ? (
					<PauseIcon className="size-3.5 text-muted-foreground" />
				) : (
					<ActivityIcon className="size-3.5 text-success" />
				)}
				<span className="hidden tabular-nums sm:inline">{current.label}</span>
				<ChevronDownIcon className="size-3 opacity-50" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-38">
				{/* GroupLabel 必须包在 Menu.Group 里，否则 Base UI 会抛
				    "MenuGroupContext is missing" */}
				<DropdownMenuGroup>
					<DropdownMenuLabel>自动刷新</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={String(value)}
						onValueChange={(next) => onChange(Number(next))}
					>
						{REFRESH_OPTIONS.map((option) => (
							<DropdownMenuRadioItem
								key={option.value}
								value={String(option.value)}
							>
								{option.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * 「手动触发」分组菜单：队列作分组标题，任务作条目。
 *
 * 队列未启用（Redis 未连接）时不给一个点了没反应的按钮，而是禁用 + Tooltip
 * 说明原因；禁用按钮自己吞掉指针事件，所以外面套一层 span 承载 Tooltip。
 */
function EnqueueMenu({
	groups,
	pending,
	queueEnabled,
	metaLoading,
	onEnqueue,
}: {
	groups: TaskEnqueueGroup[];
	pending: boolean;
	queueEnabled: boolean;
	metaLoading: boolean;
	onEnqueue: (preset: { queue: string; type: string; label: string }) => void;
}) {
	const [open, setOpen] = useState(false);

	if (!queueEnabled) {
		return (
			<Tooltip>
				<TooltipTrigger render={<span className="inline-flex" />}>
					<Button size="sm" className="gap-1.5" disabled>
						<PlayIcon className="size-3.5" />
						手动触发
					</Button>
				</TooltipTrigger>
				<TooltipContent>队列未启用（Redis）</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger
				render={<Button size="sm" className="gap-1.5" disabled={pending} />}
			>
				{pending ? (
					<Spinner className="size-3.5" />
				) : (
					<PlayIcon className="size-3.5" />
				)}
				手动触发
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				{groups.length === 0 ? (
					<DropdownMenuItem disabled>
						{metaLoading ? "任务字典加载中…" : "任务字典尚未加载"}
					</DropdownMenuItem>
				) : (
					groups.map((group, index) => (
						<Fragment key={queueKeyOf(group) || group.label}>
							{index > 0 && <DropdownMenuSeparator />}
							<DropdownMenuGroup>
								<DropdownMenuLabel>
									{group.label || queueKeyOf(group)}
								</DropdownMenuLabel>
								{group.tasks.map((task) => (
									<DropdownMenuItem
										key={task.type}
										disabled={pending}
										onClick={() => {
											setOpen(false);
											onEnqueue({
												queue: queueKeyOf(group),
												type: task.type,
												label: task.label,
											});
										}}
									>
										<ArrowRightIcon className="size-3.5 opacity-60" />
										<span className="flex-1 truncate">{task.label}</span>
										{task.priority && (
											<span className="text-[10px] tabular-nums text-muted-foreground">
												{task.priority}
											</span>
										)}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						</Fragment>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * 任务页头：标题、说明、搜索与三个操作（刷新间隔 / 刷新 / 手动触发）。
 *
 * 纯展示组件：不发请求、不读 URL，所有状态都由页面（list-page + 路由 search）
 * 通过 props 注入，保证可以被单测直接渲染。
 */
export function TaskPageHeader({
	query,
	onQueryChange,
	enqueueGroups,
	onEnqueue,
	enqueuePending,
	metaLoading = false,
	queueEnabled,
	isFetching,
	onRefresh,
	refreshMs,
	onRefreshChange,
}: TaskPageHeaderProps) {
	return (
		<AdminPageHeader
			icon={ListTodoIcon}
			eyebrow="系统"
			title="任务队列"
			description="监控后台同步任务（VNDB / Kungal / Meilisearch / Cloudreve）的执行状态、进度与日志"
			actions={
				<>
					<SearchField
						value={query}
						onChange={onQueryChange}
						placeholder="搜索任务 ID / 类型 / 错误…"
						ariaLabel="搜索任务"
						className="w-full sm:w-56"
						inputClassName="h-8"
					/>
					<RefreshIntervalMenu value={refreshMs} onChange={onRefreshChange} />
					<Button
						variant="outline"
						size="sm"
						onClick={onRefresh}
						className="gap-1.5"
						aria-label="刷新任务列表"
					>
						<RefreshCwIcon
							className={cn(
								"size-3.5 text-muted-foreground",
								isFetching && "animate-spin",
							)}
						/>
						刷新
					</Button>
					<EnqueueMenu
						groups={enqueueGroups}
						pending={enqueuePending}
						queueEnabled={queueEnabled}
						metaLoading={metaLoading}
						onEnqueue={onEnqueue}
					/>
				</>
			}
		/>
	);
}
