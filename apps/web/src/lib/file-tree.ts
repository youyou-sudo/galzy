import type { GameModel } from "@api/modules/games/model";
import { groupSplitArchives } from "./split-archives";

/**
 * 网盘目录名开头的锚点标记：`[vndb-v55370]` / `[kungal-X]` / `[other-xxx]`。
 * 同一个目录可能连续挂多个锚点（如 `[vndb-v21552][vndb-v22594] 突然恋人`），一并去掉。
 */
const ANCHOR_PREFIX_RE = /^(?:\s*\[(?:vndb|kungal|other)-[^\]]*\]\s*)+/i;

/**
 * 目录名去掉锚点前缀，只留文本名：`[vndb-v55370] 神様ちゅ～ず！` → `神様ちゅ～ず！`。
 * 纯展示用：节点 id（完整网盘路径）保持不变，下载/复制链接不受影响。
 */
export function displayFolderName(name: string): string {
	const stripped = name.replace(ANCHOR_PREFIX_RE, "").trim();
	// 名字本身就只有锚点（没有文本名）时保留原样，避免出现空标题
	return stripped || name;
}

/**
 * 下载页文件树的视图变换。
 *
 * 服务端按 `galrc_alistb.path` 的每条网盘目录各包一层「根文件夹」节点
 * （同一作品可能落在多个目录，见 apps/api/src/modules/cron/lib.ts 的
 * resolveAnchors 与 games/service.ts 的 OpenListFiles）。这些根节点只用来
 * 承载各自目录的子列表，并不是网盘里的真实层级：
 *
 * - 只有一条目录：去掉包装，直接展示目录内容（原行为，页面更简洁）；
 * - 有多条目录：保留每个根节点并默认展开 —— 只取第一条根节点时会漏掉
 *   其余目录里的全部文件。
 */
export function buildFileTreeView(items: GameModel.TreeNode[] | undefined): {
	items: GameModel.TreeNode[];
	defaultOpen: string[];
} {
	const roots = items ?? [];

	if (roots.length === 1 && roots[0].type === "folder") {
		return {
			items: groupSplitArchives(roots[0].children) ?? [],
			defaultOpen: [],
		};
	}

	return {
		items: groupSplitArchives(roots) ?? [],
		// 只有带子节点的根文件夹需要展开（空目录展开也没有内容）
		defaultOpen: roots
			.filter((item) => item.type === "folder" && item.children?.length)
			.map((item) => item.id),
	};
}
