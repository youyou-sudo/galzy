import { describe, expect, it } from "vitest";
import type { HeaderNavKey } from "./nav-config";
import {
	desktopNavEntries,
	headerNav,
	homeMenuKeys,
	mobileNavEntries,
	navItem,
	toolMenuKeys,
} from "./nav-config";

/**
 * 顶栏按钮顺序是产品要求（改版前后必须一致），
 * 这里把顺序钉在测试里：以后调整导航时若动了顺序，测试会立刻失败。
 *
 * 推广位（kind === "ad"）的文案不在数据源里——它来自后台广告位 header_nav，
 * 所以顺序断言里用固定的占位名指代这一格。
 */
const AD_LABEL = "（推广位）";

function desktopLabel(entry: (typeof desktopNavEntries)[number]): string {
	if (entry.kind === "menu") return entry.label;
	if (entry.kind === "ad") return AD_LABEL;
	return navItem(entry.key).label;
}

describe("顶栏导航数据源", () => {
	it("桌面端顺序：主页 → 标签 → 会社 → 合集 → 工具 → 论坛 → 推广位", () => {
		expect(desktopNavEntries.map(desktopLabel)).toEqual([
			"主页",
			"标签",
			"会社",
			"合集",
			"工具",
			"论坛",
			AD_LABEL,
		]);
	});

	it("移动端顺序：主站 → OpList → 防失联 → 标签 → 会社 → 合集 → 论坛 → 联系 → 推广位", () => {
		expect(
			mobileNavEntries.map((entry) =>
				entry.kind === "ad" ? AD_LABEL : navItem(entry.key).label,
			),
		).toEqual([
			"主站",
			"OpList 站",
			"防失联&发布页",
			"标签",
			"会社",
			"合集",
			"论坛",
			"联系",
			AD_LABEL,
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

	it("推广链接不写死在静态导航数据里（只能由后台广告位下发）", () => {
		for (const item of Object.values(headerNav)) {
			if (item.type === "external") {
				// 推广链接一旦回到这里，就又会变成「改链接要发版」
				expect(item.href).not.toContain("yyai.online");
			}
		}
	});
});
