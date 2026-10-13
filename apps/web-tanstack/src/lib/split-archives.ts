import type { GameModel } from "@api/modules/games/model";

/**
 * 分卷压缩包整合（文件树变换）。
 *
 * 把同一个压缩包的多个分卷收进一个 `(分卷) xxx.7z` 文件夹节点，展示与下载
 * 弹窗（分卷列表）都按整包处理；同时把同名的 `.md` 说明文件关联到节点
 * （`redame`）上，供弹窗内联渲染 readme。
 *
 * 支持的分卷命名：
 *   1. `name.part1.rar` / `name.part01.7z` —— WinRAR 新式分卷
 *   2. `name.7z.001` / `name.zip.001`     —— 7-Zip 数字后缀分卷（含 zip）
 *
 * 此前只认 `.partN` 一种写法，7-Zip 默认的 `.7z.001/.7z.002` 会被当成一堆
 * 互不相干的普通文件散落在文件树里（同一个包的分卷没有整合），因此这里补上
 * 数字后缀命名，并按序号排序保证 `.001` / `part1` 永远排在最前。
 */

type TreeNode = GameModel.TreeNode;

/** 单个分卷的识别结果 */
type VolumeMatch = {
	/** 分组键：同组分卷共享，形如 `xxx.rar` / `xxx.7z` */
	key: string;
	/** 分卷序号（`part1` / `.001` → 1），用于组内排序 */
	index: number;
};

/** WinRAR 新式分卷：name.part1.rar / name.part01.7z */
const PART_VOLUME_RE = /^(.*?)\.part(\d+)\.(rar|zip|7z)$/i;
/** 7-Zip 数字后缀分卷：name.7z.001 / name.zip.001（序号在扩展名之后） */
const NUMERIC_VOLUME_RE = /^(.*\.(?:rar|zip|7z))\.(\d+)$/i;
/** 分卷文件夹节点名前缀，用于避免二次包装 */
const VOLUME_FOLDER_PREFIX = "(分卷) ";

function matchVolume(name: string): VolumeMatch | null {
	const part = PART_VOLUME_RE.exec(name);
	if (part) return { key: `${part[1]}.${part[3]}`, index: Number(part[2]) };

	const numeric = NUMERIC_VOLUME_RE.exec(name);
	if (numeric) return { key: numeric[1], index: Number(numeric[2]) };

	return null;
}

const isMarkdown = (name: string) => /\.md$/i.test(name);

/**
 * 递归整合分卷压缩包。会就地改写传入节点的 `children` / `redame`
 * （沿用既有行为，调用方用 useMemo 缓存即可）。
 *
 * @param timestamp 分卷文件夹 id 的时间戳，测试可注入固定值以获得稳定 id
 */
export function groupSplitArchives(
	items: TreeNode[] | undefined,
	timestamp: number = Date.now(),
): TreeNode[] | undefined {
	if (!items || items.length === 0) return items;

	const others: TreeNode[] = [];
	const archivesMap = new Map<
		string,
		Array<{ index: number; node: TreeNode }>
	>();

	// 先整体扫描收集同名 md：readme 可能排在被关联文件之后，
	// 边遍历边收集会因目录顺序不同而漏关联。
	const mdMap: Record<string, string> = {}; // 去扩展名后的名字 -> 文件 id
	for (const item of items) {
		if (item.type !== "folder" && isMarkdown(item.name)) {
			mdMap[item.name.replace(/\.md$/i, "")] = item.id;
		}
	}

	for (const item of items) {
		if (item.type === "folder") {
			// 避免重复包装分卷文件夹
			if (!item.name.startsWith(VOLUME_FOLDER_PREFIX)) {
				item.children = groupSplitArchives(item.children ?? [], timestamp);
			}
			others.push(item);
			continue;
		}

		// md 文件本身不进文件树分支（由 readme 承载展示）
		if (isMarkdown(item.name)) continue;

		// 普通文件也检查同名 md
		const nameWithoutExt = item.name.replace(/\.[^/.]+$/, "");
		if (nameWithoutExt in mdMap) item.redame = mdMap[nameWithoutExt];

		const volume = matchVolume(item.name);
		if (!volume) {
			others.push(item);
			continue;
		}

		const group = archivesMap.get(volume.key) ?? [];
		group.push({ index: volume.index, node: item });
		archivesMap.set(volume.key, group);
	}

	const archiveFolders = [...archivesMap.entries()].map(([key, entries]) => ({
		id: `archive-${key}-${timestamp}`,
		// readme 可能按整包名（`xxx.7z.md`）或去扩展名（`xxx.md`）命名，两种都认
		redame: mdMap[key] ?? mdMap[key.replace(/\.(rar|zip|7z)$/i, "")],
		type: "folder" as const,
		name: `${VOLUME_FOLDER_PREFIX}${key}`,
		volumes: true,
		// 按分卷序号排序，保证解压入口（part1 / .001）排在最前
		children: entries
			.sort((a, b) => a.index - b.index)
			.map((entry) => entry.node),
	}));

	return [...others, ...archiveFolders];
}
