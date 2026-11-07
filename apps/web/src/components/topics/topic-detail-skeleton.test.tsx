import { RichContentSkeleton } from "@web/components/rich-content-skeleton";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TopicDetailSkeleton } from "./topic-detail-skeleton";

/** 统计某个片段在渲染结果里出现几次（骨架数量断言用） */
const count = (markup: string, needle: string) =>
	markup.split(needle).length - 1;

describe("TopicDetailSkeleton", () => {
	it("整页标记为加载中，且外壳与真实详情页同构", () => {
		const markup = renderToString(<TopicDetailSkeleton />);
		// 屏幕阅读器可感知「正在加载」，不是纯装饰
		expect(markup).toContain('aria-busy="true"');
		// 与真实页一致的最大宽度容器 + Card 外框
		expect(markup).toContain("max-w-4xl");
		for (const slot of ["card", "card-header", "card-content", "skeleton"]) {
			expect(markup).toContain('data-slot="' + slot + '"');
		}
	});

	it("面包屑只用静态文字，不伪造帖子标题，也不出「帖子不存在」", () => {
		const markup = renderToString(<TopicDetailSkeleton />);
		expect(markup).toContain("首页");
		expect(markup).toContain("论坛");
		// 加载态不能误报空态文案
		expect(markup).not.toContain("帖子不存在");
		expect(markup).not.toContain("返回论坛");
	});

	it("正文出多行骨架，评论区复用统一骨架", () => {
		const markup = renderToString(<TopicDetailSkeleton />);
		// 正文 8 行 + 面包屑 1 + 标题 1 + 作者行 3 = 13；评论骨架另有自己的条数
		expect(count(markup, 'data-slot="skeleton"')).toBeGreaterThanOrEqual(13);
		// 评论区标题是静态文字，加载中也可读
		expect(markup).toContain("评论");
	});
});

describe("RichContentSkeleton", () => {
	it("渲染确定行数的骨架条（宽度序列固定，不随机抖动）", () => {
		const first = renderToString(<RichContentSkeleton />);
		const second = renderToString(<RichContentSkeleton />);
		expect(count(first, 'data-slot="skeleton"')).toBe(8);
		// 两次渲染完全一致：行宽是常量序列
		expect(second).toBe(first);
	});

	it("对辅助技术隐藏（占位不是内容）", () => {
		const markup = renderToString(<RichContentSkeleton />);
		expect(markup).toContain('aria-hidden="true"');
	});

	it("接受外部 className，便于套进 prose 容器", () => {
		const markup = renderToString(
			<RichContentSkeleton className="my-skeleton-probe" />,
		);
		expect(markup).toContain("my-skeleton-probe");
	});
});
