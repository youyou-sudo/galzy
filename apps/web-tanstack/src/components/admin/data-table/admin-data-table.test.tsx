// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminDataTable } from "./data-table";
import type { AdminColumn } from "./types";

type Row = { id: string; name: string; status: string };

const rows: Row[] = [
	{ id: "a", name: "任务甲", status: "running" },
	{ id: "b", name: "任务乙", status: "completed" },
];

const columns: AdminColumn<Row>[] = [
	{ id: "name", header: "名称", cell: (row) => row.name, mobile: "title" },
	{ id: "status", header: "状态", cell: (row) => row.status },
];

afterEach(() => {
	cleanup();
});

describe("AdminDataTable", () => {
	it("按列定义渲染表头与单元格", () => {
		render(
			<AdminDataTable
				columns={columns}
				rows={rows}
				getRowId={(row) => row.id}
				empty={{ title: "空" }}
			/>,
		);
		expect(
			screen.getAllByRole("columnheader").map((th) => th.textContent),
		).toEqual(["名称", "状态"]);
		expect(screen.getAllByText("任务甲").length).toBeGreaterThan(0);
		expect(screen.getAllByText("completed").length).toBeGreaterThan(0);
	});

	it("空列表渲染空态而不是空表格", () => {
		render(
			<AdminDataTable
				columns={columns}
				rows={[]}
				getRowId={(row) => row.id}
				empty={{ title: "暂无任务记录", description: "手动触发一个任务" }}
			/>,
		);
		expect(screen.getAllByText("暂无任务记录").length).toBeGreaterThan(0);
	});

	it("首屏加载渲染骨架行，不渲染空态", () => {
		render(
			<AdminDataTable
				columns={columns}
				rows={[]}
				getRowId={(row) => row.id}
				isLoading
				skeletonRows={3}
				empty={{ title: "暂无任务记录" }}
			/>,
		);
		expect(screen.queryByText("暂无任务记录")).toBeNull();
		expect(document.querySelectorAll("tbody tr").length).toBe(3);
	});

	it("行选择回调带上完整 id 集合", () => {
		const onSelectedIdsChange = vi.fn();
		render(
			<AdminDataTable
				columns={columns}
				rows={rows}
				getRowId={(row) => row.id}
				selectedIds={new Set(["a"])}
				onSelectedIdsChange={onSelectedIdsChange}
				empty={{ title: "空" }}
			/>,
		);
		const checkboxes = screen.getAllByRole("checkbox");
		// [0] 是全选，[1] 是行 a，[2] 是行 b
		fireEvent.click(checkboxes[2]);
		const next = onSelectedIdsChange.mock.calls[0][0] as Set<string>;
		expect([...next].sort()).toEqual(["a", "b"]);
	});

	it("移动端卡片用 mobile=title 的列做主标题", () => {
		render(
			<AdminDataTable
				columns={columns}
				rows={rows}
				getRowId={(row) => row.id}
				empty={{ title: "空" }}
			/>,
		);
		const list = document.querySelector("ul");
		expect(list?.textContent).toContain("任务甲");
	});
});
