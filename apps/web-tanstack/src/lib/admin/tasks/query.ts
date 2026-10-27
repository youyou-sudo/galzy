import { queryOptions } from "@tanstack/react-query";
import { adminKeys } from "@web/lib/admin/query-keys";
import { getQueueStats, getTaskMeta, listTasks } from "@web/server/admin/tasks";
import type { TaskListFilters } from "./params";

/**
 * 任务列表查询选项（路由 loader 预取与组件 useQuery 的唯一来源）。
 *
 * 为什么必须共用：`adminKeys.tasks(filters)` 把整个 filters 对象塞进
 * queryKey，如果 loader 和组件各自拼参数，哪怕只差一个 undefined 键，
 * 缓存就会落两份，首屏出现「先空列表、后跳数据」的闪回。
 *
 * staleTime 与全局默认 30s 对齐：预取后 30s 内切页/切回列表纯缓存命中；
 * 页面自己的实时刷新由 `refetchInterval` 覆盖（不写在这里，避免统计卡
 * 与列表被同一个轮询节奏绑死）。
 */

/** 列表请求的过期时间（毫秒）。 */
export const TASK_LIST_STALE_TIME = 30_000;

/** 过滤条件 → server fn 入参（字段名与后端 query 参数一一对应）。 */
function toListTasksData(filters: TaskListFilters) {
	return {
		q: filters.q,
		statuses: filters.statuses,
		queues: filters.queues,
		types: filters.types,
		dateFrom: filters.dateFrom,
		dateTo: filters.dateTo,
		overdue: filters.overdue,
		retryable: filters.retryable,
		sort: filters.sort,
		order: filters.order,
		pageIndex: filters.pageIndex,
		pageSize: filters.pageSize,
		// 列表页需要 counts 驱动状态 Tabs 徽标，一次请求拿全
		withCounts: true,
	};
}

/** 任务列表 queryOptions。 */
export function tasksQueryOptions(filters: TaskListFilters) {
	return queryOptions({
		queryKey: adminKeys.tasks(filters),
		queryFn: () => listTasks({ data: toListTasksData(filters) }),
		staleTime: TASK_LIST_STALE_TIME,
	});
}

/**
 * 任务字典（队列 / 类型 / 状态）：变更频率极低，独立缓存 5 分钟。
 *
 * 走 queryOptions 而不是页面里内联 useQuery 的原因：路由 loader 可以预取它，
 * 页面里只负责 isPending → 骨架/「加载中…」。字段缺失时筛选器会退化成空菜单，
 * 那是「加载中」而不是「没有队列」，所以必须由 isPending 区分。
 */
export function taskMetaQueryOptions() {
	return queryOptions({
		queryKey: adminKeys.taskMeta(),
		queryFn: () => getTaskMeta(),
		staleTime: 5 * 60_000,
	});
}

/**
 * 队列实时计数。轮询节奏由页面给（0 = 暂停），且后台标签页不轮询 ——
 * 5 个队列的 Redis 计数虽然做了并发，也没必要在用户看不见时一直拉。
 */
export function taskQueuesQueryOptions(refetchIntervalMs: number) {
	return queryOptions({
		queryKey: adminKeys.taskQueues(),
		queryFn: () => getQueueStats(),
		refetchInterval: refetchIntervalMs > 0 ? refetchIntervalMs : false,
		refetchIntervalInBackground: false,
		staleTime: 1_000,
	});
}
