// @vitest-environment jsdom
import { fireEvent, render, within } from "@testing-library/react";
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
			imageUrl: "https://example.com/Tohno Akiha.jpg",
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
	it("有立绘的角色直接成卡片网格，不按身份分标题；剧透角色默认隐藏", () => {
		const html = renderToString(
			<CharacterList characters={characters} onSelect={vi.fn()} />,
		);
		expect(html).toContain("遠野 秋葉");
		expect(html).toContain("Tohno Akiha");
		// 身份只留卡片角标，不再有主角 / 配角分组标题
		expect(html).not.toContain("<h3");
		// 剧透角色默认不渲染；没有无图角色时不出现「其他登场角色」空组
		expect(html).not.toContain("シエル");
		expect(html).not.toContain("其他登场角色");
		expect(html).toContain("显示剧透角色");
		expect(html).toContain("（<!-- -->1<!-- -->）");
		// 未打勾
		expect(html).not.toContain("checked");
	});

	it("勾选后把无图剧透角色补成「其他登场角色」紧凑行，并保留剧透标记", () => {
		const { container } = render(
			<CharacterList characters={characters} onSelect={vi.fn()} />,
		);
		fireEvent.click(container.querySelector('input[type="checkbox"]')!);
		expect(within(container).getByText("シエル")).toBeDefined();
		expect(within(container).getByText("其他登场角色")).toBeDefined();
		expect(within(container).getByText("重度剧透")).toBeDefined();
		// 有图的角色仍在卡片网格里，不跟着挪进紧凑行
		expect(within(container).getByText("遠野 秋葉")).toBeDefined();
	});

	it("有图的按名册顺序铺卡片，无图的单独归到「其他登场角色」", () => {
		const list = readCharacterList({
			characters: [
				{ id: "1", name: "无图甲", rosterRole: "main" },
				{
					id: "2",
					name: "有图主角",
					rosterRole: "main",
					imageUrl: "https://example.com/a.jpg",
				},
				{ id: "3", name: "无图乙" },
				{
					id: "4",
					name: "有图配角",
					rosterRole: "secondary",
					imageUrl: "https://example.com/b.jpg",
				},
				{ id: "5", name: "无图丙", rosterRole: "secondary" },
			],
		});
		const { container } = render(
			<CharacterList characters={list} onSelect={vi.fn()} />,
		);
		const names = [...container.querySelectorAll("[data-character-name]")].map(
			(node) => node.textContent,
		);
		// 卡片网格在前、紧凑行在后，两段各自保持名册原序
		expect(names).toEqual([
			"有图主角",
			"有图配角",
			"无图甲",
			"无图乙",
			"无图丙",
		]);
		const headings = [...container.querySelectorAll("h3")].map(
			(node) => node.firstChild?.textContent,
		);
		// 只有无图分组有标题，主角 / 配角不再分标题
		expect(headings).toEqual(["其他登场角色"]);
	});

	it("同名有图 / 无图重复条目只保留卡片，不再混进其他登场角色", () => {
		const list = readCharacterList({
			characters: [
				{
					id: "1",
					name: "仙石 一縷",
					rosterRole: "secondary",
					imageUrl: "https://example.com/c.jpg",
				},
				{ id: "2", name: "仙石一縷", rosterRole: "unknown" },
			],
		});
		const { container } = render(
			<CharacterList characters={list} onSelect={vi.fn()} />,
		);
		expect(container.querySelectorAll("[data-character-name]")).toHaveLength(1);
		expect(within(container).queryByText("其他登场角色")).toBeNull();
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
