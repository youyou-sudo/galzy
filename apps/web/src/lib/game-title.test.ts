import { describe, expect, it } from "vitest";
import { preferredGameTitle, preferredTitleFrom } from "./game-title";

const game = (
	titles: Array<{ lang: string; title: string }>,
	olang = "ja",
) => ({
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
		expect(preferredGameTitle(game([{ lang: "en", title: "English" }]))).toBe(
			"English",
		);
	});

	it("全部为空时返回 undefined", () => {
		expect(preferredGameTitle(null)).toBeUndefined();
		expect(
			preferredGameTitle(game([{ lang: "ja", title: "  " }])),
		).toBeUndefined();
	});
});

describe("preferredTitleFrom", () => {
	it("列表行同样中文优先，无中文回退 olang", () => {
		expect(
			preferredTitleFrom(
				[
					{ lang: "ja", title: "千恋＊万花" },
					{ lang: "zh-Hans", title: "千恋＊万花 中文版" },
				],
				"ja",
			),
		).toBe("千恋＊万花 中文版");
		expect(
			preferredTitleFrom([{ lang: "ja", title: "千恋＊万花" }], "ja"),
		).toBe("千恋＊万花");
	});

	it("语言码大小写不敏感，其它中文变体也会命中", () => {
		expect(
			preferredTitleFrom([{ lang: "ZH-HANS", title: "简体名" }], "ja"),
		).toBe("简体名");
		expect(
			preferredTitleFrom(
				[
					{ lang: "ja", title: "テスト" },
					{ lang: "zh-CN", title: "简中名" },
				],
				"ja",
			),
		).toBe("简中名");
	});

	it("跳过空白标题行，空数据返回 undefined", () => {
		expect(
			preferredTitleFrom(
				[
					{ lang: "zh-Hans", title: "   " },
					{ lang: "ja", title: "日本語" },
				],
				"ja",
			),
		).toBe("日本語");
		expect(preferredTitleFrom(null, null)).toBeUndefined();
		expect(preferredTitleFrom([], "ja")).toBeUndefined();
	});
});
