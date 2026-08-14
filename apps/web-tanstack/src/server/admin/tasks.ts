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
	status: "queued" | "running" | "completed" | "failed" | "dead-letter";
	progress: number;
	// biome-ignore lint/suspicious/noExplicitAny: jsonb 字段运行时为任意 JSON，无稳定形状
	payload: any;
	// biome-ignore lint/suspicious/noExplicitAny: jsonb 字段运行时为任意 JSON，无稳定形状
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
		// Elysia 推断的响应类型含联合，会被 createServerFn 收敛为 unknown，这里按已知形状定型
		return (result ?? []) as unknown as QueueJobRow[];
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

/** 手动入队（POST /tasks/:queue，body { type }）。 */
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
