import { defineRoute } from "@teyik0/furin";
import TaskListPage from "@web/components/admin/tasks/task-list-page";
import {
	TASK_SEARCH_DEFAULTS,
	type TaskSearch,
} from "@web/lib/admin/tasks/params";
import { taskSearchQuery } from "@web/lib/admin/tasks/params.typebox";
import { useShallowSearch } from "@web/lib/admin/use-shallow-search";
import { seoMeta } from "@web/lib/seo";
import { useCallback } from "react";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/**
 * 任务队列（等价旧 `routes/admin/_authL/tasks.tsx`）。
 *
 * URL 仍然是筛选/排序/分页/详情的真源（可分享、刷新还原）：旧 validateSearch 的
 * zod schema 原样搬进 `config.query` 撑起首次解析。但**页内交互不再走 furin 导航**：
 * 改筛选、翻页、开任务详情都只用 `useShallowSearch` 改写地址栏（replace），
 * 页面组件不重新请求、不重挂载，列表用 keepPreviousData 平滑过渡。
 * 旧实现里这类改动也是 `replace: true`，历史记录语义不变。
 */
export const route = defineRoute("/admin/tasks")
	.config({ mode: "ssr", query: taskSearchQuery as never })
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }))
	.page(({ query }) => (
		<TasksRoute initialSearch={withTaskSearchDefaults(query)} />
	));

/**
 * 补齐 TypeBox 查询参数里缺省的键。
 *
 * 路由的 query schema 是 TypeBox（为了把重复 key 聚合成数组、把 "true" 收敛成布尔），
 * 但它只给部分字段声明了 `default`：`range` / `sortBy` / `order` / `pageSize` /
 * `status` 等缺省时是 `undefined`，直接喂给 `toTaskListFilters()` 会算出 Invalid Date。
 * 这里用 zod 侧的单一默认值源补齐（深链只带部分参数时也能还原完整筛选）。
 */
function withTaskSearchDefaults(query: unknown): TaskSearch {
	return { ...TASK_SEARCH_DEFAULTS, ...(query as Partial<TaskSearch>) };
}

function TasksRoute({ initialSearch }: { initialSearch: TaskSearch }) {
	const [search, patchSearch] = useShallowSearch<TaskSearch>(
		initialSearch,
		TASK_SEARCH_DEFAULTS,
	);

	// 回调保持稳定：TaskListPage 的搜索防抖 / 页码纠偏 effect 依赖这些函数，
	// 每次渲染换新引用会让它们反复清定时器（浅层更新本来就会频繁重渲染）。
	const onPatch = useCallback(
		(patch: Partial<TaskSearch>) => {
			patchSearch({ ...patch, page: 1 });
		},
		[patchSearch],
	);

	const onPageChange = useCallback(
		(page: number) => {
			patchSearch({ page });
		},
		[patchSearch],
	);

	const onOpenDetail = useCallback(
		(jobId: string) => {
			patchSearch({ job: jobId });
		},
		[patchSearch],
	);

	const onCloseDetail = useCallback(() => {
		// job: undefined 会被 URL 序列化器丢弃，等价于从地址栏删掉这个键
		patchSearch({ job: undefined });
	}, [patchSearch]);

	return (
		<TaskListPage
			search={search}
			onPatch={onPatch}
			onOpenDetail={onOpenDetail}
			onCloseDetail={onCloseDetail}
			onPageChange={onPageChange}
		/>
	);
}

/**
 * 旧 `pendingComponent` 的骨架，保留但不接线路由（furin 没有 pending 阶段：
 * 导航是「取到数据才 commit」，只有 root 的 RouteLoadingIndicator 给全局反馈）。
 */
export function TaskRoutePending() {
	return (
		<div className="flex flex-col gap-4">
			<div className="h-9 w-40 bg-muted rounded-lg animate-pulse" />
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
				{Array.from({ length: 5 }).map((_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: 骨架卡无稳定 id
					<div
						key={index}
						className="h-20 bg-card rounded-2xl ring-1 ring-border/60"
					/>
				))}
			</div>
			<div className="h-96 bg-card rounded-2xl ring-1 ring-border/60" />
		</div>
	);
}
