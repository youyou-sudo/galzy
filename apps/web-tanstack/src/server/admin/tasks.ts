import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { ApiError } from "@web/lib";
import type {
	TaskListFilters,
	TaskOrder,
	TaskPageSize,
	TaskRange,
	TaskSearch,
	TaskSortField,
	TaskStatus,
} from "@web/lib/admin/tasks/params";
import {
	TASK_ORDER_KEYS,
	TASK_SORT_FIELDS,
	TASK_STATUS_KEYS,
} from "@web/lib/admin/tasks/params";
import { cookiePass } from "@web/lib/cookie-pass";
import * as z from "zod/mini";

export type {
	TaskListFilters,
	TaskOrder,
	TaskPageSize,
	TaskRange,
	TaskSearch,
	TaskSortField,
	TaskStatus,
};

/**
 * 任务队列 BFF（server functions）。
 *
 * 与后端 `apps/api/src/modules/tasks` 的契约 V2 一一对应：
 * - 列表返回 envelope（items/total/page/pageSize/totalPages/counts/applied）；
 * - 死信列表由裸数组改为 envelope；
 * - 日志支持 limit / afterId / level 增量拉取；
 * - 批量操作逐项回报。
 *
 * 错误处理：Eden 的 `{ status, value }` 里 `value = { code, message }`，
 * 但 TanStack Start 的 server fn 跨进程只保留 message。所以这里把 code
 * 编码进 message（`CODE|message`），并提供 `parseApiError` 供 UI 还原。
 * 不要直接用 `elysiaErrorF`，它会丢掉 code。
 */

/* ────────────────────────────── 类型契约 ────────────────────────────── */

/** 任务状态（与后端 TaskStatus 一致，定义在 params 中避免两处漂移）。 */

/** 列表投影：不含 payload / result（列表页不需要，避免响应被大 JSON 撑爆）。 */
export type TaskListItem = {
	id: string;
	queue: string;
	type: string;
	status: TaskStatus;
	progress: number;
	error: string | null;
	startedAt: string | null;
	finishedAt: string | null;
	createdAt: string;
	/** 后端将来的显式截止时间（SLA 判定优先使用），旧数据可能没有。 */
	dueAt?: string | null;
};

/** 详情投影：列表字段 + payload / result 等全字段。 */
export type QueueJobRow = TaskListItem & {
	payload: any;
	result: any;
	attemptsMade?: number;
	updatedAt?: string;
};

/** 后端归一化后的实际生效筛选条件（用于回显）。 */
export type TaskListApplied = {
	q: string | null;
	queues: string[];
	types: string[];
	statuses: TaskStatus[];
	dateFrom: string | null;
	dateTo: string | null;
	overdue?: boolean;
	retryable?: boolean;
	sort: TaskSortField;
	order: TaskOrder;
};

/** GET /tasks 响应。 */
export type TaskListResponse = {
	items: TaskListItem[];
	total: number;
	/** 1 基页码 */
	page: number;
	/** 0 基页码（兼容旧客户端） */
	pageIndex: number;
	pageSize: number;
	totalPages: number;
	/** 分面计数：在「除 status 之外」的筛选条件下的各状态数量 */
	counts?: Record<string, number>;
	applied: TaskListApplied;
};

/** 任务状态聚合（统计卡）。 */
export type TaskStats = {
	counts: Record<string, number>;
	total: number;
};

/** 队列实时状态（bun-queue Redis 计数）。 */
export type QueueStatsRow = {
	queue: string;
	waiting: number;
	active: number;
	completed: number;
	failed: number;
	delayed: number;
	paused: number;
	/** 数据来源：redis = 实时；disabled = Redis 未启用（数字全 0） */
	source?: "redis" | "disabled";
};

/** /tasks/meta 中的任务类型条目。 */
export type TaskMetaTask = {
	type: string;
	label: string;
	/** 后端可能给数字优先级，也可能给展示文案；UI 不依赖具体类型。 */
	priority?: string | number;
};

