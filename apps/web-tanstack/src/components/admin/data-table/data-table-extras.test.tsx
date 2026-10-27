// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RefreshCwIcon } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminDataTable } from "./data-table";
import { DataTablePagination } from "./pagination";
import { RowActionsMenu } from "./row-actions";
import { DataTableToolbar } from "./toolbar";
import type { AdminColumn } from "./types";

type Row = { id: string; name: string; status: string };

const rows: Row[] = [
	{ id: "a", name: "任务甲", status: "running" },
	{ id: "b", name: "任务乙", status: "completed" },
];

const columns: AdminColumn<Row>[] = [
	{ id: "name", header: "名称", cell: (row) => row.name, sortable: true },
	{ id: "status", header: "状态", cell: (row) => row.status },
];

afterEach(() => {
	cleanup();
});

describe("AdminDataTable 新增能力", () => {
	it("visibleColumnIds 优先于 defaultHidden，只渲染集合内的列", () => {
		render(
			<AdminDataTable
				columns={[{ ...columns[0], defaultHidden: true }, columns[1]]}
				rows={rows}
				getRowId={(row) => row.id}
				visibleColumnIds={new Set(["name"])}
				empty={{ title: "空" }}
			/>,
		);
		expect(
			screen.getAllByRole("columnheader").map((th) => th.textContent),
		).toEqual(["名称"]);
	});

	it("rows 为空且有错误时渲染错误态与重试按钮", () => {
		const onRetry = vi.fn();
		render(
			<AdminDataTable
				columns={columns}
				rows={[]}
				getRowId={(row) => row.id}
				error={new Error("网关超时")}
				onRetry={onRetry}
				empty={{ title: "暂无任务" }}
			/>,
		);
		expect(screen.getAllByText("加载失败").length).toBeGreaterThan(0);
		expect(screen.getAllByText("网关超时").length).toBeGreaterThan(0);
		expect(screen.queryByText("暂无任务")).toBeNull();
		fireEvent.click(screen.getAllByRole("button", { name: /重试/ })[0]);
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("errorTitle 覆盖默认标题；无 onRetry 时不渲染按钮", () => {
		render(
			<AdminDataTable
				columns={columns}
				rows={[]}
				getRowId={(row) => row.id}
				error="接口 500"
				errorTitle="任务队列不可用"
				empty={{ title: "暂无任务" }}
			/>,
		);
		expect(screen.getAllByText("任务队列不可用").length).toBeGreaterThan(0);
		expect(screen.getAllByText("接口 500").length).toBeGreaterThan(0);
		expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
	});

	it("rows 非空时忽略 error，保留旧数据", () => {
		render(
			<AdminDataTable
				columns={columns}
				rows={rows}
				getRowId={(row) => row.id}
				error={new Error("刷新失败")}
				empty={{ title: "空" }}
			/>,
		);
		expect(screen.queryAllByText("加载失败")).toHaveLength(0);
		expect(screen.getAllByText("任务甲").length).toBeGreaterThan(0);
	});

	it("首屏加载优先于错误态", () => {
		render(
			<AdminDataTable
				columns={columns}
				rows={[]}
				getRowId={(row) => row.id}
				isLoading
				skeletonRows={2}
				error={new Error("boom")}
				empty={{ title: "空" }}
			/>,
		);
		expect(screen.queryAllByText("加载失败")).toHaveLength(0);
		expect(document.querySelectorAll("tbody tr").length).toBe(2);
	});

	it("可排序列带 aria-sort：未激活 none / 升序 / 降序", () => {
		const { rerender } = render(
			<AdminDataTable
				columns={columns}
				rows={rows}
				getRowId={(row) => row.id}
				sort={null}
				onSortChange={() => {}}
				empty={{ title: "空" }}
			/>,
		);
		const headers = () => screen.getAllByRole("columnheader");
		expect(headers()[0].getAttribute("aria-sort")).toBe("none");
		expect(headers()[1].getAttribute("aria-sort")).toBeNull();

		rerender(
			<AdminDataTable
				columns={columns}
				rows={rows}
				getRowId={(row) => row.id}
				sort={{ id: "name", desc: false }}
				onSortChange={() => {}}
				empty={{ title: "空" }}
			/>,
		);
		expect(headers()[0].getAttribute("aria-sort")).toBe("ascending");

		rerender(
			<AdminDataTable
				columns={columns}
				rows={rows}
				getRowId={(row) => row.id}
				sort={{ id: "name", desc: true }}
				onSortChange={() => {}}
				empty={{ title: "空" }}
			/>,
		);
		expect(headers()[0].getAttribute("aria-sort")).toBe("descending");
	});
});

describe("DataTablePagination 页码夹取", () => {
	it("page 越界时按最后一页渲染，不出现 0 或越界页码", () => {
		render(
			<DataTablePagination
				page={99}
				pageCount={3}
				total={45}
				onPageChange={() => {}}
			/>,
		);
		const current = screen.getByRole("button", { name: "3" });
		expect(current.getAttribute("aria-current")).toBe("page");
		expect(screen.queryByRole("button", { name: "0" })).toBeNull();
		expect(
			screen.getByRole("button", { name: "下一页" }).hasAttribute("disabled"),
		).toBe(true);
		expect(
			screen.getByRole("button", { name: "上一页" }).hasAttribute("disabled"),
		).toBe(false);
	});

	it("page 为 0 时夹到第一页", () => {
		render(
			<DataTablePagination
				page={0}
				pageCount={5}
				total={50}
				onPageChange={() => {}}
			/>,
		);
		expect(
			screen.getByRole("button", { name: "1" }).getAttribute("aria-current"),
		).toBe("page");
		expect(
			screen.getByRole("button", { name: "第一页" }).hasAttribute("disabled"),
		).toBe(true);
	});
});

describe("DataTableToolbar 筛选 chip", () => {
	it("onClear 存在时渲染独立的移除按钮并回调", () => {
		const onClear = vi.fn();
		render(
			<DataTableToolbar
				filters={[
					{
						id: "status",
						label: "状态",
						value: "running",
						onChange: () => {},
						onClear,
						options: [{ value: "running", label: "运行中" }],
					},
				]}
			/>,
		);
		const clear = screen.getByRole("button", { name: "移除筛选：状态" });
		fireEvent.click(clear);
		expect(onClear).toHaveBeenCalledTimes(1);
		// 下拉触发器仍然独立存在
		expect(
			screen.getAllByRole("button", { name: /状态/ }).length,
		).toBeGreaterThan(1);
	});

	it("removable=false 时不渲染移除按钮", () => {
		render(
			<DataTableToolbar
				filters={[
					{
						id: "status",
						label: "状态",
						value: "running",
						onChange: () => {},
						onClear: () => {},
						removable: false,
						options: [{ value: "running", label: "运行中" }],
					},
				]}
			/>,
		);
		expect(screen.queryByRole("button", { name: "移除筛选：状态" })).toBeNull();
	});

	it("高级筛选折叠入口带计数徽标，chips 行可渲染", () => {
		render(
			<DataTableToolbar
				filters={[
					{
						id: "range",
						label: "时间范围",
						group: "advanced",
						value: "today",
						onChange: () => {},
						onClear: () => {},
						options: [{ value: "today", label: "今天" }],
					},
				]}
				advanced={<div>高级筛选内容</div>}
				advancedCount={1}
				chips={<span>已生效条件</span>}
			/>,
		);
		expect(
			screen.getByRole("button", { name: /高级筛选/ }).textContent,
		).toContain("1");
		expect(screen.getByText("已生效条件")).toBeTruthy();
	});
});

describe("RowActionsMenu 高频操作", () => {
	it("primaryActions 渲染为带 aria-label 的图标按钮", () => {
		const onSelect = vi.fn();
		render(
			<RowActionsMenu
				actions={[]}
				primaryActions={[
					{
						label: "重试",
						icon: RefreshCwIcon,
						onSelect,
					},
				]}
			/>,
		);
		const button = screen.getByRole("button", { name: "重试" });
		fireEvent.click(button);
		expect(onSelect).toHaveBeenCalledTimes(1);
	});

	it("disabledReason 让主操作禁用并给出 title 说明", () => {
		render(
			<RowActionsMenu
				actions={[]}
				primaryActions={[
					{
						label: "重试",
						icon: RefreshCwIcon,
						onSelect: () => {},
						disabledReason: "终态任务不可重试",
					},
				]}
			/>,
		);
		const button = screen.getByRole("button", { name: "重试" });
		expect(button.hasAttribute("disabled")).toBe(true);
		expect(button.getAttribute("title")).toBe("终态任务不可重试");
	});
});
