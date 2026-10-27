import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import TaskListPage from "@web/components/admin/tasks/task-list-page";
import { EmptyState } from "@web/components/shared/empty-state";
import { Button } from "@web/components/ui/button";
import {
	TASK_SEARCH_DEFAULTS,
	type TaskSearch,
	taskSearchSchema,
	toTaskListFilters,
} from "@web/lib/admin/tasks/params";
import {
	taskMetaQueryOptions,
	tasksQueryOptions,
} from "@web/lib/admin/tasks/query";
import { ServerCrashIcon } from "lucide-react";

/**
 * 任务列表路由。
 *
 * 职责边界：
 * - validateSearch：URL 是筛选/排序/分页/详情的唯一真源（刷新、分享、后退都靠它）；
 * - stripSearchParams：把等于默认值的键从 URL 删掉，默认视图永远是 /admin/tasks；
 * - loaderDeps + loader：用与组件**同一个** tasksQueryOptions 预取，避免首屏空列表回退；
 * - 组件只收到 search 与几个导航回调，不直接依赖路由对象（可单测）。
 *
 * 注意：不要在此处再写一份 filters 字面量。预取键一旦与组件键不一致，
 * 首屏就会先渲染空列表再跳一次数据（重构前的 DEFAULT_FILTERS 就是这个问题）。
 */
export const Route = createFileRoute("/admin/_authL/tasks")({
	validateSearch: taskSearchSchema,
	search: {
		middlewares: [stripSearchParams(TASK_SEARCH_DEFAULTS)],
	},
	loaderDeps: ({ search }) => toTaskListFilters(search),
	loader: async ({ deps, context }) => {
		// 只在客户端预热，且不阻塞渲染：
		// 1) admin 页是登录后页面 + noindex，SSR 里预取的数据无法复用到浏览器进程，
		//    只会让首屏干等 API（慢一点就是白屏，连骨架都没有）；
		// 2) 客户端不 await，页面立刻渲染 React Query 的骨架/「加载中…」，
		//    数据到达后原地替换 —— 这才是「有加载态」的体验；
		// 3) 预取仍然有价值：hover/intent 预加载、以及筛选切换时的缓存命中。
		if (typeof window !== "undefined") {
			void context.queryClient
				.ensureQueryData(tasksQueryOptions(deps))
				.catch(() => undefined);
			void context.queryClient
				.ensureQueryData(taskMetaQueryOptions())
				.catch(() => undefined);
		}
		return null;
	},
	errorComponent: TaskRouteError,
	pendingComponent: TaskRoutePending,
	component: TaskRouteComponent,
});

function TaskRouteComponent() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	/** 改筛选：回第 1 页；用 replace 避免每次微调都产生一条历史记录。 */
	const onPatch = (patch: Partial<TaskSearch>) => {
		void navigate({
			search: (previous) => ({ ...previous, ...patch, page: 1 }),
			replace: true,
			resetScroll: false,
		});
	};

	const onPageChange = (page: number) => {
		void navigate({
			search: (previous) => ({ ...previous, page }),
			resetScroll: false,
		});
	};

	const onOpenDetail = (jobId: string) => {
		void navigate({
			search: (previous) => ({ ...previous, job: jobId }),
			resetScroll: false,
		});
	};

	const onCloseDetail = () => {
		void navigate({
			search: (previous) => ({ ...previous, job: undefined }),
			replace: true,
			resetScroll: false,
		});
	};

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

function TaskRoutePending() {
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

function TaskRouteError({ error }: { error: unknown }) {
	const message =
		error instanceof Error ? error.message : "任务页加载失败，请稍后重试";
	return (
		<EmptyState
			icon={ServerCrashIcon}
			title="任务页加载失败"
			description={message}
			surface
			action={
				<Button
					variant="outline"
					size="sm"
					onClick={() => window.location.reload()}
				>
					重新加载
				</Button>
			}
		/>
	);
}