/** /tasks/meta 中的队列条目。 */
export type TaskMetaQueue = {
	key: string;
	label: string;
	tasks: TaskMetaTask[];
};

/** /tasks/meta 中的状态条目。 */
export type TaskMetaStatus = {
	key: TaskStatus;
	label: string;
};

/** 队列/类型/状态元数据（后端为单一来源，前端不再硬编码下拉项）。 */
export type TaskMeta = {
	queues: TaskMetaQueue[];
	statuses: TaskMetaStatus[];
	retentionDays: number;
	queueEnabled: boolean;
	/** 后端下发的 SLA 字典（分钟），前端 sla.ts 的本地兜底可被它覆盖。 */
	slaMinutes?: Record<string, number>;
	/** 排队滞留阈值（分钟） */
	queueWaitSlaMinutes?: number;
	/** 类型 → 优先级（P0..P3） */
	priorities?: Record<string, string>;
};

/** 日志级别。 */
export const TASK_LOG_LEVELS = ["info", "warn", "error", "success"] as const;

export type TaskLogLevel = (typeof TASK_LOG_LEVELS)[number];

/** 任务执行日志一行。 */
export type QueueJobLogRow = {
	id: number;
	jobId: string;
	level: TaskLogLevel;
	message: string;
	createdAt: string;
};

/** 日志增量拉取响应（afterId 用于轮询，只取新日志）。 */
export type TaskLogsPage = {
	items: QueueJobLogRow[];
	nextAfterId: number | null;
};

/** 单条重试结果。 */
export type RetryTaskResult = {
	ok: boolean;
	jobId: string;
	mode: "requeue" | "republish";
};

/** 单条删除结果（非终态 409 会先被 raiseApiError 抛出）。 */
export type DeleteTaskResult = {
	ok: boolean;
	deleted: boolean;
};

/** 批量操作单项结果。 */
export type BatchItemResult = {
	id: string;
	ok: boolean;
	mode?: "requeue" | "republish";
	jobId?: string;
	code?: string;
	message?: string;
};

/** 批量删除结果。 */
export type BatchDeleteResult = {
	ok: boolean;
	requested: number;
	deleted: number;
	missing: string[];
	failed: Array<{ id: string; code: string; message: string }>;
};

/** 批量重试 / 死信批量操作结果。 */
export type BatchOperationResult = {
	ok: boolean;
	requested: number;
	succeeded: number;
	failed: number;
	results: BatchItemResult[];
};

/** 死信任务一行（Redis DLQ 快照）。 */
export type DeadLetterJobRow = {
	id: string;
	type: string;
	failedReason: string | null;
	attemptsMade: number;
	stacktrace: string[];
	timestamp: number;
};

/** 死信列表响应。 */
export type DeadLetterListResponse = {
	items: DeadLetterJobRow[];
	page: number;
	pageSize: number;
	hasMore: boolean;
};

/** 死信重放结果。 */
export type RepublishDeadLetterResult = {
	ok: boolean;
	jobId: string;
};

/** 死信丢弃结果。 */
export type RemoveDeadLetterResult = {
	ok: boolean;
	removed: boolean;
};

/** 手动入队结果。 */
export type EnqueueTaskResult = {
	ok: boolean;
	jobId: string;
};

/* ────────────────────────────── 错误编解码 ────────────────────────────── */

export type ParsedApiError = {
	code: string | null;
	message: string;
};

type EdenErrorShape = {
	status?: unknown;
	value?: unknown;
};

const isEdenError = (value: unknown): value is EdenErrorShape =>
	typeof value === "object" &&
	value !== null &&
	"status" in value &&
	"value" in value;

