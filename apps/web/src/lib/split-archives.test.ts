import type { GameModel } from "@api/modules/games/model";
import { describe, expect, it } from "vitest";
import { groupSplitArchives } from "./split-archives";

const file = (name: string, id = name): GameModel.TreeNode => ({
	id,
	name,
	type: "file",
	size: "1024",
});

const folder = (
	name: string,
	children: GameModel.TreeNode[],
): GameModel.TreeNode => ({
	id: name,
	name,
	type: "folder",
	children,
});

const FIXED_TS = 1700000000000;

describe("groupSplitArchives", () => {
	it("把 7-Zip 的 .7z.00N 分卷整合成一个分卷文件夹", () => {
		const result = groupSplitArchives(
			[file("A.7z.001"), file("A.7z.002")],
			FIXED_TS,
		);

		expect(result).toHaveLength(1);
		expect(result?.[0]).toMatchObject({
			type: "folder",
			name: "(分卷) A.7z",
			volumes: true,
		});
		expect(result?.[0].children?.map((child) => child.name)).toEqual([
			"A.7z.001",
			"A.7z.002",
		]);
	});

	it("分卷按序号排序，输入乱序也把 .001 排在最前", () => {
		const result = groupSplitArchives(
			[file("B.7z.003"), file("B.7z.001"), file("B.7z.002")],
			FIXED_TS,
		);

		expect(result?.[0].children?.map((child) => child.name)).toEqual([
			"B.7z.001",
			"B.7z.002",
			"B.7z.003",
		]);
	});

	it("仍然整合 WinRAR 的 .partN 分卷（回归）", () => {
		const result = groupSplitArchives(
			[file("C.part2.rar"), file("C.part1.rar")],
			FIXED_TS,
		);

		expect(result).toHaveLength(1);
		expect(result?.[0].name).toBe("(分卷) C.rar");
		expect(result?.[0].children?.map((child) => child.name)).toEqual([
			"C.part1.rar",
			"C.part2.rar",
		]);
	});

	it("支持 zip 的数字后缀分卷，且与同名 7z 分组互不干扰", () => {
		const result = groupSplitArchives(
			[
				file("D.zip.001"),
				file("D.zip.002"),
				file("D.7z.001"),
				file("D.7z.002"),
			],
			FIXED_TS,
		);

		expect(result?.map((item) => item.name)).toEqual([
			"(分卷) D.zip",
			"(分卷) D.7z",
		]);
	});

	it("非分卷文件保持原位（数字后缀但不是压缩包）", () => {
		const result = groupSplitArchives(
			[
				file("E.7z.001"),
				file("E.7z.002"),
				file("disc.001"),
				file("readme.txt"),
			],
			FIXED_TS,
		);

		expect(result?.map((item) => item.name)).toEqual([
			"disc.001",
			"readme.txt",
			"(分卷) E.7z",
		]);
	});

	it("同名 md 关联到分卷文件夹与普通文件，且 md 自身不出现在树里", () => {
		const result = groupSplitArchives(
			[
				file("F.7z.001"),
				file("F.7z.002"),
				file("F.7z.md", "md-F"),
				file("G.rar", "G-id"),
				file("G.md", "md-G"),
			],
			FIXED_TS,
		);

		expect(result).toHaveLength(2);
		const volumes = result?.find((item) => item.volumes);
		expect(volumes?.redame).toBe("md-F");
		const plain = result?.find((item) => item.name === "G.rar");
		expect(plain?.redame).toBe("md-G");
		expect(result?.some((item) => item.name.endsWith(".md"))).toBe(false);
	});

	it("递归整合子目录，且不重复包装已有分卷文件夹", () => {
		const nested = folder("子目录", [file("H.7z.001"), file("H.7z.002")]);
		const already = folder("(分卷) I.rar", [file("I.part1.rar")]);

		const result = groupSplitArchives([nested, already], FIXED_TS);

		expect(result?.map((item) => item.name)).toEqual([
			"子目录",
			"(分卷) I.rar",
		]);
		expect(result?.[0].children?.map((item) => item.name)).toEqual([
			"(分卷) H.7z",
		]);
		// 已包装的文件夹不再递归改写 children
		expect(result?.[1].children?.map((item) => item.name)).toEqual([
			"I.part1.rar",
		]);
	});

	it("空输入原样返回", () => {
		expect(groupSplitArchives(undefined)).toBeUndefined();
		expect(groupSplitArchives([])).toEqual([]);
	});
});
