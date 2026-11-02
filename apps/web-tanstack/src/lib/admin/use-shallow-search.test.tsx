// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useShallowSearch } from "./use-shallow-search";

type TaskSearch = {
	q: string;
	status: string[];
	overdue: boolean;
	page: number;
};

const DEFAULTS: TaskSearch = { q: "", status: [], overdue: false, page: 1 };

beforeEach(() => {
	window.history.replaceState(null, "", "/admin/tasks");
});

describe("useShallowSearch", () => {
	it("更新状态并只改写地址栏（replaceState，不产生历史记录）", () => {
		const { result } = renderHook(() =>
			useShallowSearch<TaskSearch>({ ...DEFAULTS }, DEFAULTS),
		);

		act(() => {
			result.current[1]({ page: 2, status: ["failed"] });
		});

		expect(result.current[0]).toMatchObject({ page: 2, status: ["failed"] });
		expect(window.location.pathname).toBe("/admin/tasks");
		const params = new URLSearchParams(window.location.search);
		expect(params.get("page")).toBe("2");
		expect(params.getAll("status")).toEqual(["failed"]);
	});

	it("回到默认值时从 URL 剥掉，地址栏保持干净", () => {
		window.history.replaceState(null, "", "/admin/tasks?page=3&q=abc");
		const { result } = renderHook(() =>
			useShallowSearch<TaskSearch>(
				{ q: "abc", status: [], overdue: false, page: 3 },
				DEFAULTS,
			),
		);

		act(() => {
			result.current[1]({ page: 1, q: "" });
		});

		expect(window.location.search).toBe("");
	});

	it("布尔与数组按 furin / TypeBox 的编码写入（重复 key）", () => {
		const { result } = renderHook(() =>
			useShallowSearch<TaskSearch>({ ...DEFAULTS }, DEFAULTS),
		);

		act(() => {
			result.current[1]({ overdue: true, status: ["queued", "running"] });
		});

		const params = new URLSearchParams(window.location.search);
		expect(params.getAll("status")).toEqual(["queued", "running"]);
		expect(params.get("overdue")).toBe("true");
	});

	it("保存 history.state（furin 的 _furinKey 不能被冲掉）", () => {
		window.history.replaceState({ _furinKey: "abc123" }, "", "/admin/tasks");
		const { result } = renderHook(() =>
			useShallowSearch<TaskSearch>({ ...DEFAULTS }, DEFAULTS),
		);

		act(() => {
			result.current[1]({ page: 2 });
		});

		expect((window.history.state as { _furinKey?: string })._furinKey).toBe(
			"abc123",
		);
	});

	it("函数式 patch 基于上一次状态合并", () => {
		const { result } = renderHook(() =>
			useShallowSearch<TaskSearch>({ ...DEFAULTS, q: "sync" }, DEFAULTS),
		);

		act(() => {
			result.current[1]((previous) => ({ page: previous.page + 1 }));
		});

		expect(result.current[0].q).toBe("sync");
		expect(result.current[0].page).toBe(2);
	});
});
