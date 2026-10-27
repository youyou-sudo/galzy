/**
 * 任务列表页的组件契约类型。
 *
 * 这里刻意只做「结构类型」而不 import lib/admin/tasks/*，让展示组件与状态层解耦：
 * - 展示组件（filter-bar / chips / bulk-bar / detail）只认这些 props，能被单测与 Story 复用；
 * - 状态层（lib/admin/tasks/*）负责 URL 序列化与 API 参数，类型与这里结构兼容。
 */

export type TaskStatusKey =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "dead-letter"
	| "interrupted";

/** 列表行（GET /tasks items 的结构子集，服务端另有 applied 等元数据）。 */
export type TaskRow = {
	id: string;
	queue: string;
	type: string;
	status: TaskStatusKey;
	progress: number;
	error: string | null;
	startedAt: string | null;
	finishedAt: string | null;
	createdAt: string;
};

/** 筛选视图（与 URL search 一一对应，展示组件只读）。 */
export type TaskFiltersView = {
	status: TaskStatusKey[];
	queue: string[];
	type: string[];
	q: string;
	range: "today" | "7d" | "30d" | "all";
	overdue: boolean;
	retryable: boolean;
	sortBy: "createdAt" | "startedAt" | "finishedAt" | "status" | "type";
	order: "asc" | "desc";
	page: number;
	pageSize: string;
};

/** 筛选补丁：改任意键都走它（调用方负责 page 重置与选择清空）。 */
export type TaskFiltersPatch = Partial<TaskFiltersView>;

/** 下拉筛选的一个选项。 */
export type TaskOption = {
	value: string;
	label: string;
	/** 可选计数徽标 */
	count?: number;
};

/** 可删除的已选条件。 */
export type TaskChip = {
	key: string;
	label: string;
	onRemove: () => void;
};

/** 手动触发的任务预设（来自 /tasks/meta，不在前端硬编码）。 */
export type TaskEnqueueGroup = {
	queue: string;
	label: string;
	tasks: Array<{ type: string; label: string; priority?: string | number }>;
};

/** 任务字典（/tasks/meta 的展示子集）。 */
export type TaskMetaView = {
	queues: TaskEnqueueGroup[];
	statuses: Array<{ key: TaskStatusKey; label: string }>;
	retentionDays: number;
	queueEnabled: boolean;
};

export const TASK_STATUS_FALLBACK_LABELS: Record<TaskStatusKey, string> = {
	queued: "排队中",
	running: "运行中",
	completed: "已完成",
	failed: "失败",
	"dead-letter": "死信",
	interrupted: "已中断",
};

export const TASK_RANGE_LABELS: Record<TaskFiltersView["range"], string> = {
	today: "今天",
	"7d": "近 7 天",
	"30d": "近 30 天",
	all: "全部时间",
};
