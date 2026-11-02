import { useAdminMutation } from "@web/hooks/use-admin-mutation";
import { patchListItems, removeListItems } from "@web/lib/admin/optimistic";
import { adminKeys, invalidations } from "@web/lib/admin/query-keys";
import {
	type BatchDeleteResult,
	type BatchOperationResult,
	batchDeleteTasks,
	batchRemoveDeadLetters,
	batchRepublishDeadLetters,
	batchRetryTasks,
	type DeleteTaskResult,
	deleteTask,
	type RetryTaskResult,
	retryTask,
	type TaskListItem,
} from "@web/server/admin/tasks";

/**
 * 任务队列的写操作 hooks。
 *
 * 统一走 `useAdminMutation`：cancel → snapshot → 乐观改缓存 → 请求
 * → 失败回滚 → 成功后按 `invalidations.tasks` 校正真值。
 *
 * 批量操作**不做逐条乐观删除**：部分成功时先删再拉回会造成列表闪烁，
 * 反而比「等一次真值刷新」更慢；这里只在 onSettled 后整体失效。
 */

/** 每个 hook 可覆盖提示文案 / 成功回调（详情抽屉关闭、清空选择等 UI 行为）。 */
export type TaskMutationOptions<TData, TVars> = {
	successMessage?: string | ((data: TData, vars: TVars) => string);
	onSuccess?: (data: TData, vars: TVars) => void;
};

/** 任务相关 mutationKey（配合 usePendingMutationVars 做行内 pending 标记）。 */
export const taskMutationKeys = {
	retry: [...adminKeys.tasksRoot(), "mutate", "retry"] as const,
	delete: [...adminKeys.tasksRoot(), "mutate", "delete"] as const,
	batchRetry: [...adminKeys.tasksRoot(), "mutate", "batch-retry"] as const,
	batchDelete: [...adminKeys.tasksRoot(), "mutate", "batch-delete"] as const,
	batchRepublish: [
		...adminKeys.tasksRoot(),
		"mutate",
		"dead-letter",
		"republish",
	] as const,
	batchRemove: [
		...adminKeys.tasksRoot(),
		"mutate",
		"dead-letter",
		"remove",
	] as const,
} as const;

/** 单条重试：乐观把行改成 queued，失败回滚。 */
export function useRetryTask(
	options: TaskMutationOptions<RetryTaskResult, { id: string }> = {},
) {
	return useAdminMutation<RetryTaskResult, { id: string }>({
		mutationKey: taskMutationKeys.retry,
		mutationFn: ({ id }) => retryTask({ data: { jobId: id } }),
		affects: invalidations.tasks,
		optimistic: (queryClient, { id }) => {
			patchListItems<TaskListItem>(
				queryClient,
				adminKeys.taskList(),
				"items",
				(row) =>
					row.id === id
						? {
								...row,
								status: "queued",
								progress: 0,
								error: null,
								startedAt: null,
								finishedAt: null,
							}
						: row,
			);
		},
		successMessage: options.successMessage ?? "已重新入队",
		onSuccess: options.onSuccess,
	});
}

/** 单条删除：乐观从所有分页缓存里移除。 */
export function useDeleteTask(
	options: TaskMutationOptions<DeleteTaskResult, { id: string }> = {},
) {
	return useAdminMutation<DeleteTaskResult, { id: string }>({
		mutationKey: taskMutationKeys.delete,
		mutationFn: ({ id }) => deleteTask({ data: { jobId: id } }),
		affects: invalidations.tasks,
		optimistic: (queryClient, { id }) => {
			removeListItems<TaskListItem>(
				queryClient,
				adminKeys.taskList(),
				"items",
				(row) => row.id === id,
			);
		},
		successMessage: options.successMessage ?? "任务记录已删除",
		onSuccess: options.onSuccess,
	});
}

