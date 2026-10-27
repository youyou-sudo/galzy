import * as z from "zod/mini";

/**
 * 任务列表的 URL 搜索参数（单一事实来源）。
 *
 * 为什么放在 lib 而不是路由里：
 * - 路由 loaderDeps、页面 useQuery、预取快路径共用同一份映射函数，
 *   否则「URL 默认值 → API 参数」会各写一遍并逐渐漂移；
 * - zod/mini 的 `z._default` 管「键缺失」，`z.catch` 管「键存在但非法」，
 *   两者必须成对出现：只写 _default 的话，用户手改 URL 会让整页 500。
 *
 * 注意 TanStack Router 的默认 search 解析器（qss decode）会把
 * `?page=2` 解析成数字、把重复 key 解析成数组、把 JSON 数组反序列化，
 * 因此这里对「数字 / 字符串」两种形态都做兼容，最后统一归一化。
 */

/* ────────────────────────────── 枚举常量 ────────────────────────────── */

/** 任务状态白名单（与后端 TaskStatus 契约一致）。 */
export const TASK_STATUS_KEYS = [
	"queued",
	"running",
	"completed",
	"failed",
	"dead-letter",
	"interrupted",
] as const;

export type TaskStatus = (typeof TASK_STATUS_KEYS)[number];

/** 可排序列白名单（后端白名单之外的列会被拒绝）。 */
export const TASK_SORT_FIELDS = [
	"createdAt",
	"startedAt",
	"finishedAt",
	"status",
	"type",
] as const;

export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export const TASK_ORDER_KEYS = ["asc", "desc"] as const;

export type TaskOrder = (typeof TASK_ORDER_KEYS)[number];

/** 每页条数（与 DataTablePagination 的选项、后端上限 100 对齐）。 */
export const TASK_PAGE_SIZES = ["10", "20", "50", "100"] as const;

export type TaskPageSize = (typeof TASK_PAGE_SIZES)[number];

/** 时间范围快捷筛选：`all` 表示不限。 */
export const TASK_RANGE_KEYS = ["all", "today", "7d", "30d"] as const;

export type TaskRange = (typeof TASK_RANGE_KEYS)[number];

