import { isTerminalStatus } from "./labels";
import type { TaskStatus } from "./params";

/**
 * 任务 SLA（超时/停滞）判定 —— 纯函数，不依赖 React / Date.now 隐式调用。
 *
 * 为什么需要它：后端没有「截止时间」这一列时，任务页只能看到 startedAt，
 * 运行 3 小时的 meili 重建和运行 3 秒的清理看起来一样。这里用「任务类型
 * 的预期耗时」推导一个软截止时间，供列表行染色、筛选（overdue）和详情
 * 抽屉提示使用。
 *
 * 状态机（优先级从高到低）：
 * 1. 终态（completed / failed / dead-letter / interrupted）→ normal，
 *    终态永不逾期（历史失败任务不应永远标红）；
 * 2. 运行中且已超过 2 × SLA → stalled（大概率卡死，比 overdue 更准确）；
 * 3. 已过截止时间 → overdue；
 * 4. 距截止 ≤ 5 分钟 → due-soon；
 * 5. 其余 → normal。
 */

export type SlaState = "normal" | "due-soon" | "overdue" | "stalled";

/**
 * 各类任务的预期耗时（分钟）。未知类型回落到 DEFAULT_SLA_MINUTES。
 * 与后端队列的 enqueue 预设保持同源，新增任务类型时记得补这里。
 */
export const SLA_MINUTES: Record<string, number> = {
	"vndb-full": 120,
	"kungal-full": 120,
	"vndb-delta": 30,
	"kungal-delta": 30,
	"vndb-producers": 60,
	"meili-game": 60,
	"meili-tag": 60,
	"meili-producer": 60,
	"cloudreve-sync": 30,
	"queue-log-prune": 30,
};

export const DEFAULT_SLA_MINUTES = 30;

/** 排队超过这个时长还没被 worker 取走，就视为「快逾期」。 */
export const QUEUED_DUE_MINUTES = 10;

/** 距截止时间小于该值时展示 due-soon。 */
export const DUE_SOON_MINUTES = 5;

/** 运行时长超过 SLA 的这个倍数视为 stalled。 */
export const STALLED_FACTOR = 2;

const MINUTE_MS = 60 * 1000;

/** SLA 判定只需要这些字段，避免 lib 反向依赖 server 类型。 */
export type SlaTaskRow = {
	status: TaskStatus;
	type: string;
	createdAt: string;
	startedAt?: string | null;
	/** 后端未来若提供显式截止时间，优先使用。 */
	dueAt?: string | null;
};

/** 宽松解析时间；无效值返回 null（不抛错，列表渲染不能因脏数据中断）。 */
function toTime(value: string | null | undefined): number | null {
	if (!value) return null;
	const time = new Date(value).getTime();
	return Number.isFinite(time) ? time : null;
}

/** 任务类型的 SLA 分钟数。 */
export function slaMinutesFor(type: string): number {
	return SLA_MINUTES[type] ?? DEFAULT_SLA_MINUTES;
}

/**
 * 推导截止时间（毫秒时间戳）。
 * - 终态 → null（永不逾期）
 * - 有显式 dueAt → 用它
 * - queued → createdAt + 10 分钟（等 worker 的容忍时间）
 * - 其余非终态 → startedAt（缺失时退回 createdAt）+ 类型 SLA
 */
export function slaDueAt(row: SlaTaskRow): number | null {
	if (isTerminalStatus(row.status)) return null;

	const explicit = toTime(row.dueAt);
	if (explicit !== null) return explicit;

	if (row.status === "queued") {
		const createdAt = toTime(row.createdAt);
		return createdAt === null
			? null
			: createdAt + QUEUED_DUE_MINUTES * MINUTE_MS;
	}

	const anchor = toTime(row.startedAt) ?? toTime(row.createdAt);
	if (anchor === null) return null;
	return anchor + slaMinutesFor(row.type) * MINUTE_MS;
}

/**
 * 距离截止还剩多少毫秒（负数 = 已超时多少毫秒）。
 * 终态或无法推导截止时间时返回 null。
 */
export function overdueMsFor(
	row: SlaTaskRow,
	now: Date | number = new Date(),
): number | null {
	const due = slaDueAt(row);
	if (due === null) return null;
	const current = typeof now === "number" ? now : now.getTime();
	return due - current;
}

/** 毫秒差 → 中文短文案（SLA 列与详情提示共用）。 */
function formatGap(ms: number): string {
	const minutes = Math.round(ms / MINUTE_MS);
	if (minutes < 1) return "不到 1 分钟";
	if (minutes < 60) return `${minutes} 分钟`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (rest === 0) return `${hours} 小时`;
	if (hours < 24) return `${hours} 小时 ${rest} 分钟`;
	const days = Math.floor(hours / 24);
	return `${days} 天`;
}

/**
 * 截止时间的人类可读提示：未超时为「剩余 X」，已超时为「已超时 X」。
 * 终态或无法推导截止时间时返回 null。
 */
export function overdueFor(
	row: SlaTaskRow,
	now: Date | number = new Date(),
): string | null {
	const remaining = overdueMsFor(row, now);
	if (remaining === null) return null;
	return remaining >= 0
		? `剩余 ${formatGap(remaining)}`
		: `已超时 ${formatGap(-remaining)}`;
}

/** 判定 SLA 状态。 */
export function slaState(
	row: SlaTaskRow,
	now: Date | number = new Date(),
): SlaState {
	if (isTerminalStatus(row.status)) return "normal";

	const current = typeof now === "number" ? now : now.getTime();
	const due = slaDueAt(row);
	const startedAt = toTime(row.startedAt);

	// stalled 只对「运行中」有意义：超时但仍在跑，通常是 worker 卡死
	if (
		row.status === "running" &&
		startedAt !== null &&
		current - startedAt > slaMinutesFor(row.type) * STALLED_FACTOR * MINUTE_MS
	) {
		return "stalled";
	}

	if (due === null) return "normal";
	if (current > due) return "overdue";
	if (due - current <= DUE_SOON_MINUTES * MINUTE_MS) return "due-soon";
	return "normal";
}

/** 行级样式：只染色，不改变布局（表格行与移动卡片共用）。 */
export function slaRowClass(state: SlaState): string {
	switch (state) {
		case "due-soon":
			return "bg-warning/5";
		case "overdue":
			return "bg-destructive/5";
		case "stalled":
			return "bg-warning/10";
		default:
			return "";
	}
}

/** SLA 状态中文名（详情抽屉 / Tooltip 用）。 */
export function slaLabel(state: SlaState): string {
	switch (state) {
		case "due-soon":
			return "即将超时";
		case "overdue":
			return "已超时";
		case "stalled":
			return "疑似卡死";
		default:
			return "正常";
	}
}
