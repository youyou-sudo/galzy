import type { StatusTone } from "@web/components/admin/admin-table";
import type { TaskStatus } from "./params";

/**
 * 任务队列的中文文案单一来源。
 *
 * 这些字典原先散落在旧任务页（`components/admin/tasks-page.tsx`，已删除）里，
 * 重构后由本模块集中维护（**不要**反向 import 页面组件，否则页面与状态层
 * 互相依赖、测试也会被拖进 JSX/UI 依赖）。
 *
 * tone 与 `StatusTone`（components/admin/admin-table.tsx）保持同一套语义色，
 * 这里只用 type-only import，不产生运行时依赖。
 */

/** 状态中文名。 */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
	queued: "排队中",
	running: "运行中",
	completed: "已完成",
	failed: "失败",
	"dead-letter": "死信",
	interrupted: "已中断",
};

/** 状态色调（StatusPill 的 tone）。 */
export const TASK_STATUS_TONE: Record<TaskStatus, StatusTone> = {
	queued: "neutral",
	running: "info",
	completed: "success",
	failed: "destructive",
	"dead-letter": "warning",
	interrupted: "warning",
};

/**
 * 终态集合：进入终态的任务不会再被 SLA 判逾期，也不能再重试。
 * （dead-letter / interrupted 与后端 service 的判定保持一致。）
 */
export const TERMINAL_STATUSES: ReadonlySet<TaskStatus> = new Set([
	"completed",
	"failed",
	"dead-letter",
	"interrupted",
]);

/** 队列中文名。 */
export const QUEUE_LABELS: Record<string, string> = {
	"galzy:vndb-sync": "VNDB 同步",
	"galzy:kungal-sync": "Kungal 同步",
	"galzy:meili-index": "Meili 索引",
	"galzy:cloudreve-sync": "Cloudreve 同步",
	"galzy:metrics": "指标/清理",
};

/** 任务类型中文名。 */
export const TASK_TYPE_LABELS: Record<string, string> = {
	"vndb-full": "VNDB 全量同步",
	"vndb-delta": "VNDB 增量同步",
	"vndb-producers": "开发者同步",
	"kungal-full": "Kungal 全量同步",
	"kungal-delta": "Kungal 增量同步",
	"meili-game": "游戏索引重建",
	"meili-tag": "标签索引重建",
	"meili-producer": "厂商索引重建",
	"cloudreve-sync": "Cloudreve 文件同步",
	"queue-log-prune": "队列日志清理",
};

/** 状态 → 中文名（未知状态原样回显，便于暴露后端新增值）。 */
export function statusLabel(status: string | null | undefined): string {
	if (!status) return "未知状态";
	return TASK_STATUS_LABELS[status as TaskStatus] ?? status;
}

/** 队列 → 中文名（未知队列原样回显）。 */
export function queueLabel(queue: string | null | undefined): string {
	if (!queue) return "-";
	return QUEUE_LABELS[queue] ?? queue;
}

/** 任务类型 → 中文名（未知类型原样回显）。 */
export function taskTypeLabel(type: string | null | undefined): string {
	if (!type) return "未知任务";
	return TASK_TYPE_LABELS[type] ?? type;
}

/** 是否终态。 */
export function isTerminalStatus(status: string): boolean {
	return TERMINAL_STATUSES.has(status as TaskStatus);
}

/** 是否可重试（失败 / 中断 / 死信）。 */
export function isRetryableStatus(status: string): boolean {
	return (
		status === "failed" || status === "dead-letter" || status === "interrupted"
	);
}