/** 时间范围 → 自然日天数（`all` 不在此表）。 */
const RANGE_DAYS: Record<Exclude<TaskRange, "all">, number> = {
	today: 1,
	"7d": 7,
	"30d": 30,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/* ────────────────────────────── 基础 schema ────────────────────────────── */

/** 单值或数组统一成数组；非白名单值逐项丢弃（手改 URL 不至于整页报错）。 */
function enumListSchema<const T extends readonly [string, ...string[]]>(
	values: T,
) {
	const allowed = new Set<string>(values);
	return z.pipe(
		z.pipe(
			// 先用 unknown 承接（数组/标量/脏值），在 transform 里逐项过滤；
			// 直接 union 枚举数组会让「一个非法值」导致整组被 catch 丢成 []
			z.union([z.array(z.unknown()), z.unknown()]),
			z.transform((input): T[number][] => {
				const list = Array.isArray(input) ? input : [input];
				return list.filter(
					(item): item is T[number] =>
						typeof item === "string" && allowed.has(item),
				);
			}),
		),
		z.array(z.enum(values)),
	);
}

/** 任意字符串的单值/数组统一成字符串数组，顺带去掉空白项。 */
function stringListSchema() {
	return z.pipe(
		z.pipe(
			z.union([z.array(z.unknown()), z.unknown()]),
			z.transform((input) => {
				const list = Array.isArray(input) ? input : [input];
				return list
					.filter((item): item is string => typeof item === "string")
					.map((item) => item.trim())
					.filter((item) => item.length > 0);
			}),
		),
		z.array(z.string()),
	);
}

/** 数字或数字字符串 → 正整数（URL 解析器会把 `?page=2` 变成 number）。 */
function positiveIntSchema() {
	return z.pipe(
		z.pipe(
			z.union([z.number(), z.string()]),
			z.transform((input) => Number(input)),
		),
		z.int().check(z.minimum(1)),
	);
}

/** pageSize 在 URL 里可能是字符串也可能是数字，统一收敛成字符串枚举。 */
function pageSizeSchema() {
	return z.pipe(
		z.pipe(
			z.union([z.enum(TASK_PAGE_SIZES), z.number()]),
			z.transform((input) => String(input)),
		),
		z.enum(TASK_PAGE_SIZES),
	);
}

/* ────────────────────────────── 搜索参数 ────────────────────────────── */

export const taskSearchSchema = z.object({
	/** 关键字（id / type / error 子串，后端契约） */
	q: z._default(z.catch(z.string(), ""), ""),
	/** 多状态筛选（URL 重复 key 或 JSON 数组） */
	status: z._default(z.catch(enumListSchema(TASK_STATUS_KEYS), []), []),
	/** 多队列筛选 */
	queue: z._default(z.catch(stringListSchema(), []), []),
	/** 多任务类型筛选 */
	type: z._default(z.catch(stringListSchema(), []), []),
	/** 时间范围快捷筛选 */
	range: z._default(z.catch(z.enum(TASK_RANGE_KEYS), "all"), "all"),
	/** 只看已逾期 */
	overdue: z._default(z.catch(z.boolean(), false), false),
	/** 只看可重试（失败 / 中断 / 死信） */
	retryable: z._default(z.catch(z.boolean(), false), false),
	/** 排序字段 */
	sortBy: z._default(
		z.catch(z.enum(TASK_SORT_FIELDS), "createdAt"),
		"createdAt",
	),
	/** 排序方向 */
	order: z._default(z.catch(z.enum(TASK_ORDER_KEYS), "desc"), "desc"),
	/** 1 基页码 */
	page: z._default(z.catch(positiveIntSchema(), 1), 1),
	/** 每页条数（字符串枚举，方便 Select 直接受控） */
	pageSize: z._default(z.catch(pageSizeSchema(), "20"), "20"),
	/** 详情抽屉要打开的任务 id（不参与列表请求） */
	job: z.optional(z.catch(z.string(), "")),
});

export type TaskSearch = z.infer<typeof taskSearchSchema>;

/**
 * 默认值（供 `stripSearchParams` 剥离冗余 query）。
 * 必须与 schema 的默认值逐键一致，且数组只需同内容（deepEqual 比较）。
 */
export const TASK_SEARCH_DEFAULTS: TaskSearch = {
	q: "",
	status: [],
	queue: [],
	type: [],
	range: "all",
	overdue: false,
	retryable: false,
	sortBy: "createdAt",
	order: "desc",
	page: 1,
	pageSize: "20",
};

/* ────────────────────────────── API filters ────────────────────────────── */

/**
 * 归一化后的任务列表过滤条件（同时用作 React Query 的 queryKey 载荷）。
 *
 * 约定：
 * - 可选字段为 undefined 时**直接不写这个键**，避免 queryKey 里出现
 *   一堆 undefined 造成不同对象却语义相同的缓存碎片；
 * - 数组一律排序 + 去重，`?status=a&status=b` 与 `?status=b&status=a`
 *   必须命中同一份缓存。
 */
export type TaskListFilters = {
	q?: string;
	statuses?: TaskStatus[];
	queues?: string[];
	types?: string[];
	dateFrom?: string;
	dateTo?: string;
	overdue?: boolean;
	retryable?: boolean;
	sort: TaskSortField;
	order: TaskOrder;
	pageIndex: number;
	pageSize: number;
};

/* ────────────────────────────── 工具函数 ────────────────────────────── */

function normalizeList<T extends string>(values: readonly T[]): T[] {
	return [...new Set(values)].sort() as T[];
}

/** 站点面向国内用户，自然日按东八区切（中国无夏令时，固定偏移即可）。 */
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 东八区自然日零点（返回 UTC 时间戳）。
 *
 * 为什么不直接按服务器/浏览器本地时区：SSR（多为 UTC）与浏览器（+08:00）
 * 会算出不同的 dateFrom，queryKey 因此对不上，首屏必然多一次请求。
 * 固定 +08:00 既符合国内用户的「今天」语义，又保证两端完全一致。
 */
function startOfChinaDay(date: Date): Date {
	const shifted = new Date(date.getTime() + CHINA_OFFSET_MS);
	const utcMidnight = Date.UTC(
		shifted.getUTCFullYear(),
		shifted.getUTCMonth(),
		shifted.getUTCDate(),
	);
	return new Date(utcMidnight - CHINA_OFFSET_MS);
}

/**
 * 快捷时间范围 → 绝对时间（半开区间）。
 *
 * 锚点取「东八区自然日」而非 `now - 7 * 24h`：否则每次渲染都会得到不同的
 * ISO 串，queryKey 每毫秒都在变，预取与缓存全部击穿。自然日锚点让同一个
 * 筛选在同一天内保持稳定。
 */
export function rangeToDateRange(
	range: TaskRange,
	now: Date = new Date(),
): { dateFrom?: string; dateTo?: string } {
	if (range === "all") return {};
	const days = RANGE_DAYS[range];
	const end = startOfChinaDay(now);
	const start = new Date(end.getTime() - (days - 1) * DAY_MS);
	return {
		dateFrom: start.toISOString(),
		// 半开区间：明天零点 = 覆盖今天全天
		dateTo: new Date(end.getTime() + DAY_MS).toISOString(),
	};
}

/**
 * 搜索参数 → API 过滤条件（唯一映射函数）。
 *
 * @param search 已通过 `taskSearchSchema` 校验的 URL 参数
 * @param now 时间范围锚点（测试可注入固定时间）
 */
export function toTaskListFilters(
	search: TaskSearch,
	now: Date = new Date(),
): TaskListFilters {
	const filters: TaskListFilters = {
		sort: search.sortBy,
		order: search.order,
		pageIndex: search.page - 1,
		pageSize: Number(search.pageSize),
	};

	const q = search.q.trim();
	if (q) filters.q = q;

	const statuses = normalizeList(search.status);
	if (statuses.length > 0) filters.statuses = statuses;

	const queues = normalizeList(search.queue);
	if (queues.length > 0) filters.queues = queues;

	const types = normalizeList(search.type);
	if (types.length > 0) filters.types = types;

	const { dateFrom, dateTo } = rangeToDateRange(search.range, now);
	if (dateFrom) filters.dateFrom = dateFrom;
	if (dateTo) filters.dateTo = dateTo;

	// 布尔筛选只有「开启」有意义，false 视为不限，不写进 key
	if (search.overdue) filters.overdue = true;
	if (search.retryable) filters.retryable = true;

	return filters;
}

/** 默认筛选条件（路由 loader 无 search 时的兜底）。 */
export const DEFAULT_TASK_LIST_FILTERS: TaskListFilters = toTaskListFilters(
	TASK_SEARCH_DEFAULTS,
	new Date(0),
);
