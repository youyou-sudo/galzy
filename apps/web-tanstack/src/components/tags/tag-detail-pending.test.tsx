import { tagHeroActions, tagHeroStore } from "@web/stores/tagHeroStore";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ChildTagsSkeleton,
	TagDetailPending,
	TagHierarchySkeleton,
	TagRelatedGamesSkeleton,
} from "./tag-detail-pending";

// 只 mock 路由 Link：pending 组件本身不吃路由状态（tagId 由父级传入），
// 但面包屑用的是真实 BreadcrumbLink + Link，脱离 Router 渲染会抛错。
vi.mock("@tanstack/react-router", async () => {
	const { createElement } = await import("react");
	const href = (to: string, params?: Record<string, string>) =>
		params
			? Object.entries(params).reduce(
					(acc, [key, value]) => acc.replace("$" + key, value),
					to,
				)
			: to;
	return {
		Link: ({
			to,
			params,
			children,
		}: {
			to: string;
			params?: Record<string, string>;
			children?: ReactNode;
		}) => createElement("a", { href: href(to, params) }, children),
	};
});

const count = (markup: string, needle: string) =>
	markup.split(needle).length - 1;

beforeEach(() => {
	tagHeroStore.setState(() => ({ id: null, data: null }));
});

describe("TagDetailPending", () => {
	it("入口带名字时：标题与面包屑复用真实标签名，不出标题骨架", () => {
		tagHeroActions.fromTag({ id: "g235", zht_name: "纯爱" });
		const markup = renderToString(<TagDetailPending tagId="g235" />);
		expect(markup).toContain("纯爱");
		// 面包屑末项与真实页一致：BreadcrumbPage（aria-current=page），不再是链接
		expect(markup).toContain('aria-current="page"');
		expect(markup).not.toContain('href="/tags/g235"');
		// 标题骨架 / 面包屑骨架都不该出现
		expect(markup).not.toContain("h-8 w-48");
		expect(markup).not.toContain("h-4 w-20");
	});

	it("没有入口数据时：标题、面包屑各自只出一处骨架", () => {
		const markup = renderToString(<TagDetailPending tagId="g235" />);
		expect(markup).toContain("h-8 w-48");
		expect(markup).toContain("h-4 w-20");
		// 静态外壳仍然是真实内容
		expect(markup).toContain("首页");
		expect(markup).toContain("标签");
	});

	it("store 里是别的标签时不复用旧名字", () => {
		tagHeroActions.fromTag({ id: "g999", zht_name: "别的标签" });
		const markup = renderToString(<TagDetailPending tagId="g235" />);
		expect(markup).not.toContain("别的标签");
		expect(markup).toContain("h-8 w-48");
	});

	it("card HTML 与页签是真实内容，不整页骨架", () => {
		tagHeroActions.fromTag({ id: "g235", zht_name: "纯爱" });
		const markup = renderToString(<TagDetailPending tagId="g235" />);
		for (const slot of [
			"card",
			"card-header",
			"card-title",
			"card-content",
			"tabs-list",
		]) {
			expect(markup).toContain('data-slot="' + slot + '"');
		}
		expect(markup).toContain("子标签");
		expect(markup).toContain("标签层级关系");
		expect(markup).toContain("相关游戏，过滤自 VNDB");
	});

	it("只给简介/子标签/相关游戏出加载态，且数量确定", () => {
		tagHeroActions.fromTag({ id: "g235", zht_name: "纯爱" });
		const markup = renderToString(<TagDetailPending tagId="g235" />);
		// 简介 3 行
		expect(markup).toContain("h-4 w-[92%]");
		expect(markup).toContain("h-4 w-3/5");
		// 子标签 8 个药丸
		expect(count(markup, "rounded-4xl")).toBe(8);
		// 相关游戏 6 张卡片骨架
		expect(count(markup, "aspect-[9/13]")).toBe(6);
		// 3（简介）+ 8（子标签）+ 12（相关游戏，每张卡 2 个 Skeleton）= 23
		expect(count(markup, 'data-slot="skeleton"')).toBe(23);
	});
});

describe("标签子区域骨架", () => {
	it("子标签面板：裁到一行（max-h-6）的药丸骨架", () => {
		const markup = renderToString(<ChildTagsSkeleton />);
		expect(markup).toContain("max-h-6");
		expect(markup).toContain("overflow-hidden");
		expect(count(markup, "rounded-4xl")).toBe(8);
		expect(count(markup, 'data-slot="skeleton"')).toBe(8);
	});

	it("层级关系面板：画布外框 + 统计胶囊 + 3 个节点", () => {
		const markup = renderToString(<TagHierarchySkeleton />);
		expect(markup).toContain("h-64");
		expect(markup).toContain("rounded-2xl");
		expect(count(markup, 'data-slot="skeleton"')).toBe(4);
	});

	it("相关游戏骨架：与列表栅格一致（3 / md 6 列）", () => {
		const markup = renderToString(<TagRelatedGamesSkeleton />);
		expect(markup).toContain("grid-cols-3");
		expect(markup).toContain("md:grid-cols-6");
		expect(count(markup, "aspect-[9/13]")).toBe(6);
	});
});

describe("tagHeroActions.fromTag", () => {
	it("展示名按中文名优先，id 为空时忽略", () => {
		tagHeroActions.fromTag({ id: "g1", zht_name: "中文名", name: "english" });
		expect(tagHeroStore.state.data).toEqual({ id: "g1", name: "中文名" });

		tagHeroActions.fromTag({ id: "  ", name: "x" });
		expect(tagHeroStore.state.data).toEqual({ id: "g1", name: "中文名" });
	});

	it("标签库的 zh_name 优先于原文 name", () => {
		tagHeroActions.fromTag({ id: "g2", zh_name: "中文名", name: "english" });
		expect(tagHeroStore.state.data).toEqual({ id: "g2", name: "中文名" });
	});

	it("纯空白的中文名不会短路掉原文（各候选 trim 后再判空）", () => {
		tagHeroActions.fromTag({
			id: "g3",
			zht_name: "   ",
			zh_name: "",
			name: " english ",
		});
		expect(tagHeroStore.state.data).toEqual({ id: "g3", name: "english" });
	});
});
