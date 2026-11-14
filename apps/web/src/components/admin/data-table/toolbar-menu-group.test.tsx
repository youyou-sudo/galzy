// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTableToolbar } from "./toolbar";

/**
 * Base UI 的 Menu.GroupLabel 必须包在 Menu.Group（或 RadioGroup）里，
 * 否则打开菜单时直接抛 "MenuGroupContext is missing" —— 这是纯运行时错误，
 * 类型检查与 lint 都发现不了。
 *
 * 工具条右侧的「列 / 行高」两个菜单此前就漏了这一层：菜单内容只在打开时挂载，
 * 于是表现成「点按钮就整页报错」，与 tasks/task-menu-group.test.tsx 同源。
 *
 * 用 findBy* 而不是 getBy*：Base UI 的弹层是异步挂载（portal + 定位），
 * 同步断言会在 CI 上偶发失败。
 */

afterEach(cleanup);

/** Base UI 的触发器在 pointerdown 时展开；jsdom 里补一次 click 更稳。 */
function openMenu(trigger: HTMLElement) {
	fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
	fireEvent.click(trigger);
}

describe("数据表格工具条菜单（MenuGroupContext 回归）", () => {
	it("行高菜单的分组标题可正常渲染，且能切换密度", async () => {
		const onDensityChange = vi.fn();
		render(
			<DataTableToolbar
				density="comfortable"
				onDensityChange={onDensityChange}
			/>,
		);
		openMenu(screen.getByRole("button", { name: "行高密度" }));
		expect(await screen.findByText("行高")).toBeTruthy();
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "紧凑" }));
		expect(onDensityChange).toHaveBeenCalledWith("compact");
	});

	it("列显隐菜单的分组标题可正常渲染，且能勾选列", async () => {
		const onToggle = vi.fn();
		render(
			<DataTableToolbar
				visibility={{
					columns: [{ id: "name", label: "名称", hidden: false }],
					onToggle,
				}}
			/>,
		);
		openMenu(screen.getByRole("button", { name: /列/ }));
		expect(await screen.findByText("显示列")).toBeTruthy();
		fireEvent.click(
			await screen.findByRole("menuitemcheckbox", { name: "名称" }),
		);
		expect(onToggle).toHaveBeenCalledWith("name", false);
	});
});
