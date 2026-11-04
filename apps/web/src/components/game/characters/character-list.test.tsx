import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CharacterList } from "./character-list";
import { readCharacterList } from "./character-types";

const characters = readCharacterList({
	characters: [
		{
			id: "1",
			name: "遠野 秋葉",
			latin: "Tohno Akiha",
			rosterRole: "main",
			spoiler: "none",
			imageUrl: null,
		},
		{
			id: "2",
			name: "シエル",
			latin: "Ciel",
			rosterRole: "appears",
			spoiler: "major",
			imageUrl: null,
		},
	],
});

describe("CharacterList", () => {
	it("按身份分组渲染，徽章与无图占位都出来", () => {
		const html = renderToString(
			<CharacterList characters={characters} onSelect={vi.fn()} />,
		);
		expect(html).toContain("主要角色");
		expect(html).toContain("登场角色");
		expect(html).toContain("遠野 秋葉");
		expect(html).toContain("Tohno Akiha");
		expect(html).toContain("重度剧透");
		// 无图占位：取姓名首字
		expect(html).toContain("遠");
		// 空态不出现
		expect(html).not.toContain("暂无角色数据");
	});

	it("没有角色时给空态文案", () => {
		const html = renderToString(
			<CharacterList characters={[]} onSelect={vi.fn()} />,
		);
		expect(html).toContain("暂无角色数据");
	});
});
