import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * 后台乐观更新的缓存原语。
 *
 * 后台所有列表接口都返回「一个对象包着数组 + 总数」，只是字段名不同
 * （多数是 items，评论是 comments）。这里把「改一条 / 删一条 / 插一条」
 * 收敛成三个纯函数，页面只需给出列表字段名，不必关心分页包装结构。
 *
 * 约定：
 * - 所有函数都通过 setQueriesData 按「键前缀」批量命中（分页+filters 会有多份缓存）；
 * - 只有内容真的变了才返回新对象，否则原样返回，避免无意义的重渲染；
 * - total / totalPages 同步增减，保证乐观更新后分页脚不跳。
 */

type ListCache = Record<string, unknown> & { total?: number };

function isRecord(value: unknown): value is ListCache {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function syncCount(cache: ListCache, delta: number): ListCache {
	const next: ListCache = { ...cache };
	if (typeof cache.total === "number") {
		next.total = Math.max(0, cache.total + delta);
	}
	if (typeof cache.totalPages === "number") {
		next.totalPages = Math.max(1, cache.totalPages);
	}
	return next;
}

/**
 * 逐条改写列表项。patch 返回 null 表示从列表中移除该条。
 * @returns 命中的缓存条数（便于调试，不影响调用方）
 */
export function patchListItems<T>(
	queryClient: QueryClient,
	queryKey: QueryKey,
	field: string,
	patch: (item: T) => T | null,
): number {
	let hits = 0;
	queryClient.setQueriesData({ queryKey }, (old: unknown) => {
		if (!isRecord(old)) return old;
		const list = old[field];
		if (!Array.isArray(list)) return old;

		let changed = false;
		let removed = 0;
		const nextList: unknown[] = [];
		for (const item of list as T[]) {
			const patched = patch(item);
			if (patched === null) {
				changed = true;
				removed += 1;
				continue;
			}
			if (patched !== item) changed = true;
			nextList.push(patched);
		}
		if (!changed) return old;

		hits += 1;
		return syncCount({ ...old, [field]: nextList }, -removed);
	});
	return hits;
}

/** 从列表移除满足条件的项（乐观删除）。 */
export function removeListItems<T>(
	queryClient: QueryClient,
	queryKey: QueryKey,
	field: string,
	predicate: (item: T) => boolean,
): number {
	return patchListItems<T>(queryClient, queryKey, field, (item) =>
		predicate(item) ? null : item,
	);
}

/** 在列表头部插入一条（乐观新增）。 */
export function prependListItem<T>(
	queryClient: QueryClient,
	queryKey: QueryKey,
	field: string,
	item: T,
): number {
	let hits = 0;
	queryClient.setQueriesData({ queryKey }, (old: unknown) => {
		if (!isRecord(old)) return old;
		const list = old[field];
		if (!Array.isArray(list)) return old;
		hits += 1;
		return syncCount({ ...old, [field]: [item, ...list] }, 1);
	});
	return hits;
}

/**
 * 记录多组查询的当前快照，用于失败回滚。
 * 只对「存在数据」的条目拍快照，回滚时写回即可。
 */
export type QuerySnapshot = Array<[QueryKey, unknown]>;

export function snapshotQueries(
	queryClient: QueryClient,
	queryKeys: QueryKey[],
): QuerySnapshot {
	const snapshot: QuerySnapshot = [];
	for (const queryKey of queryKeys) {
		for (const entry of queryClient.getQueriesData({ queryKey })) {
			if (entry[1] !== undefined) snapshot.push(entry);
		}
	}
	return snapshot;
}

export function restoreSnapshot(
	queryClient: QueryClient,
	snapshot: QuerySnapshot | undefined,
): void {
	if (!snapshot) return;
	for (const [queryKey, data] of snapshot) {
		queryClient.setQueryData(queryKey, data);
	}
}

/**
 * 乐观更新的标准开场：先取消在途请求，再改缓存。
 * 不取消的话，一个 already-in-flight 的 GET 返回后会把乐观结果盖掉。
 */
export async function prepareOptimistic(
	queryClient: QueryClient,
	queryKeys: QueryKey[],
): Promise<void> {
	await Promise.all(
		queryKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
	);
}

/** 把 ISO 时间串转成相对时间（任务页 / 列表的「3 分钟前」）。 */
export function formatRelativeTime(
	input: string | number | Date | null | undefined,
): string {
	if (!input) return "-";
	const date = input instanceof Date ? input : new Date(input);
	const diff = Date.now() - date.getTime();
	if (Number.isNaN(diff)) return "-";
	if (diff < 0) return "刚刚";
	const seconds = Math.floor(diff / 1000);
	if (seconds < 10) return "刚刚";
	if (seconds < 60) return `${seconds} 秒前`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} 分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} 小时前`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} 天前`;
	return date.toLocaleDateString("zh-CN");
}

/** 时长（毫秒）→ 人类可读，用于任务耗时列。 */
export function formatDuration(
	startedAt: string | null | undefined,
	finishedAt: string | null | undefined,
): string {
	if (!startedAt) return "-";
	const start = new Date(startedAt).getTime();
	const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
	const ms = end - start;
	if (!Number.isFinite(ms) || ms < 0) return "-";
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.round(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const restSeconds = seconds % 60;
	if (minutes < 60) return `${minutes}m ${restSeconds}s`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${minutes % 60}m`;
}