function describeEdenValue(value: unknown): ParsedApiError {
	if (typeof value === "string") return { code: null, message: value };
	if (typeof value === "object" && value !== null) {
		const record = value as Record<string, unknown>;
		const code =
			typeof record.code === "string"
				? record.code
				: typeof record.error === "string"
					? record.error
					: null;
		const message =
			typeof record.message === "string"
				? record.message
				: JSON.stringify(value);
		return { code, message };
	}
	return { code: null, message: String(value ?? "") };
}

/**
 * 把 Eden 错误转成 `ApiError(status, "CODE|message")`。
 *
 * 没有 code 时只抛 message（保持与旧行为一致，后端未提供 code 的 4xx/5xx 不丢信息）。
 */
function raiseApiError(error: unknown): void {
	if (!isEdenError(error)) return;
	const status = typeof error.status === "number" ? error.status : 500;
	const { code, message } = describeEdenValue(error.value);
	const text = message || "未知错误";
	throw new ApiError(status, code ? `${code}|${text}` : text);
}

/** `CODE|message` 的前缀形态（后端错误码约定为大写下划线）。 */
const API_ERROR_PREFIX = /^([A-Z][A-Z0-9_]*)\|([\s\S]*)$/;

function errorMessageOf(error: unknown): string {
	if (typeof error === "string") return error;
	if (error instanceof Error) return error.message;
	if (typeof error === "object" && error !== null) {
		if (isEdenError(error)) return describeEdenValue(error.value).message;
		const record = error as Record<string, unknown>;
		if (typeof record.message === "string") return record.message;
	}
	return "";
}

/**
 * 从任意抛出的错误里还原 `{ code, message }`。
 *
 * - BFF 抛出的 `ApiError` 形如 `TASK_NOT_FOUND|任务不存在`；
 * - 没有 code 前缀时 code 为 null（兼容旧接口与网络错误）；
 * - 直接传 Eden 原始错误对象也能解析（方便在 server 侧调试）。
 */
export function parseApiError(error: unknown): ParsedApiError {
	if (isEdenError(error)) {
		const parsed = describeEdenValue(error.value);
		if (parsed.code) return parsed;
	}
	const raw = errorMessageOf(error) || "未知错误";
	const match = API_ERROR_PREFIX.exec(raw);
	if (match) {
		return { code: match[1], message: match[2] || match[1] };
	}
	if (
		typeof error === "object" &&
		error !== null &&
		!isEdenError(error) &&
		typeof (error as Record<string, unknown>).code === "string"
	) {
		return {
			code: (error as Record<string, unknown>).code as string,
			message: raw,
		};
	}
	return { code: null, message: raw };
}

/* ────────────────────────────── 内部工具 ────────────────────────────── */

/**
 * Eden treaty 访问器。
 *
 * 只在 handler 内调用（函数形式），避免模块加载期就创建 treaty 客户端
 * ——客户端 bundle 不应该触碰 Eden。类型直接取自 `type app`（别再整体包一层 any，
 * 那会让本模块所有端点都失去类型校验）；唯一需要收口的是 compactQuery 的结果，
 * 因为它会按需删键，Eden 看到的却是「必填字段必填」。
 */
