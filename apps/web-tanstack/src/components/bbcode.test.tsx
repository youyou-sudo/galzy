// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BBCodeRenderer, getDescriptionPreview } from "./bbcode";

const kungalDescription = [
	"第一段简介。",
	"",
	"\\",
	"",
	"第二段简介。",
	"",
	"*\\[Form* *[wikipedia](https://ja.wikipedia.org/wiki/%E5%8D%83%E6%81%8B*%E4%B8%87%E8%8A%B1)* *, used under CC BY-SA 4.0 licenses]*",
].join("\n");

const markdownDescription = [
	"临近暑假的某一天。\\",
	"主人公开始了新的夏天。\\",
	"",
	"* 高清图像",
	"* 原画担当：みこ",
	"",
	"\\[Form [Steam](https://store.steampowered.com/app/931560)]",
].join("\n");

describe("BBCodeRenderer", () => {
	it("renders the mixed Kungal description without source markup", () => {
		const { container } = render(<BBCodeRenderer text={kungalDescription} />);

		expect(container.textContent).not.toContain("\\");
		expect(container.textContent).not.toContain("[wikipedia](");
		expect(container.textContent).not.toContain("*");
		expect(container.textContent).not.toContain("Form");
		expect(container.textContent).toContain(
			"From wikipedia, used under CC BY-SA 4.0 licenses",
		);
		expect(container.textContent).toContain("used under CC BY-SA 4.0 licenses");
		expect(container.querySelector("a")?.textContent).toBe("wikipedia");
		expect(container.querySelector("a")?.getAttribute("href")).toBe(
			"https://ja.wikipedia.org/wiki/%E5%8D%83%E6%81%8B*%E4%B8%87%E8%8A%B1",
		);
	});

	it("keeps VNDB BBCode formatting and links", () => {
		const { container } = render(
			<BBCodeRenderer text="[b]粗体[/b]\n\n[From [url=https://example.com]来源[/url]]" />,
		);

		expect(container.querySelector("strong")?.textContent).toBe("粗体");
		expect(container.querySelector("a")?.textContent).toBe("来源");
		expect(container.querySelector("a")?.getAttribute("href")).toBe(
			"https://example.com",
		);
	});

	it("renders regular Kungal Markdown line breaks and lists", () => {
		const { container } = render(<BBCodeRenderer text={markdownDescription} />);

		expect(container.textContent).not.toContain("\\");
		expect(container.querySelectorAll("li")).toHaveLength(2);
		expect(container.textContent).toContain("[Form Steam]");
		expect(container.querySelector("a")?.textContent).toBe("Steam");
	});

	it("creates an inline preview that ends with an ellipsis", () => {
		const preview = getDescriptionPreview("一\n二\n三\n四\n五\n六\n七");

		expect(preview).toEqual({
			text: "一\n二\n三\n四\n五\n六...",
			isTruncated: true,
		});

		const { container } = render(
			<>
				<BBCodeRenderer inline text={preview.text} />
				<button type="button">查看更多</button>
			</>,
		);
		expect(container.textContent).toBe("一\n二\n三\n四\n五\n六...查看更多");
	});
});
