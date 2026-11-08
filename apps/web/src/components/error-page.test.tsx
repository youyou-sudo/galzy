// @vitest-environment jsdom

import Errors from "@web/components/error";
import RootError from "@web/pages/error";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// 错误页只依赖导航层的 Link / useRouter；测试里换成静态实现即可（与
// home-page-pending.test.tsx 同样的做法），不引入 furin 路由上下文。
vi.mock("@web/lib/nav", async () => {
	const { createElement } = await import("react");
	return {
		Link: ({ children }: { children?: unknown }) =>
			createElement("a", { href: "/" }, children as never),
		useRouter: () => ({
			invalidate: () => Promise.resolve(),
			refresh: () => Promise.resolve(),
			navigate: () => Promise.resolve(),
			history: { back: () => {} },
		}),
	};
});

describe("错误页（pages/error.tsx）", () => {
	it("把真实 message / digest 放进折叠详情，而不是只显示默认文案", () => {
		const html = renderToString(
			<RootError
				error={
					{
						message: '[furin] useSearch("/") does not match the current route.',
						digest: "deadbeef00",
						status: 500,
					} as never
				}
				reset={() => {}}
			/>,
		);
		// 状态码与友好文案
		expect(html).toContain("500");
		expect(html).toContain("页面出错了");
		expect(html).toContain("查看错误详情");
		// 真实原因与 digest 必须可查（旧实现会丢掉这两者）
		expect(html).toContain("useSearch");
		expect(html).toContain("deadbeef00");
	});

	it("详情使用 shadcn CodeBlock 渲染，并带复制按钮", () => {
		const html = renderToString(
			<RootError
				error={
					{
						message: "boom-from-loader",
						digest: "cafebabe01",
						status: 500,
					} as never
				}
				reset={() => {}}
			/>,
		);
		// components/ui/code-block 的结构与破坏性变体
		expect(html).toContain('data-slot="code-block"');
		expect(html).toContain('data-variant="destructive"');
		expect(html).toContain('data-slot="code-block-title"');
		expect(html).toContain("错误代码");
		// 一键复制原始报错，方便贴进 issue / 日志
		expect(html).toContain('data-slot="code-block-copy-button"');
		expect(html).toContain('aria-label="Copy"');
	});

	it("Error 实例同样保留 message", () => {
		const html = renderToString(
			<RootError
				error={new Error("boom-from-loader") as never}
				reset={() => {}}
			/>,
		);
		expect(html).toContain("boom-from-loader");
	});

	it("404 显示「页面不存在」", () => {
		const html = renderToString(
			<RootError
				error={
					{ message: "gone-route", digest: "feedface00", status: 404 } as never
				}
				reset={() => {}}
			/>,
		);
		// 大号状态码在 hero 里渲染成独立的 span 文本（JSON 里的 status 不会带尖括号）
		expect(html).toContain(">404<");
		// 详情 message 不是「页面不存在」，所以这个标题只能来自 404 分支
		expect(html).toContain("页面不存在");
	});

	it("没有详情时不渲染代码块", () => {
		const html = renderToString(<Errors code={500} />);
		expect(html).toContain("页面加载出错了");
		expect(html).not.toContain('data-slot="code-block"');
		expect(html).not.toContain("查看错误详情");
	});
});
