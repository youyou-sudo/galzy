import type { QueryKey } from "@tanstack/react-query";

/**
 * 后台查询键单一来源。
 *
 * 结构统一为 ['admin', <资源>, <"list" | "detail" | ...>, ...]:
 * - 前缀（['admin', 'comments']）用于整域失效；
 * - 精确键用于列表筛选 / 详情。
 *
 * 路由预取（ensureQueryData）与组件内的 useQuery 必须共用同一份构造函数，
 * 否则预取写进缓存的键与读取键不一致，首屏会出现一次空列表回退。
 */

/** 单个筛选值：数组用于多选筛选（status/queue/type），整体参与 queryKey。 */
export type ListFilterValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| readonly (string | number)[];

export type ListFilters = Record<string, ListFilterValue>;

const root = ["admin"] as const;

export const adminKeys = {
	root,

	/* ── 内容管理 ─────────────────────────────────────────────── */
	dashboard: () => [...root, "dashboard"] as const,

	commentsRoot: () => [...root, "comments"] as const,
	comments: (filters: ListFilters) =>
		[...root, "comments", "list", filters] as const,

	articlesRoot: () => [...root, "articles"] as const,
	articles: (filters: ListFilters) =>
		[...root, "articles", "list", filters] as const,
	article: (articleId: string) =>
		[...root, "articles", "detail", articleId] as const,

	topicsRoot: () => [...root, "topics"] as const,
	topics: (filters: ListFilters) =>
		[...root, "topics", "list", filters] as const,

	collectionsRoot: () => [...root, "collections"] as const,
	collections: (filters: ListFilters) =>
		[...root, "collections", "list", filters] as const,

	friendLinksRoot: () => [...root, "friend-links"] as const,
	friendLinks: () => [...root, "friend-links", "list"] as const,

	/* ── 用户 ─────────────────────────────────────────────────── */
	usersRoot: () => [...root, "users"] as const,
	users: (filters: ListFilters) => [...root, "users", "list", filters] as const,

	/* ── 任务队列 ─────────────────────────────────────────────── */
	tasksRoot: () => [...root, "tasks"] as const,
	/** 任务列表键前缀：乐观更新/失效都按它批量命中所有分页与筛选组合。 */
	taskList: () => [...root, "tasks", "list"] as const,
	tasks: (filters: ListFilters) => [...root, "tasks", "list", filters] as const,
	taskStats: () => [...root, "tasks", "stats"] as const,
	taskQueues: () => [...root, "tasks", "queues"] as const,
	/** 队列/任务类型/状态的中文元数据（后端 /tasks/meta 为单一来源）。 */
	taskMeta: () => [...root, "tasks", "meta"] as const,
	taskLogs: (jobId: string) => [...root, "tasks", "logs", jobId] as const,
	taskDetail: (jobId: string) => [...root, "tasks", "detail", jobId] as const,
	/** 某队列的死信列表（与旧页面内联 key 保持同一形状）。 */
	taskDeadLetters: (queue: string) =>
		[...root, "tasks", "dead-letter", queue] as const,

	/* ── 外部同步 ─────────────────────────────────────────────── */
	vndbSyncRoot: () => [...root, "vndb-sync"] as const,
	vndbSyncProgress: () => [...root, "vndb-sync", "progress"] as const,
	vndbSyncCloudreve: () => [...root, "vndb-sync", "cloudreve"] as const,

	/* ── Meilisearch ─────────────────────────────────────────── */
	meiliRoot: () => [...root, "meili"] as const,
	meiliStats: () => [...root, "meili", "stats"] as const,
	meiliIndexes: (type: string) => [...root, "meili", "indexes", type] as const,
	meiliProperties: (type: string) =>
		[...root, "meili", "properties", type] as const,
	meiliSearchable: (type: string) =>
		[...root, "meili", "searchable", type] as const,
	meiliEmbedders: () => [...root, "meili", "embedders"] as const,
} as const;

/** 站点公开侧、需要被后台变更连带刷新的缓存键（不放在 admin 命名空间下）。 */
export const publicKeys = {
	friendLinks: ["friend-links"] as const,
	collections: () => ["collections"] as const,
} as const;

/** 列表接口统一字段：多数返回 { items, total }，评论返回 { comments, total }。 */
export const listFields = {
	items: "items",
	comments: "comments",
} as const;

/** 常用失效集合，避免每个页面重复拼。 */
export const invalidations = {
	comments: [adminKeys.commentsRoot()] as QueryKey[],
	articles: [adminKeys.articlesRoot(), adminKeys.dashboard()] as QueryKey[],
	topics: [adminKeys.topicsRoot(), adminKeys.dashboard()] as QueryKey[],
	collections: [
		adminKeys.collectionsRoot(),
		publicKeys.collections(),
		adminKeys.dashboard(),
	] as QueryKey[],
	users: [adminKeys.usersRoot(), adminKeys.dashboard()] as QueryKey[],
	friendLinks: [
		adminKeys.friendLinksRoot(),
		publicKeys.friendLinks,
	] as QueryKey[],
	tasks: [
		adminKeys.tasksRoot(),
		adminKeys.taskStats(),
		adminKeys.taskQueues(),
		adminKeys.dashboard(),
	] as QueryKey[],
	meili: [adminKeys.meiliRoot()] as QueryKey[],
	vndbSync: [adminKeys.vndbSyncRoot()] as QueryKey[],
};
