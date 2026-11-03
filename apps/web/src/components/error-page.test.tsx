// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RootError from "@web/pages/error";

// 错误页只依赖导航层的 Link / useRouter；测试里换成静态实现即可（与
// home-page-pending.test.tsx 同样的做法），不引入 furin 路由上下文。
vi.mock("@web/lib/nav", async () => {
	const { createElement } = await import("react");
	return {
		Link: ({ children }: { children?: unknown }) =>
			createElement("a", { href: "/" }, children as never),
		useRouter: () => ({
			invalidate: () => Promise.resolve(),
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
						message:
							'[furin] useSearch("/") does not match the current route.',
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

	it("Error 实例同样保留 message", () => {
		const html = renderToString(
			<RootError error={new Error("boom-from-loader") as never} reset={() => {}} />,
		);
		expect(html).toContain("boom-from-loader");
	});
});
