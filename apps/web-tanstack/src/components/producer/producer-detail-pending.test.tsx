import {
	producerHeroActions,
	producerHeroStore,
} from "@web/stores/producerHeroStore";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProducerDetailPending } from "./producer-detail-pending";
import { ProducerGameGridSkeleton } from "./producer-game-grid";

// 只 mock 路由 Link：pending 组件本身不吃路由状态（pid 由父级传入），
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

/** 骨架屏节点标记：断言只认结构，不绑死类名顺序（全站正在做 Tailwind 类名整理） */
const SKELETON = 'data-slot="skeleton"';

/** 固定外壳的骨架数量：1（别名）+ 3（简介）+ 6 张占位卡 × 2 */
const DATA_SKELETONS = 16;

beforeEach(() => {
	producerHeroStore.setState(() => ({ pid: null, name: "" }));
});

describe("ProducerDetailPending", () => {
	it("入口带厂商名时：面包屑与卡片标题复用真实名字，不出标题骨架", () => {
		producerHeroActions.fromProducer({ id: "p10006", name: "Key" });
		const markup = renderToString(<ProducerDetailPending pid="p10006" />);
		expect(markup).toContain("Key");
		// 面包屑末项与真实页一致：BreadcrumbPage（aria-current=page），不再是链接
		expect(markup).toContain('aria-current="page"');
		expect(markup).not.toContain('href="/producer/p10006"');
		// 标题 / 面包屑不再出骨架，只剩数据占位
		expect(count(markup, SKELETON)).toBe(DATA_SKELETONS);
		// 厂商名继续挂 view-transition-name，入口到详情页的文字飞行不受 pending 影响
		expect(markup).toContain("producer-name-p10006");
	});

	it("没有入口数据时：面包屑与标题各补一处骨架", () => {
		const markup = renderToString(<ProducerDetailPending pid="p10006" />);
		expect(count(markup, SKELETON)).toBe(DATA_SKELETONS + 2);
		// 名字未知时不挂 VT 名：避免旧页文字飞进骨架盒
		expect(markup).not.toContain("producer-name-p10006");
		// 静态外壳仍然是真实内容（不是整页骨架）
		expect(markup).toContain("首页");
		expect(markup).toContain("厂商");
		expect(markup).toContain('data-slot="breadcrumb"');
	});

	it("store 里是别的厂商时不复用旧名字", () => {
		producerHeroActions.fromProducer({ id: "p999", name: "别的厂商" });
		const markup = renderToString(<ProducerDetailPending pid="p10006" />);
		expect(markup).not.toContain("别的厂商");
		expect(count(markup, SKELETON)).toBe(DATA_SKELETONS + 2);
	});

	it("card 外壳与游戏栅格是真实 HTML，固定结构不参与加载态", () => {
		producerHeroActions.fromProducer({ id: "p10006", name: "Key" });
		const markup = renderToString(<ProducerDetailPending pid="p10006" />);
		for (const slot of [
			"card",
			"card-header",
			"card-title",
			"card-description",
			"card-content",
		]) {
			expect(markup).toContain('data-slot="' + slot + '"');
		}
		// 栅格断点与真实列表（ProducerGameGrid）完全一致，数据到达时不跳列
		expect(markup).toContain("grid-cols-3");
		expect(markup).toContain("sm:grid-cols-4");
		expect(markup).toContain("md:grid-cols-6");
	});
});

describe("ProducerGameGridSkeleton", () => {
	it("栅格与真实列表同款，只给卡片内部出骨架", () => {
		const markup = renderToString(<ProducerGameGridSkeleton />);
		expect(markup).toContain("grid-cols-3");
		expect(markup).toContain("sm:grid-cols-4");
		expect(markup).toContain("md:grid-cols-6");
		// 6 张占位卡 × 2 个内部骨架
		expect(count(markup, SKELETON)).toBe(12);
	});
});

describe("producerHeroActions.fromProducer", () => {
	it("pid 为空时忽略，不会污染上一个厂商", () => {
		producerHeroActions.fromProducer({ id: "p1", name: "Key" });
		expect(producerHeroStore.state).toMatchObject({ pid: "p1", name: "Key" });

		producerHeroActions.fromProducer({ id: "  ", name: "x" });
		expect(producerHeroStore.state).toMatchObject({ pid: "p1", name: "Key" });
	});

	it("名字缺失或纯空白时折叠成空串（pending 退回骨架）", () => {
		producerHeroActions.fromProducer({ id: "p2", name: "   " });
		expect(producerHeroStore.state).toMatchObject({ pid: "p2", name: "" });
		producerHeroActions.fromProducer({ id: "p3" });
		expect(producerHeroStore.state).toMatchObject({ pid: "p3", name: "" });
	});
});