const tasksApi = () => api.tasks;

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function numberOr(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

const statusSet: ReadonlySet<string> = new Set(TASK_STATUS_KEYS);

const isTaskStatus = (value: string): value is TaskStatus =>
	statusSet.has(value);

function normalizeApplied(raw: unknown): TaskListApplied {
	const record = asRecord(raw);
	return {
		q: stringOrNull(record.q),
		queues: stringArray(record.queues),
		types: stringArray(record.types),
		statuses: stringArray(record.statuses).filter(isTaskStatus),
		dateFrom: stringOrNull(record.dateFrom),
		dateTo: stringOrNull(record.dateTo),
		overdue: record.overdue === true,
		retryable: record.retryable === true,
		sort: TASK_SORT_FIELDS.includes(
			record.sort as (typeof TASK_SORT_FIELDS)[number],
		)
			? (record.sort as TaskSortField)
			: "createdAt",
		order: record.order === "asc" ? "asc" : "desc",
	};
}

/**
 * 兼容旧后端（只返回 { items, total }）：缺的 envelope 字段按已有信息推导。
 * 这样 PR 期间前后端可以不同步落地，不会出现整页 NaN。
 */
function normalizeTaskList(raw: unknown): TaskListResponse {
	const record = asRecord(raw);
	const items = Array.isArray(record.items)
		? (record.items as TaskListItem[])
		: [];
	const total = numberOr(record.total, items.length);
	const pageSize = numberOr(record.pageSize, 20);
	const page = numberOr(record.page, numberOr(record.pageIndex, 0) + 1);
	const pageIndex = numberOr(record.pageIndex, page - 1);
	const totalPages = numberOr(
		record.totalPages,
		Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
	);
	const counts = asRecord(record.counts);
	const hasCounts = Object.keys(counts).length > 0;

	return {
		items,
		total,
		page,
		pageIndex,
		pageSize,
		totalPages,
		...(hasCounts ? { counts: counts as Record<string, number> } : {}),
		applied: normalizeApplied(record.applied),
	};
}

/** 兼容旧后端（裸数组）与契约 V2（envelope）。 */
function normalizeTaskLogs(raw: unknown): TaskLogsPage {
	if (Array.isArray(raw)) {
		const items = raw as QueueJobLogRow[];
		const last = items.length > 0 ? items[items.length - 1] : undefined;
		return { items, nextAfterId: last ? last.id : null };
	}
	const record = asRecord(raw);
	const items = Array.isArray(record.items)
		? (record.items as QueueJobLogRow[])
		: [];
	return {
		items,
		nextAfterId:
			typeof record.nextAfterId === "number" ? record.nextAfterId : null,
	};
}

/** 兼容旧后端（裸数组）与契约 V2（envelope）。 */
function normalizeDeadLetters(
	raw: unknown,
	fallbackPageSize: number,
): DeadLetterListResponse {
	if (Array.isArray(raw)) {
		const items = raw as DeadLetterJobRow[];
		return {
			items,
			page: 1,
			pageSize: items.length,
			hasMore: items.length >= fallbackPageSize,
		};
	}
	const record = asRecord(raw);
	const items = Array.isArray(record.items)
		? (record.items as DeadLetterJobRow[])
		: [];
	const pageIndex = numberOr(record.pageIndex, 0);
	return {
		items,
		// 后端 pageIndex=0 时 page 可能被算成 0（历史实现），这里兜底为 1 基
		page: Math.max(1, numberOr(record.page, pageIndex + 1)),
		pageSize: numberOr(record.pageSize, fallbackPageSize),
		hasMore:
			typeof record.hasMore === "boolean"
				? record.hasMore
				: items.length >= fallbackPageSize,
	};
}

function normalizeTaskMeta(raw: unknown): TaskMeta {
	const record = asRecord(raw);
	const slaMinutes = asRecord(record.slaMinutes);
	const priorities = asRecord(record.priorities);
	return {
		queues: Array.isArray(record.queues)
			? (record.queues as TaskMetaQueue[])
			: [],
		statuses: Array.isArray(record.statuses)
			? (record.statuses as TaskMetaStatus[])
			: [],
		retentionDays: numberOr(record.retentionDays, 30),
		queueEnabled:
			typeof record.queueEnabled === "boolean" ? record.queueEnabled : true,
		...(Object.keys(slaMinutes).length > 0
			? { slaMinutes: slaMinutes as Record<string, number> }
			: {}),
		...(Object.keys(priorities).length > 0
			? { priorities: priorities as Record<string, string> }
			: {}),
		...(typeof record.queueWaitSlaMinutes === "number"
			? { queueWaitSlaMinutes: record.queueWaitSlaMinutes }
			: {}),
	};
}

function normalizeRetry(raw: unknown, jobId: string): RetryTaskResult {
	const record = asRecord(raw);
	return {
		ok: record.ok !== false,
		jobId: typeof record.jobId === "string" ? record.jobId : jobId,
		mode: record.mode === "republish" ? "republish" : "requeue",
	};
}

function normalizeBatchDelete(
	raw: unknown,
	requested: number,
): BatchDeleteResult {
	const record = asRecord(raw);
	return {
		ok: record.ok !== false,
		requested: numberOr(record.requested, requested),
		deleted: numberOr(record.deleted, 0),
		missing: stringArray(record.missing),
		failed: Array.isArray(record.failed)
			? (record.failed as BatchDeleteResult["failed"])
			: [],
	};
}

function normalizeBatchOperation(
	raw: unknown,
	requested: number,
): BatchOperationResult {
	const record = asRecord(raw);
	const results = Array.isArray(record.results)
		? (record.results as BatchItemResult[])
		: [];
	return {
		ok: record.ok !== false,
		requested: numberOr(record.requested, requested),
		succeeded: numberOr(record.succeeded, results.filter((r) => r.ok).length),
		failed: numberOr(record.failed, results.filter((r) => !r.ok).length),
		results,
	};
}

/** 只保留有值的参数，避免把 undefined / 空数组序列化进 query string。 */
function compactQuery(input: object): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (value === undefined || value === null) continue;
		// 空串等价于「没传」：后端这些 filter 参数都有 minLength 1，
		// 传 q= / status= 会直接 400。
		if (value === "") continue;
		if (Array.isArray(value) && value.length === 0) continue;
		result[key] = value;
	}
	return result;
}

