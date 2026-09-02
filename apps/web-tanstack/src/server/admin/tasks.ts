import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import { cookiePass } from "@web/lib/cookie-pass";
import z from "zod";

/** 任务队列状态（后端 galrc_queue_job 一行的驼峰形状，与 Drizzle 返回一致）。 */
export type QueueJobRow = {
	id: string;
	queue: string;
	type: string;
	status:
		| "queued"
		| "running"
		| "completed"
		| "failed"
		| "dead-letter"
		| "interrupted";
	progress: number;
	payload: any;
	result: any;
	error: string | null;
	startedAt: string | null;
	finishedAt: string | null;
	createdAt: string;
};

export type QueueJobLogRow = {
	id: number;
	jobId: string;
	level: "info" | "warn" | "error" | "success";
	message: string;
	createdAt: string;
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
};

/** 任务列表响应（分页）。 */
export type TaskListResult = {
	items: QueueJobRow[];
	total: number;
};

/** 任务列表（分页 + 过滤）。 */
export const listTasks = createServerFn({ method: "GET" })
	.validator(
		z.object({
			queue: z.string().optional(),
			type: z.string().optional(),
			status: z.string().optional(),
			pageSize: z.number().min(1).max(100).default(20),
			pageIndex: z.number().min(0).default(0),
		}),
	)
	.handler(async ({ data }) => {
		const { data: result, error } = await api.tasks.get({
			query: data,
			...cookiePass(),
		});
		elysiaErrorF(error);
		return (result ?? { items: [], total: 0 }) as unknown as TaskListResult;
	});

/** 状态统计（顶部统计卡 + 筛选 Tabs 徽标）。 */
export const getTaskStats = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data: result, error } = await api.tasks.stats.get(cookiePass());
		elysiaErrorF(error);
		return (result ?? { counts: {}, total: 0 }) as unknown as TaskStats;
	},
);

/** 队列实时状态（队列状态卡）。 */
export const getQueueStats = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data: result, error } = await api.tasks.queues.get(cookiePass());
		elysiaErrorF(error);
		return (result ?? []) as unknown as QueueStatsRow[];
	},
);

/** 重试失败/中断/死信任务。 */
export const retryTask = createServerFn({ method: "POST" })
	.validator(z.object({ jobId: z.string().min(1) }))
	.handler(async ({ data: { jobId } }) => {
		const { data: result, error } = await api
			.tasks({ jobId })
			.retry.post(cookiePass());
		elysiaErrorF(error);
		return result as unknown as { ok: boolean; jobId: string } | null;
	});

/** 删除单条任务记录。 */
export const deleteTask = createServerFn({ method: "POST" })
	.validator(z.object({ jobId: z.string().min(1) }))
	.handler(async ({ data: { jobId } }) => {
		const { data: result, error } = await api
			.tasks({ jobId })
			.delete.post(cookiePass());
		elysiaErrorF(error);
		return result as unknown as { ok: boolean } | null;
	});

/** 批量删除任务记录。 */
export const batchDeleteTasks = createServerFn({ method: "POST" })
	.validator(z.object({ ids: z.array(z.string().min(1)).min(1) }))
	.handler(async ({ data: { ids } }) => {
		const { data: result, error } = await api.tasks.batchDelete.post(
			{ ids },
			cookiePass(),
		);
		elysiaErrorF(error);
		return result as unknown as { ok: boolean; deleted: number } | null;
	});

/** 单个任务详情。 */
export const getTaskDetail = createServerFn({ method: "GET" })
	.validator(z.object({ jobId: z.string().min(1) }))
	.handler(async ({ data: { jobId } }) => {
		const { data: result, error } = await api
			.tasks({ jobId })
			.get(cookiePass());
		elysiaErrorF(error);
		return (result ?? null) as unknown as QueueJobRow | null;
	});

/** 任务执行日志（按时间倒序）。 */
export const getTaskLogs = createServerFn({ method: "GET" })
	.validator(
		z.object({
			jobId: z.string().min(1),
			pageSize: z.number().min(1).max(500).default(100),
			pageIndex: z.number().min(0).default(0),
		}),
	)
	.handler(async ({ data: { jobId, pageSize, pageIndex } }) => {
		const { data: result, error } = await api
			.tasks({ jobId })
			.logs.get({ query: { pageSize, pageIndex }, ...cookiePass() });
		elysiaErrorF(error);
		return (result ?? []) as unknown as QueueJobLogRow[];
	});

/** 手动入队（POST /tasks/enqueue/:queue，body { type }）。 */
export const enqueueTask = createServerFn({ method: "POST" })
	.validator(
		z.object({
			queue: z.string().min(1),
			type: z.string().min(1),
		}),
	)
	.handler(async ({ data: { queue, type } }) => {
		const { data: result, error } = await api.tasks
			.enqueue({ queue })
			.post({ type }, cookiePass());
		elysiaErrorF(error);
		return result as unknown as { ok: boolean; jobId: string } | null;
	});

/** 死信任务一行（Redis DLQ 快照）。 */
export type DeadLetterJobRow = {
	id: string;
	type: string;
	failedReason: string | null;
	attemptsMade: number;
	stacktrace: string[];
	timestamp: number;
};

/** 死信任务列表（按队列）。 */
export const listDeadLetterTasks = createServerFn({ method: "GET" })
	.validator(
		z.object({
			queue: z.string().min(1),
			pageSize: z.number().min(1).max(500).default(50),
			pageIndex: z.number().min(0).default(0),
		}),
	)
	.handler(async ({ data: { queue, pageSize, pageIndex } }) => {
		const { data: result, error } = await api.tasks
			.deadLetter({ queue })
			.get({ query: { pageSize, pageIndex }, ...cookiePass() });
		elysiaErrorF(error);
		return (result ?? []) as unknown as DeadLetterJobRow[];
	});

/** 死信重放（回原队列）。 */
export const republishDeadLetterTask = createServerFn({ method: "POST" })
	.validator(z.object({ queue: z.string().min(1), jobId: z.string().min(1) }))
	.handler(async ({ data: { queue, jobId } }) => {
		const { data: result, error } = await api.tasks
			.deadLetter({ queue })
			.republish.post({ jobId }, cookiePass());
		elysiaErrorF(error);
		return result as unknown as { ok: boolean; jobId: string } | null;
	});

/** 丢弃死信。 */
export const removeDeadLetterTask = createServerFn({ method: "POST" })
	.validator(z.object({ queue: z.string().min(1), jobId: z.string().min(1) }))
	.handler(async ({ data: { queue, jobId } }) => {
		const { data: result, error } = await api.tasks
			.deadLetter({ queue })
			.remove.post({ jobId }, cookiePass());
		elysiaErrorF(error);
		return result as unknown as { ok: boolean } | null;
	});
