import {
	FileArchive,
	File as FileGeneric,
	FileImage,
	FileText,
	FileVideo,
} from "lucide-react";
import { describe, expect, it } from "vitest";
import { getFileIcon } from "./file-icon";

describe("getFileIcon", () => {
	it("压缩包复用下载弹窗的 FileArchive 图标", () => {
		expect(getFileIcon("游戏本体.zip")).toBe(FileArchive);
		expect(getFileIcon("游戏本体.7z")).toBe(FileArchive);
	});

	it("分卷文件按真实压缩包类型归类", () => {
		// 7-Zip 数字后缀分卷：最后一段是序号，应看上一段（7z）
		expect(getFileIcon("游戏本体.7z.001")).toBe(FileArchive);
		// WinRAR 新式分卷
		expect(getFileIcon("游戏本体.part1.rar")).toBe(FileArchive);
		// 整合后的分卷文件夹名
		expect(getFileIcon("(分卷) 游戏本体.7z")).toBe(FileArchive);
	});

	it("按扩展名区分视频 / 文本 / 图片", () => {
		expect(getFileIcon("op.mp4")).toBe(FileVideo);
		expect(getFileIcon("说明.txt")).toBe(FileText);
		expect(getFileIcon("封面.PNG")).toBe(FileImage);
	});

	it("没有扩展名时用服务端 format 兜底", () => {
		expect(getFileIcon("noext", "zip")).toBe(FileArchive);
	});

	it("认不出的类型回退到通用文件图标", () => {
		expect(getFileIcon("data.bin")).toBe(FileGeneric);
		expect(getFileIcon("noext")).toBe(FileGeneric);
		expect(getFileIcon(undefined)).toBe(FileGeneric);
	});
});