/* ────────────────────────────── 共享请求实现 ────────────────────────────── */

async function fetchTaskLogs(
	jobId: string,
	options: { limit?: number; afterId?: number; level?: TaskLogLevel },
): Promise<TaskLogsPage> {
	const query = compactQuery({
		limit: options.limit,
		afterId: options.afterId,
		level: options.level,
	});
	const { data: result, error } = await tasksApi()({ jobId }).logs.get({
		// compactQuery 会按需删键，丢掉「必填」信息；默认值由 server fn 的 zod 保证
		query: query as any,
		...cookiePass(),
	});
	raiseApiError(error);
	return normalizeTaskLogs(result);
}

async function fetchDeadLetters(
	queue: string,
	options: { pageSize: number; pageIndex?: number; page?: number },
): Promise<DeadLetterListResponse> {
	const query = compactQuery({
		pageSize: options.pageSize,
		pageIndex: options.pageIndex,
		page: options.page,
	});
	const { data: result, error } = await tasksApi()
		.deadLetter({ queue })
		// 同上：compactQuery 的结果无法满足 Eden 的必填字段类型
		.get({ query: query as any, ...cookiePass() });
	raiseApiError(error);
	return normalizeDeadLetters(result, options.pageSize);
}

/* ────────────────────────────── 查询 server fns ────────────────────────────── */

/** 多值 query 参数：后端同时接受 string 与 string[]。 */
const multiString = z.optional(
	z.union([
		z.string().check(z.minLength(1)),
		z.array(z.string().check(z.minLength(1))),
	]),
);

const multiStatus = z.optional(
	z.union([z.enum(TASK_STATUS_KEYS), z.array(z.enum(TASK_STATUS_KEYS))]),
);

