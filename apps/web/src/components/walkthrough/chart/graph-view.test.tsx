// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeChart, makeEmptyChart } from "./chart-fixtures";
import { GraphView } from "./graph-view";

const chart = makeChart();

// vitest 配了 globals:false，Testing Library 不会自动清理；不手动清就会跨用例累积 DOM
afterEach(cleanup);

describe("GraphView", () => {
	it("节点去重：同一节点在多段里只画一个，边 = 段落", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);

		// 5 段涉及 8 个去重节点
		expect(container.querySelectorAll("[data-node-id]").length).toBe(8);
		// 芳乃END 既是 seg1 终点又是 seg2 起点，只出现一次
		expect(
			container.querySelectorAll('[data-node-id="ending:e1"]').length,
		).toBe(1);
		expect(container.querySelectorAll("[data-edge-key]").length).toBe(5);
	});

	it("按角色过滤：只留该角色路径 + 共用起点", () => {
		const { container } = render(
			<GraphView characterKey="c1" chart={chart} lang="both" />,
		);
		expect(container.querySelectorAll("[data-node-id]").length).toBe(5);
		expect(container.querySelector('[data-node-id="ending:e4"]')).toBeNull();
		expect(container.querySelector('[data-node-id="save:sv01"]')).toBeNull();
	});

	it("超大图兜底：节点数超过上限只提示选角色", () => {
		render(<GraphView chart={chart} lang="both" maxNodes={4} />);
		expect(screen.getByText("流程图过大，请选择角色查看")).toBeDefined();
		expect(screen.queryByText("4 个选项")).toBeNull();
	});

	it("hover 节点时压暗无关连线", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);
		const entry = container.querySelector('[data-node-id="entry:en1"]');
		expect(entry).not.toBeNull();
		// React 用 mouseover/mouseout 推导 onMouseEnter，测试里也走 mouseOver
		fireEvent.mouseOver(entry as Element);
		expect(
			container.querySelector('[data-edge-key="seg1"]')?.getAttribute("class"),
		).toContain("opacity-100");
		expect(
			container.querySelector('[data-edge-key="seg4"]')?.getAttribute("class"),
		).toContain("opacity-25");
	});

	it("点节点回调它出发的段落", () => {
		const onSegmentSelect = vi.fn();
		const { container } = render(
			<GraphView chart={chart} lang="both" onSegmentSelect={onSegmentSelect} />,
		);
		const entry = container.querySelector('[data-node-id="entry:en1"]');
		expect(entry).not.toBeNull();
		fireEvent.click(entry as Element);
		expect(onSegmentSelect).toHaveBeenCalledWith("seg1");
	});

	it("点边回调该段落（看这一段要选什么）", () => {
		const onSegmentSelect = vi.fn();
		const { container } = render(
			<GraphView chart={chart} lang="both" onSegmentSelect={onSegmentSelect} />,
		);
		const edge = container.querySelector('[data-edge-key="seg4"]');
		expect(edge).not.toBeNull();
		fireEvent.click(edge as Element);
		expect(onSegmentSelect).toHaveBeenCalledWith("seg4");
	});

	it("边标签写选项数", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);
		expect(container.textContent ?? "").toContain("4 个选项");
	});

	it("空 chart 给空态", () => {
		render(<GraphView chart={makeEmptyChart()} />);
		expect(screen.getByText("这份攻略还没有选项数据")).toBeDefined();
	});
});
