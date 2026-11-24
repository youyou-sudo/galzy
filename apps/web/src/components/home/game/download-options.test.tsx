// @vitest-environment jsdom
import type { GameModel } from "@api/modules/games/model";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileExplorer } from "./download-options";

/**
 * 服务端按 alistb.path 的每条网盘目录各返回一个「根文件夹」节点；
 * 同一作品落在多个目录时（如「生肉」和「汉化」两个文件夹），
 * 曾经只渲染第一条根节点里的文件，其余目录的内容整个丢失。
 */

const root = (
	path: string,
	children: GameModel.TreeNode[],
): GameModel.TreeNode => ({
	id: path,
	name: path.split("/").pop() ?? path,
	type: "folder",
	children,
});

const file = (name: string, id: string): GameModel.TreeNode => ({
	id,
	name,
	type: "file",
	size: "1024",
});

describe("FileExplorer", () => {
	it("多目录作品把所有目录里的文件都渲染出来", () => {
		const raw = root("/GalZY/[vndb-v55370] 生肉", [
			file(
				"【PC电脑端生肉】.rar",
				"/GalZY/[vndb-v55370] 生肉/【PC电脑端生肉】.rar",
			),
		]);
		const translated = root("/GalZY/[vndb-v55370] 中文", [
			file(
				"【PC电脑端中文】.rar",
				"/GalZY/[vndb-v55370] 中文/【PC电脑端中文】.rar",
			),
			file("【汉化补丁】.rar", "/GalZY/[vndb-v55370] 中文/【汉化补丁】.rar"),
		]);

		render(<FileExplorer items={[raw, translated]} onFileClick={() => {}} />);

		expect(screen.getByText("【PC电脑端生肉】.rar")).toBeTruthy();
		expect(screen.getByText("【PC电脑端中文】.rar")).toBeTruthy();
		expect(screen.getByText("【汉化补丁】.rar")).toBeTruthy();
	});

	it("单目录作品仍然去掉根包装，直接展示目录内容", () => {
		const only = root("/GalZY/[vndb-v1] 唯一", [
			file("game.rar", "/GalZY/[vndb-v1] 唯一/game.rar"),
		]);

		render(<FileExplorer items={[only]} onFileClick={() => {}} />);

		expect(screen.getByText("game.rar")).toBeTruthy();
		expect(screen.queryByText("[vndb-v1] 唯一")).toBeNull();
	});
});