/** 任务列表（分页 + 多条件过滤 + 分面计数）。 */
export const listTasks = createServerFn({ method: "GET" })
	.validator(
		z.object({
			q: z.optional(z.string()),
			/** 单状态等值：保持旧契约的宽松 string（非法值由后端 400 INVALID_FILTER 拒绝） */
			status: z.optional(z.string().check(z.minLength(1))),
			statuses: multiStatus,
			queue: multiString,
			queues: multiString,
			type: multiString,
			types: multiString,
			dateFrom: z.optional(z.string()),
			dateTo: z.optional(z.string()),
			overdue: z.optional(z.boolean()),
			retryable: z.optional(z.boolean()),
			sort: z.optional(z.enum(TASK_SORT_FIELDS)),
			order: z.optional(z.enum(TASK_ORDER_KEYS)),
			page: z.optional(z.number().check(z.int(), z.minimum(1))),
			pageIndex: z.optional(z.number().check(z.int(), z.minimum(0))),
			pageSize: z._default(
				z.number().check(z.int(), z.minimum(1), z.maximum(100)),
				20,
			),
			withCounts: z.optional(z.boolean()),
		}),
	)
	.handler(async ({ data }) => {
		const { data: result, error } = await tasksApi().get({
			// 同上：compactQuery 会删掉 undefined 键，但 Eden 的 pageSize 等字段是必填
			query: compactQuery(data) as any,
			...cookiePass(),
		});
		raiseApiError(error);
		return normalizeTaskList(result);
	});

/** 状态统计（顶部统计卡 + 筛选 Tabs 徽标）。 */
export const getTaskStats = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data: result, error } = await tasksApi().stats.get(cookiePass());
		raiseApiError(error);
		return (result ?? { counts: {}, total: 0 }) as TaskStats;
	},
);

/** 队列实时状态（队列状态卡）。 */
export const getQueueStats = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data: result, error } = await tasksApi().queues.get(cookiePass());
		raiseApiError(error);
		return (result ?? []) as QueueStatsRow[];
	},
);

/** 队列 / 任务类型 / 状态元数据（下拉项、标签的单一来源）。 */
export const getTaskMeta = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data: result, error } = await tasksApi().meta.get(cookiePass());
		raiseApiError(error);
		return normalizeTaskMeta(result);
	},
);

/** 单个任务详情（全字段，含 payload / result）。 */
export const getTaskDetail = createServerFn({ method: "GET" })
	.validator(z.object({ jobId: z.string().check(z.minLength(1)) }))
	.handler(async ({ data: { jobId } }) => {
		const { data: result, error } = await tasksApi()({ jobId }).get(
			cookiePass(),
		);
		raiseApiError(error);
		return (result ?? null) as QueueJobRow | null;
	});

/**
 * 任务执行日志（**旧版兼容**）：返回数组，供未迁移的页面使用。
 * 新代码请用 `listTaskLogs`（带 nextAfterId，支持增量轮询）。
 */
export const getTaskLogs = createServerFn({ method: "GET" })
	.validator(
		z.object({
			jobId: z.string().check(z.minLength(1)),
			/** 旧参数：当作 limit 使用 */
			pageSize: z.optional(z.number().check(z.int(), z.minimum(1))),
			/** 旧参数：增量接口不认 pageIndex，保留以免旧调用报错 */
			pageIndex: z.optional(z.number().check(z.int(), z.minimum(0))),
			limit: z.optional(
				z.number().check(z.int(), z.minimum(1), z.maximum(500)),
			),
			afterId: z.optional(z.number().check(z.int(), z.minimum(0))),
			level: z.optional(z.enum(TASK_LOG_LEVELS)),
		}),
	)
	.handler(async ({ data }) => {
		const page = await fetchTaskLogs(data.jobId, {
			limit: data.limit ?? data.pageSize ?? 100,
			afterId: data.afterId,
			level: data.level,
		});
		return page.items;
	});

/** 任务执行日志（契约 V2）：`{ items, nextAfterId }`，支持 afterId 增量轮询。 */
export const listTaskLogs = createServerFn({ method: "GET" })
	.validator(
		z.object({
			jobId: z.string().check(z.minLength(1)),
			limit: z._default(
				z.number().check(z.int(), z.minimum(1), z.maximum(500)),
				100,
			),
			afterId: z.optional(z.number().check(z.int(), z.minimum(0))),
			level: z.optional(z.enum(TASK_LOG_LEVELS)),
		}),
	)
	.handler(async ({ data }) =>
		fetchTaskLogs(data.jobId, {
			limit: data.limit,
			afterId: data.afterId,
			level: data.level,
		}),
	);

