// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
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
	it("默认隐藏剧透角色，并给出开关与数量", () => {
		const html = renderToString(
			<CharacterList characters={characters} onSelect={vi.fn()} />,
		);
		expect(html).toContain("主要角色");
		expect(html).not.toContain("シエル");
		expect(html).not.toContain("登场角色");
		expect(html).toContain("显示剧透角色");
		expect(html).toContain("（<!-- -->1<!-- -->）");
		// 未打勾
		expect(html).not.toContain("checked");
	});

	it("勾选后显示剧透角色并带上剧透徽章", () => {
		render(<CharacterList characters={characters} onSelect={vi.fn()} />);
		fireEvent.click(screen.getByRole("checkbox"));
		expect(screen.getByText("シエル")).toBeDefined();
		expect(screen.getByText("登场角色")).toBeDefined();
		expect(screen.getByText("重度剧透")).toBeDefined();
		// 无图占位：取姓名首字
		expect(screen.getByText("遠")).toBeDefined();
	});

	it("没有角色时给空态文案", () => {
		const html = renderToString(
			<CharacterList characters={[]} onSelect={vi.fn()} />,
		);
		expect(html).toContain("暂无角色数据");
	});

	it("全部角色都带剧透时提示去勾选", () => {
		const onlySpoiler = readCharacterList({
			characters: [
				{ id: "9", name: "シエル", rosterRole: "main", spoiler: "major" },
			],
		});
		const html = renderToString(
			<CharacterList characters={onlySpoiler} onSelect={vi.fn()} />,
		);
		expect(html).toContain("角色都带剧透标记");
		expect(html).not.toContain("暂无角色数据");
	});
});
