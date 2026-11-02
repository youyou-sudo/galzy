import { describe, expect, it } from "vitest";
import {
	DEFAULT_SLA_MINUTES,
	overdueFor,
	overdueMsFor,
	QUEUED_DUE_MINUTES,
	SLA_MINUTES,
	type SlaTaskRow,
	slaDueAt,
	slaLabel,
	slaRowClass,
	slaState,
} from "./sla";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const MINUTE = 60 * 1000;

function minutesAgo(minutes: number): string {
	return new Date(NOW.getTime() - minutes * MINUTE).toISOString();
}

function minutesLater(minutes: number): string {
	return new Date(NOW.getTime() + minutes * MINUTE).toISOString();
}

function row(overrides: Partial<SlaTaskRow> = {}): SlaTaskRow {
	return {
		status: "running",
		type: "vndb-delta",
		createdAt: minutesAgo(5),
		startedAt: minutesAgo(1),
		...overrides,
	};
}

describe("slaState 四种状态", () => {
	it("fresh 任务为 normal", () => {
		expect(
			slaState(row({ status: "queued", createdAt: minutesAgo(1) }), NOW),
		).toBe("normal");
		expect(slaState(row({ startedAt: minutesAgo(5) }), NOW)).toBe("normal");
	});

	it("排队 6 分钟（截止 10 分钟）→ due-soon", () => {
		expect(
			slaState(row({ status: "queued", createdAt: minutesAgo(6) }), NOW),
		).toBe("due-soon");
	});

	it("排队 11 分钟 → overdue", () => {
		expect(
			slaState(row({ status: "queued", createdAt: minutesAgo(11) }), NOW),
		).toBe("overdue");
	});

	it("运行中超过 2×SLA → stalled（优先于 overdue）", () => {
		const stalled = row({
			startedAt: minutesAgo(SLA_MINUTES["vndb-delta"] * 2 + 1),
		});
		expect(slaState(stalled, NOW)).toBe("stalled");
	});

	it("运行中超过 SLA 但不到 2×SLA → overdue", () => {
		const overdue = row({
			startedAt: minutesAgo(SLA_MINUTES["vndb-delta"] + 1),
		});
		expect(slaState(overdue, NOW)).toBe("overdue");
	});

	it("有显式 dueAt 时优先使用 dueAt", () => {
		expect(slaState(row({ dueAt: minutesLater(2) }), NOW)).toBe("due-soon");
		expect(slaState(row({ dueAt: minutesAgo(1) }), NOW)).toBe("overdue");
	});

	it("未知类型回落到默认 SLA", () => {
		const unknownType = row({
			type: "brand-new-task",
			startedAt: minutesAgo(DEFAULT_SLA_MINUTES + 1),
		});
		expect(slaState(unknownType, NOW)).toBe("overdue");
	});

	it("非法时间串不抛错，按 normal 处理", () => {
		expect(
			slaState(row({ status: "queued", createdAt: "not-a-date" }), NOW),
		).toBe("normal");
	});
});

describe("终态永不逾期", () => {
	const terminal = [
		"completed",
		"failed",
		"dead-letter",
		"interrupted",
	] as const;

	it.each(terminal)("%s 即使时间很旧也是 normal", (status) => {
		const old = row({
			status,
			createdAt: minutesAgo(60 * 24),
			startedAt: minutesAgo(60 * 24),
			dueAt: minutesAgo(60 * 24),
		});
		expect(slaState(old, NOW)).toBe("normal");
		expect(slaDueAt(old)).toBeNull();
		expect(overdueFor(old, NOW)).toBeNull();
		expect(overdueMsFor(old, NOW)).toBeNull();
	});
});

describe("overdueFor / overdueMsFor", () => {
	it("overdueMsFor 返回剩余毫秒（负数为已超时）", () => {
		// queued：createdAt + 10 分钟
		const queued = row({ status: "queued", createdAt: minutesAgo(4) });
		expect(overdueMsFor(queued, NOW)).toBe(6 * MINUTE);

		const late = row({ status: "queued", createdAt: minutesAgo(11) });
		expect(overdueMsFor(late, NOW)).toBe(-1 * MINUTE);
	});

	it("overdueFor 输出中文短文案", () => {
		const queued = row({ status: "queued", createdAt: minutesAgo(4) });
		expect(overdueFor(queued, NOW)).toBe("剩余 6 分钟");

		const late = row({ status: "queued", createdAt: minutesAgo(11) });
		expect(overdueFor(late, NOW)).toBe("已超时 1 分钟");
	});

	it("接受毫秒时间戳", () => {
		const queued = row({ status: "queued", createdAt: minutesAgo(4) });
		expect(overdueMsFor(queued, NOW.getTime())).toBe(
			QUEUED_DUE_MINUTES * MINUTE - 4 * MINUTE,
		);
	});
});

describe("样式与文案", () => {
	it("slaRowClass 只对异常状态染色", () => {
		expect(slaRowClass("normal")).toBe("");
		expect(slaRowClass("due-soon")).not.toBe("");
		expect(slaRowClass("overdue")).not.toBe("");
		expect(slaRowClass("stalled")).not.toBe("");
	});

	it("slaLabel 覆盖四种状态", () => {
		expect(slaLabel("normal")).toBe("正常");
		expect(slaLabel("due-soon")).toBe("即将超时");
		expect(slaLabel("overdue")).toBe("已超时");
		expect(slaLabel("stalled")).toBe("疑似卡死");
	});
});
