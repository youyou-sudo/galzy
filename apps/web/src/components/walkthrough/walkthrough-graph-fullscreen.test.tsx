// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chartStats } from "./chart";
import { makeChart } from "./chart/chart-fixtures";
import { WalkthroughGraphFullscreen } from "./walkthrough-graph-fullscreen";

const chart = makeChart();
const stats = chartStats(chart);
const characters = [
	{
		key: "c1",
		name: "朝武芳乃",
		characterId: null,
		displayName: "朝武芳乃",
		localized: {},
	},
	{
		key: "c2",
		name: "常陸茉子",
		characterId: null,
		displayName: "常陸茉子",
		localized: {},
	},
];

// vitest 配了 globals:false，Testing Library 不会自动清理
afterEach(cleanup);

describe("WalkthroughGraphFullscreen", () => {
	it("打开时渲染标题、语言切换与角色筛选", () => {
		render(
			<WalkthroughGraphFullscreen
				characters={characters}
				characterKey={null}
				chart={chart}
				lang="zh"
				onCharacterChange={vi.fn()}
				onLangChange={vi.fn()}
				onOpenChange={vi.fn()}
				open
				stats={stats}
			/>,
		);
		const dialog = screen.getByRole("dialog");
		expect(within(dialog).getByText("选项流程图")).toBeDefined();
		// 语言是 Select（combobox），当前档回显在触发器上
		const lang = within(dialog).getByRole("combobox", { name: "语言切换" });
		expect(lang.textContent).toContain("中文");
		expect(
			within(dialog).getByRole("button", { name: /全部路线/ }),
		).toBeDefined();
	});

	// 手机上是「整屏」，不是「居中对话框」：ui/dialog 的 DialogContent 自带
	// top-1/2 + -translate-1/2，与铺满整屏是同一组工具类，实测会把弹层留在
	// 屏幕中心点、右下角溢出到视口外。这里锁死这条约束。
	it("弹层是整屏盒子（位置不再交给 DialogContent）", () => {
		render(
			<WalkthroughGraphFullscreen
				characters={characters}
				characterKey={null}
				chart={chart}
				lang="zh"
				onCharacterChange={vi.fn()}
				onLangChange={vi.fn()}
				onOpenChange={vi.fn()}
				open
				stats={stats}
			/>,
		);
		const popup = screen.getByRole("dialog");
		const classes = popup.className.split(/\s+/);
		expect(classes).toContain("inset-0");
		expect(classes).toContain("h-dvh");
		// 居中只在 lg 以上出现；基础层不允许出现无前缀的居中类
		for (const token of classes) {
			if (token.startsWith("lg:")) continue;
			expect([
				"top-1/2",
				"left-1/2",
				"-translate-x-1/2",
				"-translate-y-1/2",
			]).not.toContain(token);
		}
	});

	it("右上角关闭按钮与「退出全屏」都会回调关闭", () => {
		const onOpenChange = vi.fn();
		render(
			<WalkthroughGraphFullscreen
				characters={characters}
				characterKey={null}
				chart={chart}
				lang="zh"
				onCharacterChange={vi.fn()}
				onLangChange={vi.fn()}
				onOpenChange={onOpenChange}
				open
				stats={stats}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "关闭全屏" }));
		// Base UI 会把「关闭原因/事件」作为第二个参数传进来，只看第一个
		expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
		fireEvent.click(screen.getByRole("button", { name: "退出全屏" }));
		expect(onOpenChange).toHaveBeenCalledTimes(2);
	});
});
