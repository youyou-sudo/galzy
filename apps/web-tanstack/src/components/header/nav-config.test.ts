import { describe, expect, it } from "vitest";
import {
	desktopNavEntries,
	headerNav,
	homeMenuKeys,
	mobilePrimaryKeys,
	navItem,
	toolMenuKeys,
} from "./nav-config";
import type { HeaderNavKey } from "./nav-config";

/**
 * 顶栏按钮顺序是产品要求（改版前后必须一致），
 * 这里把顺序钉在测试里：以后调整导航时若动了顺序，测试会立刻失败。
 */
describe("顶栏导航数据源", () => {
	it("桌面端顺序：主页 → 标签 → 会社 → 合集 → 工具 → 论坛", () => {
		const labels = desktopNavEntries.map((entry) =>
			entry.kind === "menu" ? entry.label : navItem(entry.key).label,
		);
		expect(labels).toEqual(["主页", "标签", "会社", "合集", "工具", "论坛"]);
	});

	it("移动端顺序：主站 → OpList → 防失联 → 标签 → 会社 → 合集 → 论坛 → 联系", () => {
		expect(mobilePrimaryKeys.map((key) => navItem(key).label)).toEqual([
			"主站",
			"OpList 站",
			"防失联&发布页",
			"标签",
			"会社",
			"合集",
			"论坛",
			"联系",
		]);
	});

	it("工具分组顺序：所有工具 → 车牌号跳转", () => {
		expect(toolMenuKeys.map((key) => navItem(key).label)).toEqual([
			"所有工具",
			"车牌号跳转",
		]);
	});

	it("「主页」下拉面板顺序：主站 → OpList → 防失联 → 联系", () => {
		expect(homeMenuKeys.map((key) => navItem(key).label)).toEqual([
			"主站",
			"OpList 站",
			"防失联&发布页",
			"联系",
		]);
	});

	it("条目只有站内路径或外链其一，且格式正确", () => {
		for (const key of Object.keys(headerNav) as HeaderNavKey[]) {
			const item = navItem(key);
			if (item.type === "internal") {
				expect(String(item.to).startsWith("/")).toBe(true);
			} else {
				expect(item.href.startsWith("https://")).toBe(true);
			}
		}
	});
});
