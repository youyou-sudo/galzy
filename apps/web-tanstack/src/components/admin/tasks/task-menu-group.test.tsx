// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskFilterBar } from "./task-filter-bar";
import { TaskPageHeader } from "./task-page-header";
import type { TaskEnqueueGroup, TaskFiltersView } from "./types";

/**
 * Base UI 的 Menu.GroupLabel 必须包在 Menu.Group（或 RadioGroup）里，
 * 否则打开菜单时直接抛 "MenuGroupContext is missing" —— 这是纯运行时错误，
 * 类型检查与 lint 都发现不了。这里把「每个菜单都真的打开一次」固化成回归测试。
 *
 * 用 findBy* 而不是 getBy*：Base UI 的弹层是异步挂载（portal + 定位），
 * 同步断言会在 CI 上偶发失败。
 */

afterEach(cleanup);

const filters: TaskFiltersView = {
	status: [],
	queue: [],
	type: [],
	q: "",
	range: "all",
	overdue: false,
	retryable: false,
	sortBy: "createdAt",
	order: "desc",
	page: 1,
	pageSize: "20",
};

const queueOptions = [
	{ value: "galzy:vndb-sync", label: "VNDB 同步", count: 2 },
	{ value: "galzy:meili-index", label: "Meili 索引" },
];

const enqueueGroups: TaskEnqueueGroup[] = [
	{
		queue: "galzy:vndb-sync",
		label: "VNDB 同步",
		tasks: [{ type: "vndb-full", label: "VNDB 全量同步", priority: "P0" }],
	},
];

/** Base UI 的触发器在 pointerdown 时展开；jsdom 里补一次 click 更稳。 */
function openMenu(trigger: HTMLElement) {
	fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
	fireEvent.click(trigger);
}

function renderFilterBar() {
	render(
		<TaskFilterBar
			filters={filters}
			statusCounts={{ failed: 1 }}
			queueOptions={queueOptions}
			typeOptions={[{ value: "vndb-full", label: "VNDB 全量同步" }]}
			isFiltered={false}
			total={3}
			onPatch={vi.fn()}
			onClearAll={vi.fn()}
			chips={[]}
		/>,
	);
}

function renderHeader() {
	render(
		<TaskPageHeader
			query=""
			onQueryChange={vi.fn()}
			enqueueGroups={enqueueGroups}
			onEnqueue={vi.fn()}
			enqueuePending={false}
			queueEnabled
			isFetching={false}
			onRefresh={vi.fn()}
			refreshMs={5000}
			onRefreshChange={vi.fn()}
		/>,
	);
}

describe("任务页菜单（MenuGroupContext 回归）", () => {
	it("队列多选菜单的分组标题可正常渲染", async () => {
		renderFilterBar();
		openMenu(screen.getByRole("button", { name: /队列/ }));
		expect(await screen.findByText("VNDB 同步")).toBeTruthy();
	});

	it("时间范围菜单的分组标题可正常渲染", async () => {
		renderFilterBar();
		openMenu(screen.getByRole("button", { name: /时间/ }));
		expect(await screen.findByText("近 7 天")).toBeTruthy();
	});

	it("高级筛选气泡可正常渲染", async () => {
		renderFilterBar();
		openMenu(screen.getByRole("button", { name: /高级筛选/ }));
		expect(await screen.findByText("仅逾期")).toBeTruthy();
	});

	it("自动刷新菜单的分组标题可正常渲染", async () => {
		renderHeader();
		openMenu(screen.getByRole("button", { name: /刷新间隔/ }));
		expect(await screen.findByText("暂停刷新")).toBeTruthy();
	});

	it("手动触发菜单按队列分组且可用", async () => {
		renderHeader();
		openMenu(screen.getByRole("button", { name: /手动触发/ }));
		expect(await screen.findByText("VNDB 全量同步")).toBeTruthy();
	});
});