/** 批量重试（不做逐条乐观更新，成功后整体失效校正）。 */
export function useBatchRetry(
	options: TaskMutationOptions<BatchOperationResult, { ids: string[] }> = {},
) {
	return useAdminMutation<BatchOperationResult, { ids: string[] }>({
		mutationKey: taskMutationKeys.batchRetry,
		mutationFn: ({ ids }) => batchRetryTasks({ data: { ids } }),
		affects: invalidations.tasks,
		successMessage:
			options.successMessage ??
			((data) => `已重新入队 ${data.succeeded}/${data.requested} 个任务`),
		onSuccess: options.onSuccess,
	});
}

/** 批量删除（不做逐条乐观删除）。 */
export function useBatchDelete(
	options: TaskMutationOptions<BatchDeleteResult, { ids: string[] }> = {},
) {
	return useAdminMutation<BatchDeleteResult, { ids: string[] }>({
		mutationKey: taskMutationKeys.batchDelete,
		mutationFn: ({ ids }) => batchDeleteTasks({ data: { ids } }),
		affects: invalidations.tasks,
		successMessage:
			options.successMessage ??
			((data) =>
				data.failed.length > 0
					? `已删除 ${data.deleted}/${data.requested} 条，失败 ${data.failed.length} 条`
					: `已删除 ${data.deleted} 条任务记录`),
		onSuccess: options.onSuccess,
	});
}

/** 批量重放死信（不做逐条乐观删除）。 */
export function useBatchRepublish(
	options: TaskMutationOptions<
		BatchOperationResult,
		{ queue: string; jobIds: string[] }
	> = {},
) {
	return useAdminMutation<
		BatchOperationResult,
		{ queue: string; jobIds: string[] }
	>({
		mutationKey: taskMutationKeys.batchRepublish,
		mutationFn: ({ queue, jobIds }) =>
			batchRepublishDeadLetters({ data: { queue, jobIds } }),
		affects: invalidations.tasks,
		successMessage:
			options.successMessage ??
			((data) => `已重放 ${data.succeeded}/${data.requested} 条死信`),
		onSuccess: options.onSuccess,
	});
}

/** 批量丢弃死信（不做逐条乐观删除）。 */
export function useBatchRemove(
	options: TaskMutationOptions<
		BatchOperationResult,
		{ queue: string; jobIds: string[] }
	> = {},
) {
	return useAdminMutation<
		BatchOperationResult,
		{ queue: string; jobIds: string[] }
	>({
		mutationKey: taskMutationKeys.batchRemove,
		mutationFn: ({ queue, jobIds }) =>
			batchRemoveDeadLetters({ data: { queue, jobIds } }),
		affects: invalidations.tasks,
		successMessage:
			options.successMessage ??
			((data) => `已丢弃 ${data.succeeded}/${data.requested} 条死信`),
		onSuccess: options.onSuccess,
	});
}

/**
 * 死信处理合并入口（行内「重放 / 丢弃」共用一套 pending 状态）。
 *
 * 行操作通常只有一条，批量条是 N 条，两者语义完全一致，合并后页面只挂
 * 一个 mutation，pending 判断也不会因为两个 hook 各转各的圈。
 */
export function useBatchRepublishDeadLetter(
	options: TaskMutationOptions<
		BatchOperationResult,
		{ queue: string; jobIds: string[]; action: "republish" | "remove" }
	> = {},
) {
	return useAdminMutation<
		BatchOperationResult,
		{ queue: string; jobIds: string[]; action: "republish" | "remove" }
	>({
		mutationKey: taskMutationKeys.batchRepublish,
		mutationFn: ({ queue, jobIds, action }) =>
			action === "remove"
				? batchRemoveDeadLetters({ data: { queue, jobIds } })
				: batchRepublishDeadLetters({ data: { queue, jobIds } }),
		affects: invalidations.tasks,
		successMessage:
			options.successMessage ??
			((data, vars) =>
				vars.action === "remove"
					? `已丢弃 ${data.succeeded}/${data.requested} 条死信`
					: `已重放 ${data.succeeded}/${data.requested} 条死信`),
		onSuccess: options.onSuccess,
	});
}

/** 语义化别名，便于 UI 侧按「死信」命名阅读。 */
export const useBatchRepublishDeadLetters = useBatchRepublish;
export const useBatchRemoveDeadLetters = useBatchRemove;
