import { defineRoute } from "@teyik0/furin";
import TaskListPage from "@web/components/admin/tasks/task-list-page";
import {
	type TaskSearch,
} from "@web/lib/admin/tasks/params";
import { taskSearchQuery } from "@web/lib/admin/tasks/params.typebox";
import { useNavigate } from "@web/lib/nav";
import { seoMeta } from "@web/lib/seo";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/**
 * 任务队列（等价旧 `routes/admin/_authL/tasks.tsx`）。
 *
 * URL 仍然是筛选/排序/分页/详情的唯一真源：旧 validateSearch 的 zod schema
 * 原样搬进 `config.query`，旧 `Route.useSearch/useNavigate` 换成页面 props 的
 * `query` + @web/lib/nav 的 useNavigate（compat 层强制 `to`，这里显式给全路径）。
 *
 * 与旧实现的差异（均为 furin 机制缺失，不是业务改动）：
 * - `stripSearchParams`：furin 导航时用 schema 默认值做 deepEqual 剥离，不需要中间件；
 * - `loaderDeps + loader` 的「客户端预热」：SSR 不会 await 预取，页面靠 TaskListPage
 *   内部的 useQuery 骨架态加载（旧实现也只在客户端预热）；
 * - `pendingComponent`：无对应机制，TaskRoutePending 骨架保留但不再当作整页 pending；
 * - `errorComponent`：无对应机制，失败落到最近的 pages/error.tsx。
 */
export const route = defineRoute("/admin/tasks")
	.config({ mode: "ssr", query: taskSearchQuery as never })
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }) as never)
	.page(({ query }) => <TasksRoute search={query as TaskSearch} />);

function TasksRoute({ search }: { search: TaskSearch }) {
	const navigate = useNavigate();

	/** 改筛选：回第 1 页；用 replace 避免每次微调都产生一条历史记录。 */
	const onPatch = (patch: Partial<TaskSearch>) => {
		void navigate({
			to: "/admin/tasks",
			search: { ...search, ...patch, page: 1 },
			replace: true,
			resetScroll: false,
		});
	};

	const onPageChange = (page: number) => {
		void navigate({
			to: "/admin/tasks",
			search: { ...search, page },
			resetScroll: false,
		});
	};

	const onOpenDetail = (jobId: string) => {
		void navigate({
			to: "/admin/tasks",
			search: { ...search, job: jobId },
			resetScroll: false,
		});
	};

	const onCloseDetail = () => {
		// job: undefined 会被 search 序列化器丢弃，等价于从 URL 删掉这个键
		void navigate({
			to: "/admin/tasks",
			search: { ...search, job: undefined },
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
