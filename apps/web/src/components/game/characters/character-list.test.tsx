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
	it("不分分组，平铺渲染并给身份徽章；剧透角色默认隐藏", () => {
		const html = renderToString(
			<CharacterList characters={characters} onSelect={vi.fn()} />,
		);
		// 身份徽章取代分组标题
		expect(html).toContain("主角");
		expect(html).not.toContain("主要角色");
		expect(html).toContain("遠野 秋葉");
		expect(html).toContain("Tohno Akiha");
		// 剧透角色默认不渲染
		expect(html).not.toContain("シエル");
		expect(html).not.toContain("配角");
		expect(html).toContain("显示剧透角色");
		expect(html).toContain("（<!-- -->1<!-- -->）");
		// 未打勾
		expect(html).not.toContain("checked");
	});

	it("勾选后补出剧透角色，身份与剧透徽章并排", () => {
		const { container } = render(
			<CharacterList characters={characters} onSelect={vi.fn()} />,
		);
		fireEvent.click(container.querySelector('input[type="checkbox"]')!);
		expect(within(container).getByText("シエル")).toBeDefined();
		expect(within(container).getByText("配角")).toBeDefined();
		expect(within(container).getByText("重度剧透")).toBeDefined();
		// 无图占位：取姓名首字
		expect(within(container).getByText("遠")).toBeDefined();
	});

	it("主角 → 配角 → 未知身份依次排序，同档保持原序", () => {
		const list = readCharacterList({
			characters: [
				{ id: "1", name: "配角甲", rosterRole: "appears" },
				{ id: "2", name: "主角甲", rosterRole: "main" },
				{ id: "3", name: "未知身份" },
				{ id: "4", name: "主角乙", rosterRole: "main" },
				{ id: "5", name: "配角乙", rosterRole: "secondary" },
			],
		});
		const { container } = render(
			<CharacterList characters={list} onSelect={vi.fn()} />,
		);
		const names = [...container.querySelectorAll("p.font-medium")].map(
			(node) => node.textContent,
		);
		expect(names).toEqual(["主角甲", "主角乙", "配角乙", "配角甲", "未知身份"]);
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
