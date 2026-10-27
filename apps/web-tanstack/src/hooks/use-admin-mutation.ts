import {
	type QueryKey,
	useMutation,
	useMutationState,
	useQueryClient,
} from "@tanstack/react-query";
import {
	prepareOptimistic,
	restoreSnapshot,
	snapshotQueries,
} from "@web/lib/admin/optimistic";
import { toast } from "sonner";

/**
 * 后台写操作统一入口：乐观更新 + 失败回滚 + Toast + 定向失效。
 *
 * 为什么需要它：后台 7 个页面原先各写一遍
 * `const [loading, setLoading] = useState(false); await fn(); toast(); refetch();`
 * —— 按钮转圈、整表刷新、筛选条件被打回，是最影响体感的交互。
 * 这里固定成一个顺序：
 *
 *   cancelQueries → snapshot → optimistic(改缓存) → 请求
 *     ├ 成功：toast.success + onSuccess
 *     └ 失败：restoreSnapshot + toast.error（列表回到操作前）
 *   最终：invalidateQueries（用服务端真值校正乐观结果）
 *
 * @example
 * const publish = useAdminMutation({
 *   mutationFn: (id: string) => adminPublishArticle({ data: { id } }),
 *   affects: invalidations.articles,
 *   optimistic: (qc, id) =>
 *     patchListItems<AdminArticle>(qc, adminKeys.articlesRoot(), "items", (a) =>
 *       a.id === id ? { ...a, status: "published" } : a,
 *     ),
 *   successMessage: "文章已发布",
 * });
 */

export type AdminMutationOptions<TData, TVars> = {
	/** 真正的服务端调用 */
	mutationFn: (vars: TVars) => Promise<TData>;
	/** 乐观更新：直接改缓存。抛错会被当作失败回滚 */
	optimistic?: (
		queryClient: ReturnType<typeof useQueryClient>,
		vars: TVars,
	) => void;
	/** 需要回滚与失效的查询键前缀 */
	affects: QueryKey[];
	/** 成功提示；返回空串则不提示 */
	successMessage?: string | ((data: TData, vars: TVars) => string);
	errorMessage?: string | ((error: unknown) => string);
	onSuccess?: (data: TData, vars: TVars) => void;
	onError?: (error: unknown, vars: TVars) => void;
	/** 请求结束后是否用服务端数据校正（默认 true） */
	revalidate?: boolean;
	/** 关联的 mutationKey，用于跨组件的 pending 追踪 */
	mutationKey?: QueryKey;
};

type AdminMutationContext = {
	snapshot: ReturnType<typeof snapshotQueries>;
	vars: unknown;
};

function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "未知错误";
}

export function useAdminMutation<TData = unknown, TVars = void>(
	options: AdminMutationOptions<TData, TVars>,
) {
	const queryClient = useQueryClient();
	const {
		mutationFn,
		optimistic,
		affects,
		successMessage,
		errorMessage,
		onSuccess,
		onError,
		revalidate = true,
		mutationKey,
	} = options;

	return useMutation<TData, unknown, TVars, AdminMutationContext>({
		mutationKey,
		mutationFn: (vars) => mutationFn(vars),
		onMutate: async (vars) => {
			await prepareOptimistic(queryClient, affects);
			const snapshot = snapshotQueries(queryClient, affects);
			if (optimistic) {
				try {
					optimistic(queryClient, vars);
				} catch (error) {
					restoreSnapshot(queryClient, snapshot);
					throw error;
				}
			}
			return { snapshot, vars };
		},
		onError: (error, vars, context) => {
			restoreSnapshot(queryClient, context?.snapshot);
			const message =
				typeof errorMessage === "function"
					? errorMessage(error)
					: (errorMessage ?? `操作失败：${describeError(error)}`);
			if (message) toast.error(message);
			onError?.(error, vars);
		},
		onSuccess: (data, vars) => {
			const message =
				typeof successMessage === "function"
					? successMessage(data, vars)
					: successMessage;
			if (message) toast.success(message);
			onSuccess?.(data, vars);
		},
		onSettled: () => {
			// 失败时 onError 已回滚快照；这里只做真值校正，
			// 避免「乐观成功 → 拉回服务端旧值」的闪回。
			if (revalidate) {
				for (const queryKey of affects) {
					void queryClient.invalidateQueries({ queryKey });
				}
			}
		},
	});
}

/**
 * 追踪某个 mutationKey 下正在进行的变量，用于「这一行正在处理」的行内状态。
 * 后台同一页面会有多行同时操作，单靠 useMutation.isPending 只知道最后一次。
 */
export function usePendingMutationVars<TVars>(mutationKey: QueryKey): TVars[] {
	return useMutationState<TVars>({
		filters: { mutationKey, status: "pending" },
		select: (mutation) => mutation.state.variables as TVars,
	});
}
