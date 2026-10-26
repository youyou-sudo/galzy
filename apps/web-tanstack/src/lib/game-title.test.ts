import { describe, expect, it } from "vitest";
import { preferredGameTitle } from "./game-title";

const game = (titles: Array<{ lang: string; title: string }>, olang = "ja") => ({
	vn: { olang, titles },
});

describe("preferredGameTitle", () => {
	it("zh-Hans 优先于 olang 标题", () => {
		expect(
			preferredGameTitle(
				game([
					{ lang: "ja", title: "千恋＊万花" },
					{ lang: "zh-Hans", title: "千恋＊万花 中文版" },
				]),
			),
		).toBe("千恋＊万花 中文版");
	});

	it("没有简体时依次回退 zh、zh-Hant", () => {
		expect(
			preferredGameTitle(
				game([
					{ lang: "ja", title: "テスト" },
					{ lang: "zh", title: "中文名" },
				]),
			),
		).toBe("中文名");
		expect(
			preferredGameTitle(
				game([
					{ lang: "ja", title: "テスト" },
					{ lang: "zh-Hant", title: "繁體名" },
				]),
			),
		).toBe("繁體名");
	});

	it("没有中文时回退 olang，再回退任意非空标题", () => {
		expect(
			preferredGameTitle(
				game([
					{ lang: "en", title: "English" },
					{ lang: "ja", title: "日本語" },
				]),
			),
		).toBe("日本語");
		expect(
			preferredGameTitle(game([{ lang: "en", title: "English" }])),
		).toBe("English");
	});

	it("全部为空时返回 undefined", () => {
		expect(preferredGameTitle(null)).toBeUndefined();
		expect(
			preferredGameTitle(game([{ lang: "ja", title: "  " }])),
		).toBeUndefined();
	});
});
