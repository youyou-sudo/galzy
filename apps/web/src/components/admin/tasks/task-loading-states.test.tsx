// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskFilterBar } from "./task-filter-bar";
import { TaskOverviewBar } from "./task-overview-bar";
import { TaskPageHeader } from "./task-page-header";
import { TaskQueueLanes } from "./task-queue-lanes";
import type { TaskEnqueueGroup, TaskFiltersView } from "./types";

/**
 * 首屏加载态回归：数据还没到时，页面必须给出「骨架 / 加载中」，而不是
 * 看起来像「0 条 / 没有队列 / 没有任务类型」的空数据。
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

function skeletonCount(container: HTMLElement) {
	return container.querySelectorAll('[data-slot="skeleton"]').length;
}

function openMenu(trigger: HTMLElement) {
	fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
	fireEvent.click(trigger);
}

describe("任务页首屏加载态", () => {
	it("概览条加载时显示骨架数字，并标记 aria-busy", () => {
		const { container } = render(
			<TaskOverviewBar
				counts={undefined}
				total={0}
				activeStatuses={[]}
				onToggle={vi.fn()}
				isLoading
			/>,
		);
		expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
		// 4 个状态指标 + 记录总数
		expect(skeletonCount(container)).toBeGreaterThanOrEqual(5);
		expect(screen.queryByText("0")).toBeNull();
	});

	it("队列泳道加载时显示摘要骨架，而不是整块消失", () => {
		const { container } = render(
			<TaskQueueLanes
				queues={[]}
				activeQueues={[]}
				onToggle={vi.fn()}
				onOpenDeadLetter={vi.fn()}
				labels={{}}
				isLoading
			/>,
		);
		expect(screen.getByText("队列概览")).toBeTruthy();
		expect(skeletonCount(container)).toBeGreaterThan(0);
	});

	it("筛选条在字典加载中时，队列菜单文案是「加载中」而不是「暂无」", async () => {
		render(
			<TaskFilterBar
				filters={filters}
				queueOptions={[]}
				typeOptions={[]}
				isFiltered={false}
				total={0}
				onPatch={vi.fn()}
				onClearAll={vi.fn()}
				chips={[]}
				optionsLoading
			/>,
		);
		openMenu(screen.getByRole("button", { name: /队列/ }));
		expect(await screen.findByText("队列加载中…")).toBeTruthy();
		expect(screen.queryByText("暂无队列")).toBeNull();
	});

	it("高级筛选在字典加载中时显示「任务类型加载中…」", async () => {
		render(
			<TaskFilterBar
				filters={filters}
				queueOptions={[]}
				typeOptions={[]}
				isFiltered={false}
				total={0}
				onPatch={vi.fn()}
				onClearAll={vi.fn()}
				chips={[]}
				optionsLoading
			/>,
		);
		openMenu(screen.getByRole("button", { name: /高级筛选/ }));
		expect(await screen.findByText("任务类型加载中…")).toBeTruthy();
	});

	it("页头的手动触发菜单在字典加载中时给出 loading 文案", async () => {
		const groups: TaskEnqueueGroup[] = [];
		render(
			<TaskPageHeader
				query=""
				onQueryChange={vi.fn()}
				enqueueGroups={groups}
				onEnqueue={vi.fn()}
				enqueuePending={false}
				metaLoading
				queueEnabled
				isFetching={false}
				onRefresh={vi.fn()}
				refreshMs={5000}
				onRefreshChange={vi.fn()}
			/>,
		);
		openMenu(screen.getByRole("button", { name: /手动触发/ }));
		expect(await screen.findByText("任务字典加载中…")).toBeTruthy();
	});
});
