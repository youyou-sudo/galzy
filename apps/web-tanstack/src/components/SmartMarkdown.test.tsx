// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { SmartMarkdown } from "../components/SmartMarkdown";
import { render } from "@testing-library/react";

describe("SmartMarkdown", () => {
	it("纯 txt:原样保留换行与缩进", () => {
		const txt =
			"序章\n\n    四空格缩进的段落\n    第二行\n\n选项 <告白> / <拒绝>";
		const { container } = render(<SmartMarkdown>{txt}</SmartMarkdown>);
		const div = container.querySelector("div.whitespace-pre-wrap");
		expect(div).toBeTruthy();
		expect(div?.textContent).toContain("四空格缩进的段落");
		expect(div?.textContent).toContain("<告白>");
		// 无 markdown 标签
		expect(container.querySelector("p, pre, ul, h1, h2, h3")).toBeNull();
	});

	it("markdown:渲染标题/列表,单换行保留为 br", () => {
		const md = "## 标题\n第一行\n第二行\n\n- 甲\n- 乙";
		const { container } = render(<SmartMarkdown>{md}</SmartMarkdown>);
		expect(container.querySelector("h2")?.textContent).toBe("标题");
		expect(container.querySelectorAll("li").length).toBe(2);
		expect(container.querySelectorAll("br").length).toBeGreaterThanOrEqual(1);
	});

	it("markdown 模式:尖括号选择肢转义为文本", () => {
		const md = "选项:<告白> <拒绝>\n\n- 继续";
		const { container } = render(<SmartMarkdown>{md}</SmartMarkdown>);
		expect(container.textContent).toContain("<告白> <拒绝>");
		// 没有丢失内容
		expect(container.querySelectorAll("li").length).toBe(1);
	});

	it("markdown 模式:四空格缩进不被当作代码块", () => {
		const md = "## 标题\n\n    缩进的段落文字";
		const { container } = render(<SmartMarkdown>{md}</SmartMarkdown>);
		expect(container.querySelector("pre, code")).toBeNull();
		expect(container.textContent).toContain("缩进的段落文字");
	});

	it("存量 HTML 富文本:继续渲染为段落", () => {
		const html = "<p>1.【save1】</p><p>选择阳子</p>";
		const { container } = render(<SmartMarkdown>{html}</SmartMarkdown>);
		expect(container.querySelectorAll("p").length).toBe(2);
	});

	it("空内容安全", () => {
		const { container } = render(<SmartMarkdown>{""}</SmartMarkdown>);
		expect(container.textContent).toBe("");
	});
});
