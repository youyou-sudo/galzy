// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeChart, makeEmptyChart } from "./chart-fixtures";
import { OrderView } from "./order-view";

const chart = makeChart();

// vitest 配了 globals:false，Testing Library 不会自动清理；不手动清就会跨用例累积 DOM
afterEach(cleanup);

describe("OrderView", () => {
	it("五种 step_type、段落锚点、选项数都渲染出来", () => {
		const { container } = render(
			<OrderView characterKey="c1" chart={chart} lang="both" />,
		);

		for (const type of ["heading", "choice", "save", "action", "note"]) {
			expect(
				container.querySelectorAll(`[data-step-type="${type}"]`).length,
			).toBeGreaterThan(0);
		}
		// 壳的段落导航与流程图回跳都靠这个稳定 id
		expect(container.querySelector("#wt-seg-seg1")).not.toBeNull();
		// heading / save / note 不占号：seg1 是 3 个 choice + 1 个 action
		expect(screen.getByText("4 个选项")).toBeDefined();
	});

	it("卡片头按 from_node 三态写起点短语", () => {
		render(<OrderView characterKey="c1" chart={chart} lang="both" />);

		// entry：从【START】开始（seg1 与 seg5 都是这个起点）
		expect(screen.getAllByText("从【START】开始").length).toBeGreaterThan(0);
		// save：读取「◆存档05」
		expect(screen.getByText("读取「◆存档05」")).toBeDefined();
		// ending：接在「芳乃END」之后
		expect(screen.getByText("接在「芳乃END」之后")).toBeDefined();
	});

	it("卡片尾按 to_node 给终点：结局名 + 徽章 / 回收结束", () => {
		const { container } = render(
			<OrderView characterKey="c1" chart={chart} lang="both" />,
		);

		const endingEnd = container.querySelector('[data-segment-end="ending"]');
		expect(endingEnd?.textContent).toContain("芳乃END");
		// 实测只给 heroine/after/bad 画徽章
		expect(screen.getByText("个人线")).toBeDefined();
		expect(screen.getByText("后日谈")).toBeDefined();
		expect(
			container.querySelector('[data-segment-end="collect"]')?.textContent,
		).toContain("回收 CG / 场景后结束");
	});

	it("后果标签与成就小标", () => {
		render(<OrderView characterKey="c1" chart={chart} lang="both" />);
		expect(screen.getByText("副+1")).toBeDefined();
		expect(screen.getByText("成就")).toBeDefined();
	});

	it("备选选项写成「差分 CG 回收时改选 → …」，备选不编号", () => {
		const { container } = render(
			<OrderView characterKey="c1" chart={chart} lang="both" />,
		);
		expect(screen.getByText("差分 CG 回收时改选")).toBeDefined();
		const row = container.querySelector("[data-alternative-index]");
		expect(row?.textContent).toContain("蒙混过去");
		expect(row?.textContent).toContain("（誤魔化す）");
		expect(row?.querySelector("span.tabular-nums")).toBeNull();
	});

	it("存档标记：段内写「在这里存档」", () => {
		render(<OrderView characterKey="c1" chart={chart} lang="both" />);
		expect(screen.getByText("在这里存档：")).toBeDefined();
		expect(screen.getByText("「◆存档01」")).toBeDefined();
	});

	it("前置提示条：condition 为主，requires_ending_keys 作补充", () => {
		render(<OrderView characterKey="c1" chart={chart} lang="both" />);
		expect(screen.getByText("※芳乃线通关后")).toBeDefined();
		expect(screen.getByText("需先达成：芳乃END")).toBeDefined();
	});

	it("双语 both：中文主文 + 括注原文", () => {
		const { container } = render(
			<OrderView characterKey="c1" chart={chart} lang="both" />,
		);
		expect(screen.getByText("老实说")).toBeDefined();
		expect(screen.getByText("（正直に言う）")).toBeDefined();
		// 没有中文译文的结局不出现空括注
		expect(container.textContent ?? "").not.toContain("（）");
	});

	it("双语 source：只显示原文", () => {
		const { container } = render(
			<OrderView characterKey="c1" chart={chart} lang="source" />,
		);
		expect(container.textContent ?? "").toContain("正直に言う");
		expect(container.textContent ?? "").not.toContain("老实说");
		expect(container.textContent ?? "").not.toContain("（正直に言う）");
	});

	it("双语 zh：只显示中文", () => {
		const { container } = render(
			<OrderView characterKey="c1" chart={chart} lang="zh" />,
		);
		expect(container.textContent ?? "").toContain("老实说");
		expect(container.textContent ?? "").not.toContain("正直に言う");
	});

	it("按角色过滤：只留该角色段落与全线共用段", () => {
		const { container } = render(
			<OrderView characterKey="c2" chart={chart} lang="both" />,
		);
		expect(container.textContent ?? "").not.toContain("老实说");
		expect(container.textContent ?? "").toContain("有点担心");
		expect(container.textContent ?? "").toContain("从【START】开始");
	});

	it("空 chart 给空态", () => {
		render(<OrderView chart={makeEmptyChart()} />);
		expect(screen.getByText("这份攻略还没有选项数据")).toBeDefined();
	});
});
