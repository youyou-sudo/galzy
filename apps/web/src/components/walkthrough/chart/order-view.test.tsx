// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeChart, makeEmptyChart } from "./chart-fixtures";
import { OrderView } from "./order-view";

const chart = makeChart();
const characters = [
	{ key: "c1", name: "朝武 芳乃" },
	{ key: "c2", name: "常陸 茉子" },
];

// vitest 配了 globals:false，Testing Library 不会自动清理；不手动清就会跨用例累积 DOM
afterEach(cleanup);

describe("OrderView（按顺序：折叠清单 + 本地进度）", () => {
	it("列出整份攻略的每一段（不按角色过滤）", () => {
		const { container } = render(
			<OrderView chart={chart} characters={characters} />,
		);
		// fixture 有 5 段，两个角色都有；顺序视图全部列出
		expect(container.querySelectorAll("[data-order-segment]").length).toBe(5);
		expect(container.textContent ?? "").toContain("START");
		expect(container.textContent ?? "").toContain("芳乃END");
		// 选项数与角色标签在副行
		expect(container.textContent ?? "").toContain("4 个选项");
		expect(container.textContent ?? "").toContain("朝武 芳乃");
		expect(container.textContent ?? "").toContain("常陸 茉子");
	});

	it("默认收起：段内步骤不出现在 DOM 里", () => {
		const { container } = render(<OrderView chart={chart} />);
		expect(container.querySelectorAll("[data-step-type]").length).toBe(0);
		expect(container.textContent ?? "").not.toContain("老实说");
	});

	it("点行展开这一段、再点收起", () => {
		const { container } = render(<OrderView chart={chart} />);
		const row = container.querySelector('[data-order-segment="seg1"]');
		expect(row).not.toBeNull();
		const toggle = row?.querySelector("button[aria-expanded]");
		fireEvent.click(toggle as Element);
		expect(container.textContent ?? "").toContain("老实说");
		expect(container.querySelectorAll("[data-step-type]").length).toBeGreaterThan(
			0,
		);
		fireEvent.click(toggle as Element);
		expect(container.textContent ?? "").not.toContain("老实说");
	});

	it("勾选完成写本地进度，进度条与计数跟着变", () => {
		window.localStorage.clear();
		const { container } = render(
			<OrderView chart={chart} storageKey="test-wt" />,
		);
		expect(container.textContent ?? "").toContain("已完成 0 / 5 段");
		const check = container.querySelector(
			'[data-order-segment="seg1"] button[aria-label="标记为已完成"]',
		);
		expect(check).not.toBeNull();
		fireEvent.click(check as Element);
		expect(container.textContent ?? "").toContain("已完成 1 / 5 段");
		// 写进 localStorage，刷新后还能读回来
		const saved = window.localStorage.getItem(
			"galzy:walkthrough-progress:test-wt",
		);
		expect(saved).toContain("seg1");
	});

	it("有前置条件的段给提示，展开后列出达成条件", () => {
		const { container } = render(<OrderView chart={chart} />);
		expect(container.textContent ?? "").toContain("有前置条件");
		const toggle = container
			.querySelector('[data-order-segment="seg2"]')
			?.querySelector("button[aria-expanded]");
		fireEvent.click(toggle as Element);
		expect(container.textContent ?? "").toContain("※芳乃线通关后");
		expect(container.textContent ?? "").toContain("需先达成：芳乃END");
	});

	it("展开后给终点块：结局名 + 类型徽章 / 回收文案", () => {
		const { container } = render(<OrderView chart={chart} />);
		const toggle = container
			.querySelector('[data-order-segment="seg1"]')
			?.querySelector("button[aria-expanded]");
		fireEvent.click(toggle as Element);
		expect(container.textContent ?? "").toContain("个人线");
	});

	it("按要求渲染角色名：没有 characters 时退回 section 标题", () => {
		render(<OrderView chart={chart} />);
		expect(screen.getAllByText(/芳乃线|茉子线/).length).toBeGreaterThan(0);
	});

	it("空 chart 给空态", () => {
		render(<OrderView chart={makeEmptyChart()} />);
		expect(screen.getByText("这份攻略还没有选项数据")).toBeDefined();
	});
});
