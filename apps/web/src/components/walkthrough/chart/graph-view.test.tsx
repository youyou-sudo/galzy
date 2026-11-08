// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeChart, makeEmptyChart } from "./chart-fixtures";
import { GraphView } from "./graph-view";

const chart = makeChart();

// vitest 配了 globals:false，Testing Library 不会自动清理；不手动清就会跨用例累积 DOM
afterEach(cleanup);

describe("GraphView", () => {
	it("节点去重：同一节点在多条边里只画一个", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);

		// 5 段涉及 8 个去重节点
		expect(container.querySelectorAll("[data-node-id]").length).toBe(8);
		// 芳乃END 既是 seg1 终点又是 seg2 起点，只出现一次
		expect(
			container.querySelectorAll('[data-node-id="ending:e1"]').length,
		).toBe(1);
	});

	it("段落按 save 步骤切成边：存档成为图上的节点", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);

		// seg1 里有一条 save(sv01)，切成 en1→sv01 与 sv01→e1 两条边，
		// 其余 4 段各一条 = 6 条
		expect(container.querySelectorAll("[data-edge-key]").length).toBe(6);
		// 存档节点现在由切边产生（旧实现里它只作为别段起点出现）
		expect(
			container.querySelector('[data-node-id="save:sv01"]'),
		).not.toBeNull();
		// 存档 01 是 seg1 的第二条边起点，所以它下面必须还有一条通往芳乃END 的边
		expect(
			container.querySelector('[data-edge-label="seg1#1"]')?.textContent,
		).toContain("2 个选项");
	});

	it("按角色过滤：只留该角色路径的边与节点", () => {
		const { container } = render(
			<GraphView characterKey="c1" chart={chart} lang="both" />,
		);
		expect(container.querySelectorAll("[data-edge-key]").length).toBe(4);
		expect(container.querySelector('[data-node-id="ending:e4"]')).toBeNull();
		expect(
			container.querySelector('[data-node-id="entry:en1"]'),
		).not.toBeNull();
	});

	it("超大图兜底：节点数超过上限只提示选角色", () => {
		render(<GraphView chart={chart} lang="both" maxNodes={4} />);
		expect(screen.getByText("流程图过大，请选择角色查看")).toBeDefined();
		expect(screen.queryByText("2 个选项")).toBeNull();
	});

	it("hover 节点时压暗无关连线", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);
		const entry = container.querySelector('[data-node-id="entry:en1"]');
		expect(entry).not.toBeNull();
		// React 用 mouseover/mouseout 推导 onMouseEnter，测试里也走 mouseOver
		fireEvent.mouseOver(entry as Element);
		expect(
			container
				.querySelector('[data-edge-key="seg1#0"]')
				?.getAttribute("class"),
		).toContain("opacity-100");
		expect(
			container
				.querySelector('[data-edge-key="seg4#0"]')
				?.getAttribute("class"),
		).toContain("opacity-25");
	});

	it("默认面板展示第一条边的步骤（START → 存档 01）", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);
		expect(container.textContent ?? "").toContain("这一段要选的选项");
		expect(container.textContent ?? "").toContain("◆存档01");
		// 第一条边的前三步：heading + 两个 choice
		expect(container.textContent ?? "").toContain("老实说");
	});

	it("点节点把面板切到它出发的第一条边", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);
		const save = container.querySelector('[data-node-id="save:sv01"]');
		expect(save).not.toBeNull();
		fireEvent.click(save as Element);
		// sv01 出发的边是 seg1#1（通往芳乃END），步骤里含 action「钓鱼」
		expect(container.textContent ?? "").toContain("钓鱼");
	});

	it("点边切面板，「在路线列表中查看」回调该段", () => {
		const onOpenSegment = vi.fn();
		const { container } = render(
			<GraphView chart={chart} lang="both" onOpenSegment={onOpenSegment} />,
		);
		const edge = container.querySelector('[data-edge-label="seg4#0"]');
		expect(edge).not.toBeNull();
		fireEvent.click(edge as Element);
		// seg4 的步骤：ちょっと心配だ / 有点担心
		expect(container.textContent ?? "").toContain("有点担心");
		const open = container.querySelector('[data-segment-key="seg4"]');
		expect(open).not.toBeNull();
		fireEvent.click(open as Element);
		expect(onOpenSegment).toHaveBeenCalledWith("seg4");
	});

	it("边标签写选项数，没有选项的写「查看步骤」", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);
		const text = container.textContent ?? "";
		expect(text).toContain("2 个选项");
		// seg2 只有一条 note（后日谈入口），没有可选项
		expect(
			container.querySelector('[data-edge-label="seg2#0"]')?.textContent,
		).toBe("查看步骤");
	});

	it("空 chart 给空态", () => {
		render(<GraphView chart={makeEmptyChart()} />);
		expect(screen.getByText("这份攻略还没有选项数据")).toBeDefined();
	});

	// 层级图里「当前」= primary 实底 + 反白 + 柔光环；普通节点是卡底 + 发丝边
	it("选中的边：标签是 primary 实底，两端节点挂环", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);
		// 默认选中第一条边（START → 存档 01）
		const label = container.querySelector('[data-edge-label="seg1#0"]');
		expect(label?.getAttribute("data-edge-selected")).toBe("true");
		expect(label?.className).toContain("bg-primary");
		expect(label?.className).toContain("text-primary-foreground");
		expect(label?.className).toContain("ring-[3px]");
		// 未选中的边不实底
		const other = container.querySelector('[data-edge-label="seg4#0"]');
		expect(other?.getAttribute("data-edge-selected")).toBeNull();
		expect(other?.className).not.toContain("bg-primary");
		expect(other?.className).toContain("border-border/80");
		// 两端节点带选中环（浅色柔光，不是实底）
		const from = container.querySelector('[data-node-id="entry:en1"]');
		expect(from?.className).toContain("ring-primary/20");
		expect(from?.className).not.toContain("bg-primary ");
	});

	// 参考站的「N 个选项」药丸带一个列表图标
	it("选项标签带列表图标", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);
		const label = container.querySelector('[data-edge-label="seg1#0"]');
		expect(label?.querySelector("svg")).not.toBeNull();
		expect(label?.textContent ?? "").toContain("2 个选项");
	});

	// 性能：缩放/平移直接写 DOM，不经过 React state（否则每帧都要重建
	// 200 个节点 + 连线 + 标签）。这里锁死「按钮 → transform/读数」的联动。
	it("缩放按钮直接写 transform 与缩放读数", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);
		const content = container.querySelector("[data-graph-content]");
		const pct = screen.getByText("100%");
		fireEvent.click(screen.getByRole("button", { name: "放大" }));
		expect(content?.getAttribute("style") ?? "").toContain("scale(1.2)");
		expect(pct.textContent).toBe("120%");
		fireEvent.click(screen.getByRole("button", { name: "重置视图" }));
		expect(content?.getAttribute("style") ?? "").toContain("scale(1)");
		expect(pct.textContent).toBe("100%");
	});

	// 滚轮同样走命令式路径：不 setState，只改 transform / 网格背景 / 读数
	it("滚轮缩放不经过 React 渲染", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);
		const viewport = container.querySelector(
			"[data-graph-viewport]",
		) as Element;
		const content = container.querySelector("[data-graph-content]");
		fireEvent.wheel(viewport, { deltaY: -100 });
		expect(content?.getAttribute("style") ?? "").toContain("scale(1.12)");
	});

	// 用户要求「将选项放到右边」：jsdom 不算 CSS，只校验 DOM 顺序
	// （画布在前、选项在后 = 桌面端 flex-row 里选项在右）
	it("桌面端选项面板排在画布右侧", () => {
		const { container } = render(<GraphView chart={chart} lang="both" />);
		const aside = container.querySelector("[data-graph-options-aside]");
		const canvas = container.querySelector("[data-graph-canvas]");
		expect(aside).not.toBeNull();
		expect(canvas).not.toBeNull();
		expect(canvas?.nextElementSibling).toBe(aside);
	});

	describe("窄屏", () => {
		const originalWidth = window.innerWidth;

		beforeEach(() => {
			Object.defineProperty(window, "innerWidth", {
				configurable: true,
				value: 390,
			});
		});
		afterEach(() => {
			Object.defineProperty(window, "innerWidth", {
				configurable: true,
				value: originalWidth,
			});
		});

		// 内联时把选项叠在画布下方：点边就地更新，不弹层
		it("内联：点边更新画布下方面板，不弹 Modal", () => {
			const { container } = render(<GraphView chart={chart} lang="both" />);
			expect(
				container.querySelector("[data-graph-options-inline]"),
			).not.toBeNull();
			fireEvent.click(
				container.querySelector('[data-edge-label="seg4#0"]') as Element,
			);
			expect(screen.queryByRole("dialog")).toBeNull();
			expect(container.textContent ?? "").toContain("有点担心");
		});

		// 全屏里没有「画布下方」这块空间：点边改成弹底部抽屉
		it("全屏：点边弹出选项抽屉", () => {
			render(<GraphView chart={chart} fullscreen lang="both" />);
			fireEvent.click(
				screen.getByRole("button", { name: "查看步骤", hidden: false }),
			);
			const dialog = screen.getByRole("dialog");
			expect(within(dialog).getByText("这一段要选的选项")).toBeDefined();
		});

		it("全屏 + 平板宽度（800px）同样弹抽屉", () => {
			Object.defineProperty(window, "innerWidth", {
				configurable: true,
				value: 800,
			});
			render(<GraphView chart={chart} fullscreen lang="both" />);
			fireEvent.click(
				screen.getAllByRole("button", { name: /个选项|查看步骤/ })[0],
			);
			expect(screen.getByRole("dialog")).toBeDefined();
		});

		it("抽屉可关闭，画布保留", async () => {
			render(<GraphView chart={chart} fullscreen lang="both" />);
			fireEvent.click(
				screen.getAllByRole("button", { name: /个选项|查看步骤/ })[0],
			);
			fireEvent.click(screen.getByRole("button", { name: "关闭" }));
			await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
			expect(screen.queryByRole("dialog")).toBeNull();
		});
	});

	// 用户要求「modal 只是作为一个全屏按钮放在流程图的操作按钮中」
	it("操作按钮里有「全屏」，点它回调；全屏时变成「退出全屏」", () => {
		const onToggleFullscreen = vi.fn();
		const { container, rerender } = render(
			<GraphView
				chart={chart}
				lang="both"
				onToggleFullscreen={onToggleFullscreen}
			/>,
		);
		const button = screen.getByRole("button", { name: "全屏" });
		expect(container.querySelector("[data-graph-canvas]")).not.toBeNull();
		fireEvent.click(button);
		expect(onToggleFullscreen).toHaveBeenCalledOnce();

		rerender(
			<GraphView
				chart={chart}
				fullscreen
				lang="both"
				onToggleFullscreen={onToggleFullscreen}
			/>,
		);
		expect(screen.getByRole("button", { name: "退出全屏" })).toBeDefined();
	});
});
