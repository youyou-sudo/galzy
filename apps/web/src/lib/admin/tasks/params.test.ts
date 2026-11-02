import { describe, expect, it } from "vitest";
import {
	DEFAULT_TASK_LIST_FILTERS,
	rangeToDateRange,
	TASK_SEARCH_DEFAULTS,
	taskSearchSchema,
	toTaskListFilters,
} from "./params";

/** 模拟 TanStack Router 校验后的 search 对象（默认值已注入）。 */
function parse(input: Record<string, unknown>) {
	return taskSearchSchema.parse(input);
}

describe("taskSearchSchema", () => {
	it("空对象补齐全部默认值", () => {
		expect(parse({})).toEqual(TASK_SEARCH_DEFAULTS);
		expect(TASK_SEARCH_DEFAULTS.pageSize).toBe("20");
	});

	it("URL 里的数字与字符串两种形态都能校验", () => {
		// TanStack Router 的 qss 解析器会把 ?page=2 变成数字 2
		expect(parse({ page: 2, pageSize: 50 }).page).toBe(2);
		expect(parse({ page: "2", pageSize: "50" }).pageSize).toBe("50");
		expect(parse({ page: 0 }).page).toBe(1);
		expect(parse({ page: -3 }).page).toBe(1);
		expect(parse({ page: 1.5 }).page).toBe(1);
	});

	it("标量与数组都能收敛成数组", () => {
		expect(parse({ status: "failed" }).status).toEqual(["failed"]);
		expect(parse({ status: ["failed", "running"] }).status).toEqual([
			"failed",
			"running",
		]);
		expect(parse({ queue: "galzy:vndb-sync" }).queue).toEqual([
			"galzy:vndb-sync",
		]);
		expect(parse({ type: ["vndb-full", "vndb-delta"] }).type).toEqual([
			"vndb-full",
			"vndb-delta",
		]);
	});

	it("非法枚举值逐项丢弃而不是整页报错", () => {
		expect(parse({ status: ["nope", "failed", 42] }).status).toEqual([
			"failed",
		]);
		expect(parse({ pageSize: 33 }).pageSize).toBe("20");
		expect(parse({ sortBy: "bogus" }).sortBy).toBe("createdAt");
		expect(parse({ order: "up" }).order).toBe("desc");
		expect(parse({ range: "year" }).range).toBe("all");
	});

	it("缺省值和非法值同时存在时走默认值", () => {
		const search = parse({ q: 123, pageSize: "999", page: "abc" });
		expect(search.q).toBe("");
		expect(search.pageSize).toBe("20");
		expect(search.page).toBe(1);
	});
});

describe("toTaskListFilters", () => {
	it("默认筛选：不带可选键、pageIndex 0 基", () => {
		expect(toTaskListFilters(parse({}))).toEqual({
			sort: "createdAt",
			order: "desc",
			pageIndex: 0,
			pageSize: 20,
		});
	});

	it("数组排序 + 去重，保证 queryKey 稳定", () => {
		const filters = toTaskListFilters(
			parse({
				status: ["failed", "queued", "failed"],
				queue: ["b", "a"],
				type: ["t2", "t1", "t1"],
			}),
		);
		expect(filters.statuses).toEqual(["failed", "queued"]);
		expect(filters.queues).toEqual(["a", "b"]);
		expect(filters.types).toEqual(["t1", "t2"]);
	});

	it("q 去掉首尾空白，空白 q 不写入 filters", () => {
		expect(toTaskListFilters(parse({ q: "  vndb  " })).q).toBe("vndb");
		expect(toTaskListFilters(parse({ q: "   " }))).not.toHaveProperty("q");
	});

	it("page → pageIndex，pageSize 字符串 → 数字", () => {
		const filters = toTaskListFilters(parse({ page: 3, pageSize: "100" }));
		expect(filters.pageIndex).toBe(2);
		expect(filters.pageSize).toBe(100);
	});

	it("布尔筛选只保留 true", () => {
		expect(toTaskListFilters(parse({ overdue: true })).overdue).toBe(true);
		expect(toTaskListFilters(parse({ overdue: false }))).not.toHaveProperty(
			"overdue",
		);
		expect(toTaskListFilters(parse({ retryable: true })).retryable).toBe(true);
	});
});

describe("时间范围 → 绝对时间", () => {
	// 2026-03-15 10:30 UTC = 东八区 18:30（周日）
	const now = new Date("2026-03-15T10:30:00.000Z");

	it("today 覆盖东八区当天（半开区间）", () => {
		expect(rangeToDateRange("today", now)).toEqual({
			dateFrom: "2026-03-14T16:00:00.000Z",
			dateTo: "2026-03-15T16:00:00.000Z",
		});
	});

	it("7d / 30d 以东八区自然日零点为锚点", () => {
		expect(rangeToDateRange("7d", now).dateFrom).toBe(
			"2026-03-08T16:00:00.000Z",
		);
		expect(rangeToDateRange("30d", now).dateFrom).toBe(
			"2026-02-13T16:00:00.000Z",
		);
		expect(rangeToDateRange("30d", now).dateTo).toBe(
			"2026-03-15T16:00:00.000Z",
		);
	});

	it("all 不产生时间条件", () => {
		expect(toTaskListFilters(parse({ range: "all" }), now)).not.toHaveProperty(
			"dateFrom",
		);
		expect(toTaskListFilters(parse({ range: "today" }), now).dateFrom).toBe(
			"2026-03-14T16:00:00.000Z",
		);
	});

	it("同一天内不同时刻得到相同 filters（预取/缓存不被打散）", () => {
		// 02:00Z = 10:00、15:00Z = 23:00（东八区），属于同一天
		const morning = toTaskListFilters(
			parse({ range: "7d" }),
			new Date("2026-03-15T02:00:00.000Z"),
		);
		const evening = toTaskListFilters(
			parse({ range: "7d" }),
			new Date("2026-03-15T15:00:00.000Z"),
		);
		expect(morning).toEqual(evening);
	});

	it("默认筛选常量与 schema 默认值同源", () => {
		expect(DEFAULT_TASK_LIST_FILTERS).toEqual(toTaskListFilters(parse({})));
	});
});
