import type { GameModel } from "@api/modules/games/model";
import { groupSplitArchives } from "./split-archives";

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