/* ────────────────────────────── 写操作 ────────────────────────────── */

/** 重试失败/中断/死信任务。 */
export const retryTask = createServerFn({ method: "POST" })
	.validator(z.object({ jobId: z.string().check(z.minLength(1)) }))
	.handler(async ({ data: { jobId } }) => {
		// 先传 body 再传 options：Eden 的 POST 第一个参数永远是 body，
		// 直接传 cookiePass() 会把 cookie 当请求体发出去（鉴权丢失）。
		const { data: result, error } = await tasksApi()({ jobId }).retry.post(
			{},
			cookiePass(),
		);
		raiseApiError(error);
		return normalizeRetry(result, jobId);
	});

/** 删除单条任务记录（非终态会被后端以 409 拒绝）。 */
export const deleteTask = createServerFn({ method: "POST" })
	.validator(z.object({ jobId: z.string().check(z.minLength(1)) }))
	.handler(async ({ data: { jobId } }) => {
		// 该路由声明了可选 body（force），必须传 body 后再传 options，
		// 否则 cookie 会被当成请求体。
		const { data: result, error } = await tasksApi()({ jobId }).delete.post(
			{},
			cookiePass(),
		);
		raiseApiError(error);
		const record = asRecord(result);
		return {
			ok: record.ok !== false,
			deleted:
				typeof record.deleted === "boolean"
					? record.deleted
					: record.ok !== false,
		} satisfies DeleteTaskResult;
	});

/** 批量删除任务记录（逐项回报，允许部分成功）。 */
export const batchDeleteTasks = createServerFn({ method: "POST" })
	.validator(
		z.object({
			ids: z
				.array(z.string().check(z.minLength(1)))
				.check(z.minLength(1), z.maxLength(500)),
		}),
	)
	.handler(async ({ data: { ids } }) => {
		const { data: result, error } = await tasksApi().batchDelete.post(
			{ ids },
			cookiePass(),
		);
		raiseApiError(error);
		return normalizeBatchDelete(result, ids.length);
	});

/** 批量重试（逐项回报，允许部分成功）。 */
export const batchRetryTasks = createServerFn({ method: "POST" })
	.validator(
		z.object({
			// 后端 batchRetryBody 上限 100（每条一次 Redis 往返）
			ids: z
				.array(z.string().check(z.minLength(1)))
				.check(z.minLength(1), z.maxLength(100)),
		}),
	)
	.handler(async ({ data: { ids } }) => {
		const { data: result, error } = await tasksApi().batchRetry.post(
			{ ids },
			cookiePass(),
		);
		raiseApiError(error);
		return normalizeBatchOperation(result, ids.length);
	});

/** 手动入队（POST /tasks/enqueue/:queue，body { type }）。 */
export const enqueueTask = createServerFn({ method: "POST" })
	.validator(
		z.object({
			queue: z.string().check(z.minLength(1)),
			type: z.string().check(z.minLength(1)),
		}),
	)
	.handler(async ({ data: { queue, type } }) => {
		const { data: result, error } = await tasksApi()
			.enqueue({ queue })
			.post({ type }, cookiePass());
		raiseApiError(error);
		const record = asRecord(result);
		return {
			ok: record.ok !== false,
			jobId: typeof record.jobId === "string" ? record.jobId : "",
		} satisfies EnqueueTaskResult;
	});

/* ────────────────────────────── 死信管理 ────────────────────────────── */

