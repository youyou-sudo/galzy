import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/admin/tasks";

export const listTasks = bffFn<typeof impl.listTasks>("admin.tasks.listTasks");
export const getTaskStats = bffFn<typeof impl.getTaskStats>("admin.tasks.getTaskStats");
export const getQueueStats = bffFn<typeof impl.getQueueStats>("admin.tasks.getQueueStats");
export const getTaskMeta = bffFn<typeof impl.getTaskMeta>("admin.tasks.getTaskMeta");
export const getTaskDetail = bffFn<typeof impl.getTaskDetail>("admin.tasks.getTaskDetail");
export const getTaskLogs = bffFn<typeof impl.getTaskLogs>("admin.tasks.getTaskLogs");
export const listTaskLogs = bffFn<typeof impl.listTaskLogs>("admin.tasks.listTaskLogs");
export const retryTask = bffFn<typeof impl.retryTask>("admin.tasks.retryTask");
export const deleteTask = bffFn<typeof impl.deleteTask>("admin.tasks.deleteTask");
export const batchDeleteTasks = bffFn<typeof impl.batchDeleteTasks>("admin.tasks.batchDeleteTasks");
export const batchRetryTasks = bffFn<typeof impl.batchRetryTasks>("admin.tasks.batchRetryTasks");
export const enqueueTask = bffFn<typeof impl.enqueueTask>("admin.tasks.enqueueTask");
export const listDeadLetters = bffFn<typeof impl.listDeadLetters>("admin.tasks.listDeadLetters");
export const listDeadLetterTasks = bffFn<typeof impl.listDeadLetterTasks>("admin.tasks.listDeadLetterTasks");
export const republishDeadLetterTask = bffFn<typeof impl.republishDeadLetterTask>("admin.tasks.republishDeadLetterTask");
export const removeDeadLetterTask = bffFn<typeof impl.removeDeadLetterTask>("admin.tasks.removeDeadLetterTask");
export const batchRepublishDeadLetters = bffFn<typeof impl.batchRepublishDeadLetters>("admin.tasks.batchRepublishDeadLetters");
export const batchRemoveDeadLetters = bffFn<typeof impl.batchRemoveDeadLetters>("admin.tasks.batchRemoveDeadLetters");

export type * from "./../impl/admin/tasks";

// Values used by client code (admin task UI). Copied from the impl module so the browser bundle
// does not import server-only code; keep in sync when the error contract changes.
export const TASK_LOG_LEVELS = ["info", "warn", "error", "success"] as const;

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
