/**
 * Kungal 同步面板的展示映射（纯数据 + 纯函数）。
 *
 * 单独成文件而不是放在页面组件里：页面组件会连带 import BFF / React 运行期，
 * 而这两张表和百分比计算是最值得单测的部分，拆开后测试不需要任何渲染环境。
 */

/** 阶段文案：与 API 侧 KungalSyncProgress['stage'] 一一对应。 */
export const KUNGAL_STAGE_LABELS: Record<string, string> = {
	resolve: "解析作品锚点",
	works: "同步作品",
	characters: "同步角色",
	walkthroughs: "同步攻略",
	cache: "刷新索引与 CDN",
};

/** 任务类型文案：与队列里的 kungal-* 任务类型对齐。 */
export const KUNGAL_TYPE_LABELS: Record<string, string> = {
	full: "全量同步",
	delta: "增量同步",
	characters: "角色同步",
	walkthroughs: "攻略同步",
};

/** 进度百分比：以作品条数为主；已完成恒 100，未开始恒 0。 */
export function kungalProgressPercent(
	progress:
		| {
				status: string;
				totalItems: number;
				processedItems: number;
		  }
		| null
		| undefined,
): number {
	if (!progress) return 0;
	if (progress.status === "completed") return 100;
	if (!progress.totalItems) return 0;
	return Math.min(
		100,
		Math.round((progress.processedItems / progress.totalItems) * 100),
	);
}

/** 阶段/类型未知时原样回显，便于暴露后端新增值（与仓库其它字典同一约定）。 */
export function kungalStageLabel(
	stage: string | null | undefined,
): string | null {
	if (!stage) return null;
	return KUNGAL_STAGE_LABELS[stage] ?? stage;
}

export function kungalTypeLabel(
	type: string | null | undefined,
): string | null {
	if (!type) return null;
	return KUNGAL_TYPE_LABELS[type] ?? type;
}
