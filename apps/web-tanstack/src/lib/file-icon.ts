import {
	FileArchive,
	FileAudio,
	FileCode,
	File as FileGeneric,
	FileImage,
	FileSpreadsheet,
	FileText,
	FileVideo,
	type LucideIcon,
} from "lucide-react";

/**
 * 文件类型图标映射：文件树（下载 tab）与下载弹窗共用同一套语义。
 *
 * 下载弹窗原本固定用压缩包图标（FileArchive）表示文件，文件树则所有文件都顶着
 * 同一个通用 File 图标；两处显示的其实是同一批文件，图标对不上会让「点开的是
 * 哪个文件」更难对应。这里把「按扩展名挑图标」抽成纯函数，文件树和弹窗都从这里取：
 * - 压缩包（含分卷 `*.7z.001` / `*.part1.rar`）→ FileArchive，与弹窗原有图标一致；
 * - 视频 / 音频 / 图片 / 文本 / 表格 / 代码各用对应图标；
 * - 认不出的扩展名回退到通用 File 图标（不用问号，避免像出错）。
 */

/** 扩展名分组表；同组多个扩展名共用一个图标 */
const FILE_TYPE_ICONS: ReadonlyArray<{
	icon: LucideIcon;
	exts: readonly string[];
}> = [
	{
		icon: FileArchive,
		exts: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "zst", "iso"],
	},
	{
		icon: FileVideo,
		exts: ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "rmvb"],
	},
	{
		icon: FileAudio,
		exts: ["mp3", "flac", "wav", "aac", "ogg", "m4a", "opus"],
	},
	{
		icon: FileImage,
		exts: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif"],
	},
	{ icon: FileText, exts: ["txt", "md", "pdf", "doc", "docx", "rtf", "srt"] },
	{ icon: FileSpreadsheet, exts: ["xls", "xlsx", "csv"] },
	{
		icon: FileCode,
		exts: [
			"json",
			"js",
			"ts",
			"tsx",
			"jsx",
			"html",
			"css",
			"xml",
			"yml",
			"yaml",
			"toml",
			"ini",
			"bat",
			"sh",
			"ps1",
		],
	},
];

const ICON_BY_EXT: Readonly<Record<string, LucideIcon>> = Object.fromEntries(
	FILE_TYPE_ICONS.flatMap(({ icon, exts }) => exts.map((ext) => [ext, icon])),
);

/**
 * 取用于判断类型的扩展名。
 *
 * 分卷文件的最后一段是纯数字序号（`A.7z.001` → `001`），此时应取上一段
 * （`7z`）才认得出压缩包；单段文件名没有扩展名，返回空串走回退分支。
 */
function extensionOf(name: string): string {
	const parts = name.toLowerCase().split(".");
	if (parts.length < 2) return "";

	const last = parts[parts.length - 1] ?? "";
	if (/^\d+$/.test(last) && parts.length >= 3) {
		return parts[parts.length - 2] ?? "";
	}
	return last;
}

/**
 * 按文件名挑文件图标。
 *
 * 优先从文件名解析扩展名（分卷 `.7z.001` 也能正确归类）；文件名没有扩展名时，
 * 再用服务端返回的 `format` 兜底（`TreeNode.format` 是 `split(".").pop()`，
 * 对分卷只会给出 `001`，所以只能当兜底）。
 */
export function getFileIcon(
	name: string | undefined,
	format?: string,
): LucideIcon {
	const ext = extensionOf(name ?? "") || (format ?? "").toLowerCase();
	return ICON_BY_EXT[ext] ?? FileGeneric;
}
