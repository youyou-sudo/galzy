// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterDialog } from "./character-dialog";
import { readCharacterList, toCharacterInfoView } from "./character-types";

const [character] = readCharacterList({
	characters: [
		{
			id: "1",
			name: "遠野 秋葉",
			latin: "Tohno Akiha",
			rosterRole: "main",
			spoiler: "none",
			imageUrl: null,
		},
	],
});

describe("CharacterDialog", () => {
	it("名册字段先渲染，详情未到时给骨架 + 出演作品占位", () => {
		render(
			<CharacterDialog
				character={character ?? null}
				isDetailLoading
				onOpenChange={vi.fn()}
				open
			/>,
		);
		expect(screen.getByText("遠野 秋葉")).toBeDefined();
		expect(screen.getByText("Tohno Akiha")).toBeDefined();
		expect(screen.getByText("主要角色")).toBeDefined();
		expect(screen.getByText("出演作品")).toBeDefined();
	});

	it("详情到达后补出资料行与出演作品链接", () => {
		const info = toCharacterInfoView({
			id: "1",
			name: "遠野 秋葉",
			gender: "female",
			birthday: "09-22",
			bloodType: "ab",
			heightCm: 160,
			weightKg: 43,
			measurements: { bustCm: 88, waistCm: 58, hipCm: 86, cup: "C" },
			intro: "遠野家の長女。",
			traits: [{ id: "t1", displayName: "Tsundere", nameZh: "傲娇" }],
			appearances: [
				{
					workId: "17",
					displayId: "v17",
					displayName: "月姬",
					rosterRole: "main",
					spoiler: "none",
				},
			],
		});

		render(
			<CharacterDialog
				character={character ?? null}
				info={info}
				onOpenChange={vi.fn()}
				open
			/>,
		);
		expect(screen.getByText("女")).toBeDefined();
		expect(screen.getByText("9月22日")).toBeDefined();
		expect(screen.getByText("AB")).toBeDefined();
		expect(screen.getByText("160 cm")).toBeDefined();
		expect(screen.getByText("B88 / W58 / H86（C）")).toBeDefined();
		expect(screen.getByText("傲娇")).toBeDefined();
		expect(screen.getByText("月姬")).toBeDefined();
	});

	it("详情失败时给重试入口", () => {
		const onRetry = vi.fn();
		render(
			<CharacterDialog
				character={character ?? null}
				isDetailError
				onOpenChange={vi.fn()}
				onRetry={onRetry}
				open
			/>,
		);
		expect(screen.getByText("角色详情加载失败")).toBeDefined();
		screen.getByText("重试").click();
		expect(onRetry).toHaveBeenCalledOnce();
	});
});
