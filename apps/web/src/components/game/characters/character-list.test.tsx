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
	it("按身份分组渲染：主角出卡片，剧透角色默认隐藏", () => {
		const html = renderToString(
			<CharacterList characters={characters} onSelect={vi.fn()} />,
		);
		// 主角组标题 + 卡片
		expect(html).toContain("主角");
		expect(html).toContain("遠野 秋葉");
		expect(html).toContain("Tohno Akiha");
		// 无图占位：取姓名首字
		expect(html).toContain("遠");
		// 剧透角色默认不渲染；只有剧透角色时「其他登场角色」不出现空组
		expect(html).not.toContain("シエル");
		expect(html).not.toContain("其他登场角色");
		expect(html).toContain("显示剧透角色");
		expect(html).toContain("（<!-- -->1<!-- -->）");
		// 未打勾
		expect(html).not.toContain("checked");
	});

	it("勾选后把其他登场角色补成紧凑行，并保留剧透标记", () => {
		const { container } = render(
			<CharacterList characters={characters} onSelect={vi.fn()} />,
		);
		fireEvent.click(container.querySelector('input[type="checkbox"]')!);
		expect(within(container).getByText("シエル")).toBeDefined();
		expect(within(container).getByText("其他登场角色")).toBeDefined();
		expect(within(container).getByText("重度剧透")).toBeDefined();
	});

	it("主角 → 配角 → 其他登场角色依次成组，组内保持名册原序", () => {
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
		const names = [...container.querySelectorAll("[data-character-name]")].map(
			(node) => node.textContent,
		);
		expect(names).toEqual(["主角甲", "主角乙", "配角乙", "配角甲", "未知身份"]);
		const headings = [...container.querySelectorAll("h3")].map(
			(node) => node.firstChild?.textContent,
		);
		expect(headings).toEqual(["主角", "配角", "其他登场角色"]);
	});

	it("同名重复条目只保留卡片，不再混进其他登场角色", () => {
		const list = readCharacterList({
			characters: [
				{ id: "1", name: "仙石 一縷", rosterRole: "secondary" },
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