/** 死信任务列表（契约 V2：envelope 带 hasMore，便于「加载更多」）。 */
export const listDeadLetters = createServerFn({ method: "GET" })
	.validator(
		z.object({
			queue: z.string().check(z.minLength(1)),
			pageSize: z._default(
				z.number().check(z.int(), z.minimum(1), z.maximum(500)),
				50,
			),
			pageIndex: z._default(z.number().check(z.int(), z.minimum(0)), 0),
		}),
	)
	.handler(async ({ data }) =>
		fetchDeadLetters(data.queue, {
			pageSize: data.pageSize,
			pageIndex: data.pageIndex,
		}),
	);

/**
 * 死信任务列表（**旧版兼容**）：返回裸数组。
 * 新代码请用 `listDeadLetters`（envelope + hasMore）。
 */
export const listDeadLetterTasks = createServerFn({ method: "GET" })
	.validator(
		z.object({
			queue: z.string().check(z.minLength(1)),
			pageSize: z._default(
				z.number().check(z.int(), z.minimum(1), z.maximum(500)),
				50,
			),
			pageIndex: z._default(z.number().check(z.int(), z.minimum(0)), 0),
		}),
	)
	.handler(
		async ({ data }) =>
			(
				await fetchDeadLetters(data.queue, {
					pageSize: data.pageSize,
					pageIndex: data.pageIndex,
				})
			).items,
	);

/** 死信重放（回原队列）。 */
export const republishDeadLetterTask = createServerFn({ method: "POST" })
	.validator(
		z.object({
			queue: z.string().check(z.minLength(1)),
			jobId: z.string().check(z.minLength(1)),
		}),
	)
	.handler(async ({ data: { queue, jobId } }) => {
		const { data: result, error } = await tasksApi()
			.deadLetter({ queue })
			.republish.post({ jobId }, cookiePass());
		raiseApiError(error);
		const record = asRecord(result);
		return {
			ok: record.ok !== false,
			jobId: typeof record.jobId === "string" ? record.jobId : jobId,
		} satisfies RepublishDeadLetterResult;
	});

/** 丢弃死信。 */
export const removeDeadLetterTask = createServerFn({ method: "POST" })
	.validator(
		z.object({
			queue: z.string().check(z.minLength(1)),
			jobId: z.string().check(z.minLength(1)),
		}),
	)
	.handler(async ({ data: { queue, jobId } }) => {
		const { data: result, error } = await tasksApi()
			.deadLetter({ queue })
			.remove.post({ jobId }, cookiePass());
		raiseApiError(error);
		const record = asRecord(result);
		return {
			ok: record.ok !== false,
			removed:
				typeof record.removed === "boolean"
					? record.removed
					: record.ok !== false,
		} satisfies RemoveDeadLetterResult;
	});

/** 批量重放死信（逐项回报，允许部分成功）。 */
export const batchRepublishDeadLetters = createServerFn({ method: "POST" })
	.validator(
		z.object({
			queue: z.string().check(z.minLength(1)),
			jobIds: z
				.array(z.string().check(z.minLength(1)))
				.check(z.minLength(1), z.maxLength(100)),
		}),
	)
	.handler(async ({ data: { queue, jobIds } }) => {
		const { data: result, error } = await tasksApi()
			.deadLetter({ queue })
			.batchRepublish.post({ jobIds }, cookiePass());
		raiseApiError(error);
		return normalizeBatchOperation(result, jobIds.length);
	});

/** 批量丢弃死信（逐项回报，允许部分成功）。 */
export const batchRemoveDeadLetters = createServerFn({ method: "POST" })
	.validator(
		z.object({
			queue: z.string().check(z.minLength(1)),
			jobIds: z
				.array(z.string().check(z.minLength(1)))
				.check(z.minLength(1), z.maxLength(100)),
		}),
	)
	.handler(async ({ data: { queue, jobIds } }) => {
		const { data: result, error } = await tasksApi()
			.deadLetter({ queue })
			.batchRemove.post({ jobIds }, cookiePass());
		raiseApiError(error);
		return normalizeBatchOperation(result, jobIds.length);
	});
