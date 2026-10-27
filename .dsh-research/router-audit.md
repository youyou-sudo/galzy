# 后台任务列表页重构 · 路由 / URL 状态与移动端现状审计

> 只读审计，未修改任何源码。所有结论附证据（文件:行号）。
> 审计对象：`apps/web-tanstack/src/components/admin/tasks-page.tsx`（1492 行 god component）及其路由 `apps/web-tanstack/src/routes/admin/_authL/tasks.tsx`。
> 目标：为「筛选 / 排序 / 分页 / 详情抽屉同步到 URL」给出本仓库可落地的写法，并列出移动端与 URL 状态现存坑。

---

## 0. 结论摘要（TL;DR）

1. **本仓库 validateSearch / loaderDeps / useSearch / useNavigate 已经是成熟惯例**：13 个路由声明 `validateSearch`、10 个声明 `loaderDeps`，统一使用 `zod/mini` + `z._default` + `z.catch` 双层兜底。新任务页不需要发明约定，对齐 `/games` 与 `/tags` 即可。
2. **任务页目前完全没有 URL 状态**：`status / queue / search / page / pageSize / selectedId / refresh` 全是组件内 `useState`（`tasks-page.tsx:840-852`），刷新即丢，也无法分享。
3. **默认值不会自动剥离**：路由未配置 `stringifySearch` / `search.middlewares`（`router.tsx:12-29` 无相关选项），默认序列化器只跳过 `undefined`（`qss.js:27`）。因此 `search: (prev) => ({...prev, tab})` 这类写法会把 schema 默认值一并写进 URL，仓库里已有既成噪声（`tags-page.tsx:70,92`、`user/index.tsx:213-217`）。
4. **推荐官方 `stripSearchParams` 中间件**（该版本已导出：`@tanstack/react-router/dist/esm/index.d.ts:1`），按「schema 默认值对象」自动剥离，无需自写 stringify。
5. **数组参数在本仓库尚无先例**：默认序列化把数组写成单键 JSON（`?status=%5B%22failed%22%5D`）；重复键 `?status=a&status=b` 也能读成数组（`qss.js:47-58`），但反向只输出 JSON 形式。建议统一 JSON 单键，禁止两套编码混用。
6. **移动端存在真实断点空洞（P0）**：`useIsMobile` 断点是 768（`hooks/use-mobile.ts:3`），但桌面详情栏用 `hidden lg:block`（1024，`tasks-page.tsx:1443`）。768–1023px（平板/小窗）下抽屉与详情栏都不显示，点击行没有任何反馈。

---

## 1. 版本与基础设施核实

| 项 | 版本 / 事实 | 证据 |
| --- | --- | --- |
| @tanstack/react-router | `^1.170.45`，bun.lock 锁定 **1.170.45** | `apps/web-tanstack/package.json:32`；`bun.lock:860` |
| @tanstack/router-core | **1.171.38**（序列化实现所在） | `bun.lock:878` |
| @tanstack/react-start | 1.169.3 | `apps/web-tanstack/package.json:35` |
| @tanstack/router-plugin | ^1.168.47，仅构建期启用、`autoCodeSplitting: true` | `apps/web-tanstack/package.json:91`；`vite.config.ts:192-196` |
| @tanstack/react-query | ^5.104.5；全局 `staleTime: 30_000`、`gcTime: 60_000` | `package.json:29`；`integrations/tanstack-query/root-provider.tsx:11-14` |
| zod | 4.6.7（根依赖），前端统一 `import * as z from "zod/mini"` | `package.json:40`；`routes/tags/index.tsx:21` |
| zod/mini API | `z.array / z.catch / z._default / z.enum / z.int / z.optional / z.string` 均为函数导出（已实测） | `node_modules/zod/v4/mini/index.js` |

### 1.1 Router 未做任何 search 级定制

`apps/web-tanstack/src/router.tsx:12-29` 只配置了 `scrollRestoration / defaultViewTransition / defaultPreload: "intent" / defaultPreloadStaleTime: 30_000 / defaultPendingMs: 60`，**没有** `parseSearch`、`stringifySearch`、`search.strict`、`search.middlewares`。

全仓 grep `stringifySearch|parseSearch|stripSearchParams|retainSearchParams` → **0 处使用**（两个中间件在本版本可用但未被使用）。

### 1.2 默认序列化器的真实行为（决定「默认值剥离」怎么做）

证据目录：`node_modules/.bun/@tanstack+router-core@1.171.38/node_modules/@tanstack/router-core/dist/esm/`

- `qss.js:27` — `encode` 只跳过 `undefined`：`if (val !== void 0) (result ||= new URLSearchParams()).set(key, stringify(val))`。→ `""`、`null`、默认值、数组都会写入 URL。
- `searchParams.js:47-73` — `stringifySearchWith(JSON.stringify, JSON.parse)`：对象/数组走 `JSON.stringify`（**单键**），可被 JSON 解析的字符串再转一次。
- `qss.js:47-58` — `decode` 把重复键合并为数组；`searchParams.js:20-40` 再对数组元素做 JSON 解析。→ 入：`?status=a&status=b` 与 `?status=["a","b"]` 都得到 `string[]`；出：只会输出 JSON 形式。
- `router.js:332-333` — 目标 search 解析：`middlewares ? applySearchMiddleware(...) : dest.search === true ? fromSearch() : typeof dest.search === "function" ? dest.search(fromSearch()) : dest.search || EMPTY_RECORD`，随后 `stringifySearch(nextSearch)`。→ **对象式 `search: {...}` 是整体替换**（不与当前 search 合并）；函数式拿到的是**当前 match 已校验、已注入 schema 默认值**的 search（`router.js:316-331`，match.search 由 `router.js:684-696` 的 `{...parentSearch, ...strictSearch}` 生成）。
- `router.js:900-932` — 中间件链 = `[路由级 search.middlewares..., validateSearch]`；路由级中间件先执行但都通过 `next()` 下探，所以 `stripSearchParams` 看到的是**已校验、已含默认值**的对象（`searchMiddleware.js:47-69` 用 `deepEqual` 比较默认值后 `delete`）。
- `router.js:441-446`、`load-client.js:483-487`、`load-server.js:549-553` — `navigate / Link / redirect` 均带 `_includeValidateSearch: true` 走 buildLocation，因此路由级 `stripSearchParams` 对导航与 SSR redirect 都生效。
- `load-client.js:156-162` — `searchError` 会被当作 lane error 抛出 → 落到 `__root.tsx:110-126` 的全局 `errorComponent`（整页 `Errors`）。这就是「schema 不写 `z.catch` ⇒ 手改 URL 变整页 500」的机制。

### 1.3 与 keepPreviousData 的关系

- 任务页用 `placeholderData: (previous) => previous`（`tasks-page.tsx:882`）→ 换筛选/翻页时保留上一页数据（表格由 `isFetching` 降透明度，`data-table.tsx:279-283`）。
- 正确形态：search 变 → deps 变 → loader 重跑 `ensureQueryData`；新 key 无缓存 → 组件用 placeholder 顶着旧数据。若 loader 里 `await` 且无 `staleTime`，客户端导航会因 `defaultPendingMs: 60` 把整页换成 pending（本仓已总结：`routes/games/index.tsx:242-250`、`routes/tags/index.tsx:78-86` 用 `typeof window === "undefined"` 分支规避）。
- 公开页是「loader 返回数据 + `useSuspenseQuery({initialData})`」（`routes/collections/index.tsx:42-46, 97-105`）；后台页是「loader 只 ensureQueryData + 组件 useQuery」（`routes/admin/_authL/tasks.tsx:9-19`）。**两条路线不要混。**

---

## 2. 现状证据：routes 下的 search param 用法

统计（`apps/web-tanstack/src` 全量 grep）：`validateSearch` 14 命中（13 个路由选项 + 1 个导出 schema 常量）、`loaderDeps` 10、`Route.useSearch()` 13、`useNavigate` 39（含组件内）。

### 2.1 validateSearch 逐条清单

| 文件:行 | schema 关键写法 | 备注 |
| --- | --- | --- |
| `routes/tags/index.tsx:23-35`（选项在 `:47`） | `q` optional；`sort/order` = `z._default(z.optional(z.catch(z.enum(...), 默认)), 默认)` | **本仓最标准形态**：默认值 + 非法值兜底双保险 |
| `routes/games/index.tsx:163-176`（`:188`） | `q: z._default(z.optional(z.string()), "")`；`startDate/endDate` optional；`sortBy/order` 同 tags | 空串作为默认值 |
| `routes/collections/index.tsx:28-30`（`:40`） | `page: z.catch(z.number(), 1)` | 缺 `_default`，catch 已能回退 |
| `routes/topics/index.tsx:27-29`（`:41`） | `page: z._default(z.catch(z.int().check(z.minimum(1)), 1), 1)` | **分页 schema 最佳范例**（拒绝 0 / 小数 / 非数字） |
| `routes/producer/index.tsx:21`（`:61`） | `page: z.catch(z.optional(z._default(z.number(), 1)), 1)` | 三层嵌套，可读性差但可用 |
| `routes/user/index.tsx:43-51`（`:139`） | `tab` 枚举默认 `profile`；`page: z._default(z.optional(z.number()), 1)` | ⚠️ `page` **没有 `z.catch`** ⇒ `?page=abc` 整页报错（风险 R3） |
| `routes/tags/category/$categoryKey.tsx:26-31`（`:52`） | 同 tags | 复用 `TAG_SORT_KEYS/TAG_ORDER_KEYS` |
| `routes/search/index.tsx:8-17` | 复用 `SearchSchema`，loader 内 `throw redirect` 到 `/games` | 旧链接兼容范式 |
| `routes/auth/login.tsx:68-69`、`routes/auth/signup/index.tsx:54,61`、`routes/auth/signup/Verification.tsx:28-41` | `return_to` / `email` | 跳转回程 |
| `routes/admin/_authL/meilisearch.tsx:42-53` | `indexType` + `tab` 双枚举默认值 | **后台唯一 validateSearch 先例**，任务页可直接照抄 |
| `routes/introduction/create.tsx:19-21`（`:39`） | `gameId` | — |

### 2.2 loaderDeps 与预取键

| 文件:行 | deps | 预取键与组件 useQuery 是否一致 |
| --- | --- | --- |
| `routes/tags/index.tsx:48-52` | `q(trim), sort, order` | 一致：`["tagHub","preview",sort,order]`（`:57`）、`["searchTags", q]`（`:72`） |
| `routes/games/index.tsx:189-195` | `q,startDate,endDate,sortBy,order` | 一致：`["gameList",q,startDate,endDate,sortBy,order,r18]`（`:206-214`），`ensureInfiniteQueryData` |
| `routes/collections/index.tsx:41-46` | `page` | 走 loaderData + initialData，key `["collections",page]`（`:98`） |
| `routes/topics/index.tsx:42-46` | `page` | key `["topics",page]`（`:60`） |
| `routes/producer/index.tsx:62` | `q,page` | 同域 |
| `routes/user/index.tsx:140-165` | `page` | `["userFavorites",page]` / `["userLikes",page]` 与 `:204,209` 一致 |
| `routes/admin/_authL/tasks.tsx` | **无 loaderDeps** | 见 `3 |

### 2.3 导航写法（两种形态并存，语义不同）

- **函数式（合并当前 search）**：`routes/user/index.tsx:213-217`（`search: (s) => ({...s, page: next})` + `resetScroll: false`）、`:254-259`（tab）、`routes/admin/_authL/meilisearch.tsx:74-77`（`replace: true`）、`:91-97`。
- **对象式（整体替换）**：`routes/games/index.tsx:688-690`、`:713-715`、`:795-805`（清空搜索时显式写 `q: "", startDate: undefined, endDate: undefined` —— 因为对象式不合并，漏一个键就丢参数）。
- **透明取值（跨路由复用组件）**：`components/home/search/Search.tsx:42-44` `useSearch({ strict: false })`。
- **显式剥离空值的好例子**：`Search.tsx:79-81` `q: trimmed || undefined`。
- **清空/重置**：`components/producer/producers-page.tsx:86` `navigate({ to: "/producer", search: {}, replace: true })`。
- **外部预取 + 显式 search**：`routes/index.tsx:51-75` `router.preloadRoute({ to: "/games", search: {...} })`、`{ to: "/collections", search: { page: 1 } }` → 预取键可带 search，但也意味着**只预热了那一组参数**。

### 2.4 已有的 URL 噪声（反面对照）

- `components/tags/tags-page.tsx:70` `search: { ...(trimmed ? { q: trimmed } : {}), sort, order }`：选「总浏览（默认）」也写出 `?sort=views&order=desc`。
- `components/tags/tags-page.tsx:90-92` 清空搜索同样带 `sort/order`。
- `routes/games/index.tsx:797` 传 `q: ""` ⇒ `?q=`（空串参数），而非 `undefined`。
- 分页链接：`routes/topics/index.tsx:132` `<Link to="/topics" search={{ page: p }} />`、`routes/collections/index.tsx:144` —— 对象式，当前只有 `page` 一个键所以暂时安全；任务页一旦多键就会互相覆盖。

---

## 3. 任务路由现状：守卫、loader、预取键一致性

### 3.1 权限守卫（`routes/admin/_authL.tsx`）

```
6   export const Route = createFileRoute("/admin/_authL")({
8   	head: () => seoMeta({ title: "...", noindex: true }),
13  	beforeLoad: async () => {
14  		const session = await getSession();
15  		if (!session) throw redirect({ to: "/auth/login" });
18  		if (session?.user.role !== "admin") throw redirect({ to: "/" });
21  	},
```

- 守卫在 **pathless layout** 的 `beforeLoad`（`:13-21`），所有 `/admin/_authL/*` 子路由继承；`redirect` 不携带 `return_to`（对比 `routes/topics/$topicId.edit.tsx:24` 有 `search: { return_to: "/topics" }`）。
- `head` 的 `noindex` 在父路由（`:8-12`）；任务路由自身没有 `head` / `pendingComponent` / `headers`。

### 3.2 任务路由（21 行，`routes/admin/_authL/tasks.tsx`）

```
6   const DEFAULT_FILTERS = { status: "", queue: "", page: 1, pageSize: 20 };
8   export const Route = createFileRoute("/admin/_authL/tasks")({
9   	loader: async ({ context }) => {
10  		// 预取键必须与任务页 useQuery 完全一致（含 page/pageSize），
11  		// 否则首屏会先渲染空列表再跳一次数据。
12  		await context.queryClient.ensureQueryData({
13  			queryKey: adminKeys.tasks(DEFAULT_FILTERS),
14  			queryFn: () => listTasks({ data: { pageIndex: 0, pageSize: DEFAULT_FILTERS.pageSize } }),
19  	},
20  	component: TasksPage,
```

现状缺陷（重构必须解决）：

1. **无 `validateSearch` / `loaderDeps`** ⇒ loader 只跑一次，URL 变化不会重新预取。
2. **预取键靠「字面量巧合」维持一致**：`DEFAULT_FILTERS`（`:6`）与组件内 `filters = { status, queue, page, pageSize }`（`tasks-page.tsx:856`）是两处独立字面量；键一致纯属两侧都写 `""`。`lib/admin/query-keys.ts:10-11` 已明确警告该失败模式（「预取写进缓存的键与读取键不一致，首屏会出现一次空列表回退」）。
3. **更好的既有范式（应照抄）**：`routes/admin/_authL/comments.tsx:9-12` 路由与页面共用 `commentsQueryOptions(DEFAULT_COMMENTS_FILTERS)`；`routes/admin/_authL/users.tsx:9-18` 共用 `usersListFilters(...)`。
4. **loader 与组件的 queryFn 重复书写**（`:14-17` vs `tasks-page.tsx:872-880`），且 loader 版本没有 `status/queue`（当前因默认空串而等价，URL 化后立刻不等价）。
5. **其余后台列表页全部是本地 state，无 URL 先例**（`comments.tsx` / `users.tsx` / `articles-page.tsx` / `users-page.tsx` 均未声明 validateSearch）。任务页若 URL 化会成为后台第一个，必须把「路由 ↔ 组件」契约抽成共享函数，别让后来者照抄字面量。

### 3.3 组件内的状态（`tasks-page.tsx`）

| 状态 | 行 | 是否应进 URL | 说明 |
| --- | --- | --- | --- |
| `status` | `:840` | 是，`?status=`（建议数组） | Tabs 值（`:1296-1302`）；KPI 卡也改它（`:1259-1262`） |
| `queue` | `:841` | 是，`?queue=`（建议数组） | QueueLanes（`:1284-1292`）+ 工具栏筛选（`:1359-1369`） |
| `search` | `:842` | 谨慎 | **仅客户端过滤当前页**（`:988-997`），不是服务端搜索；若进 URL 必须命名区分（如 `q` 给服务端、`hl` 给本地） |
| `page` | `:843` | 是 | `:873-879` 传 `pageIndex: page - 1` |
| `pageSize` | `:844` | 是（默认值剥离） | 选项 `[10,20,50,100]`（`data-table/pagination.tsx:17`） |
| `selectedId` | `:845` | 是，`?job=` | 桌面右栏 + 移动抽屉开关（`:1442-1465`） |
| `selectedIds` | `:846` | 否 | 批量选择是瞬时态 |
| `refresh` | `:847` | 可选 `?refresh=` | 轮询间隔，分享时可保留 |
| `deadLetterQueue` | `:848` | 可选 `?dead-letter=` | 抽屉（`:1467-1470`，`DeadLetterDrawer` `:642-775`） |
| `confirmDelete` | `:849-852` | 否 | 确认弹窗 |

页数派生：`pageCount = Math.max(1, Math.ceil(total / pageSize))`（`:890`），**没有任何越界钳制**。

---

## 4. 推荐实现：把筛选 / 排序 / 分页 / 抽屉同步到 URL

### 4.1 参数表（与 API 契约对齐，待 task-2 确认字段名）

| URL 键 | 类型 | 默认 | 编码 | 对应 API |
| --- | --- | --- | --- | --- |
| `status` | `TaskStatusKey[]` | `[]`（全部） | JSON 单键 | `status` 数组（现为单值，`tasks-page.tsx:877`） |
| `queue` | `string[]` | `[]` | JSON 单键 | `queue` 数组 |
| `q` | `string` | `""` | 原样（trim） | 服务端搜索（新增；现有 `search` 只是本页过滤） |
| `sortBy` | `"createdAt" / "startedAt" / "finishedAt"` | `"createdAt"` | 原样 | 新增排序（`AdminSort` 已就绪，见 `4.10） |
| `order` | `"asc" / "desc"` | `"desc"` | 原样 | 同上 |
| `page` | `number`（整数 ≥ 1） | `1` | 数字 | `pageIndex = page - 1` |
| `pageSize` | `10 / 20 / 50 / 100` | `20` | 数字 | `pageSize` |
| `job` | `string` | 无 | 原样 | `getTaskDetail({ data: { jobId } })` |

> 命名建议与现有公开页一致（`q / page / sort / order`，见 `routes/tags/index.tsx:23-35`、`routes/games/index.tsx:163-176`），后台额外引入 `queue / status / pageSize / job`。

### 4.2 schema（可直接落地，风格对齐现有代码）

```ts
// apps/web-tanstack/src/routes/admin/_authL/tasks.tsx（重构后）
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import * as z from "zod/mini";

export const TASK_STATUS_KEYS = [
  "queued", "running", "completed", "failed", "dead-letter", "interrupted",
] as const;                       // 与 tasks-page.tsx:154-162 statusTabs 同源
export const TASK_SORT_KEYS = ["createdAt", "startedAt", "finishedAt"] as const;
export const TASK_ORDER_KEYS = ["asc", "desc"] as const;
export const TASK_PAGE_SIZES = [10, 20, 50, 100] as const;

export const tasksSearchSchema = z.object({
  // 数组：缺省 → []；老链接 ?status=failed（标量）→ catch 回退 []
  status: z._default(z.catch(z.array(z.enum(TASK_STATUS_KEYS)), []), []),
  queue: z._default(z.catch(z.array(z.string()), []), []),
  q: z._default(z.optional(z.string()), ""),
  sortBy: z._default(z.catch(z.enum(TASK_SORT_KEYS), "createdAt"), "createdAt"),
  order: z._default(z.catch(z.enum(TASK_ORDER_KEYS), "desc"), "desc"),
  // 分页：整数 + ≥1；pageSize 用 int 区间而非 z.enum（z.enum 只接受字符串字面量）
  page: z._default(z.catch(z.int().check(z.minimum(1)), 1), 1),
  pageSize: z._default(
    z.catch(z.int().check(z.minimum(5)).check(z.maximum(200)), 20),
    20,
  ),
  job: z.optional(z.string()),
});

export const TASK_SEARCH_DEFAULTS = {
  status: [], queue: [], q: "", sortBy: "createdAt", order: "desc",
  page: 1, pageSize: 20,
}; // 仅供 stripSearchParams 使用；必须与 schema 默认值逐键 deepEqual
```

要点：
- **`z._default` 管「键缺失」，`z.catch` 管「键存在但非法」**——两者必须同时出现，否则手改 URL 会走 `1.2` 的整页 error 路径（现状反例：`routes/user/index.tsx:50`）。
- `statusTabs`（`tasks-page.tsx:154-162`）与 `queueLabels`（`:104-110`）应从 schema/常量模块导出后共用，避免 UI 与 URL 枚举漂移。
- `dead-letter` 这类含连字符的枚举值在 URL 与 JSON 编码里都安全（`qss.js:27` 走 `URLSearchParams.set` 会正确百分号编码）。

### 4.3 默认值剥离：用 `stripSearchParams`（不要自写 stringify）

```ts
export const Route = createFileRoute("/admin/_authL/tasks")({
  validateSearch: tasksSearchSchema,
  // 导航时把「等于默认值」的键从 URL 删掉；?page=1&status=[]&q= 这类噪声不再产生
  search: { middlewares: [stripSearchParams(TASK_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search }) => toTaskListFilters(search),   // 见 4.4
  loader: async ({ deps, context }) => {
    await context.queryClient.ensureQueryData(tasksQueryOptions(deps));  // 见 4.5
    return null;
  },
  component: TasksPage,
});
```

生效机制（已核对实现）：`getSearchMiddlewares` 收集 `routeOptions.search.middlewares` 后追加 validate 中间件（`router.js:900-932`），`stripSearchParams` 在 `next()` 返回后才比较删除（`searchMiddleware.js:47-69`），因此它看到的是**已注入默认值**的对象；`navigate/Link/redirect` 都带 `_includeValidateSearch: true`（`router.js:441-446`、`load-client.js:483-487`、`load-server.js:549-553`），SSR 与客户端行为一致。

三个边界：
1. **仅对「导航」剥离**。用户粘贴带默认值的旧 URL（`?page=1&pageSize=20`）不会被自动重写——通常这是想要的（避免 history 抖动）；若要严格 canonical URL，需组件内 `useEffect` 比较后 `navigate({ search, replace: true })`。
2. `stripSearchParams` 依赖 `deepEqual`，默认值对象里的数组只需**同内容**（`[]` 即可，无需同引用）。
3. 若以后加 `retainSearchParams`（跨导航保留筛选），顺序会互相影响，需写在同一个 `middlewares` 数组里并显式排好。

### 4.4 从 search 到 API 参数：唯一映射函数

```ts
// 建议落在 routes/admin/_authL/tasks.tsx 或 lib/admin/task-filters.ts
export type TaskListFilters = {
  status: string[]; queue: string[]; q: string;
  sortBy: string; order: "asc" | "desc";
  pageIndex: number; pageSize: number;
};

export function toTaskListFilters(s: z.infer<typeof tasksSearchSchema>): TaskListFilters {
  return {
    // 排序：数组顺序不同不应产生不同 query key / 不同 API 请求
    status: [...s.status].sort(),
    queue: [...s.queue].sort(),
    q: s.q.trim(),
    sortBy: s.sortBy,
    order: s.order,
    pageIndex: s.page - 1,
    pageSize: s.pageSize,
  };
}
```

- **必须 `sort()` 归一化**：否则 `?status=a&status=b` 与 `?status=b&status=a` 会生成两个不同的 React Query key（`adminKeys.tasks(filters)` 把对象整体塞进 key，`lib/admin/query-keys.ts:54`），预取/缓存全部击穿。
- `trim()` 同理：`?q=%20ab%20` 与 `?q=ab` 应命中同一缓存（现有 `loaderDeps` 已有此意识：`routes/tags/index.tsx:49` 的 `q: q?.trim()`）。

### 4.5 预取键单一来源（消灭「空列表闪一下」）

```ts
// 一次性定义 queryOptions，路由 loader 与组件 useQuery 共用
export const tasksQueryOptions = (f: TaskListFilters) => ({
  queryKey: adminKeys.tasks(f),
  queryFn: () => listTasks({
    data: {
      pageIndex: f.pageIndex, pageSize: f.pageSize,
      status: f.status, queue: f.queue, q: f.q || undefined,
      sortBy: f.sortBy, order: f.order,
    },
  }),
  // 与全局 staleTime 30s 对齐；预取后 30s 内点击直接命中
  staleTime: 30_000,
});
```

- 路由侧：`ensureQueryData(tasksQueryOptions(deps))`；组件侧：`useQuery({ ...tasksQueryOptions(toTaskListFilters(search)), refetchInterval, placeholderData: (p) => p })`。
- 与 `routes/admin/_authL/comments.tsx:9-12` 的模式完全一致；也满足 `lib/admin/query-keys.ts:10-11` 的注释要求。
- **SSR/客户端差异**：后台路由目前无 `headers()`、无 `pendingComponent`（`tasks.tsx` 全文 21 行）。URL 化后希望「换页不整页骨架」，保留 loader 内 `await` + 依赖 `defaultPendingMs: 60` 够用；慢查询/轮询时应参考 `routes/games/index.tsx:242-250` 的 `typeof window === "undefined"` 分支。

### 4.6 导航：始终函数式 + 显式 page 重置

```ts
const navigate = Route.useNavigate();
const search = Route.useSearch();

// 改筛选：重置页码（对象式会丢键，这里用函数式合并）
const setFilter = (patch: Partial<z.infer<typeof tasksSearchSchema>>) =>
  navigate({
    search: (prev) => ({ ...prev, ...patch, page: 1 }),
    resetScroll: false,
    replace: true,          // 筛选是「同一视图的微调」，不污染历史
  });

// 只改页码：不要顺手重置 page
const setPage = (page: number) =>
  navigate({ search: (prev) => ({ ...prev, page }), resetScroll: false });

// 清空全部筛选：显式给默认值对象（strip 会再擦一遍，双保险）
const resetFilters = () =>
  navigate({ search: () => TASK_SEARCH_DEFAULTS, resetScroll: false });
```

- `resetScroll: false` 的必要性见 `routes/user/index.tsx:213-217`（翻页不该回顶部）。
- `replace: true` 用于筛选/标签切换（`routes/admin/_authL/meilisearch.tsx:74-77` 同款），`push` 用于页码与抽屉（可后退）。
- **不要**用对象式 `search: { page }` 改单个键（`routes/topics/index.tsx:132` 的 Link 用法除外，那里只有一个键）。

### 4.7 抽屉 / 详情同步到 URL

```ts
const selectedId = search.job ?? null;
const onRowClick = (row: TaskRow) => {
  if (row.optimistic) return;      // tasks-page.tsx:947 临时 id 不可分享
  navigate({ search: (prev) => ({ ...prev, job: row.id }), resetScroll: false });
};
const closeDetail = () =>
  navigate({ search: (prev) => ({ ...prev, job: undefined }), replace: true, resetScroll: false });
```

配套注意：
- 现有 `selectedJob = rows.find(r => r.id === selectedId)`（`tasks-page.tsx:891`）依赖「该行在当前页」。URL 化后从分享链接进入时行可能不在当前页/已被清理 ⇒ 详情应能独立按 `job` 拉取（`TaskDetailPanel` 已用 `adminKeys.taskDetail(job.id)` 独立查询，`:514`），把「找不到行」降级为「详情仍可打开」而不是空面板。
- 移动抽屉与桌面栏共用同一个 `selectedId`（`:1442-1448`、`:1452-1465`），URL 化后天然共享。
- 批量选择 `selectedIds`（`:846`）不进 URL；删除后要同步清理 `job`（现有 `:932-935` 在 `onSuccess` 里 `setSelectedId(null)`，改成 `closeDetail()`）。

### 4.8 分页越界 / canonical 化

```ts
const total = listQuery.data?.total ?? 0;
const pageCount = Math.max(1, Math.ceil(total / search.pageSize));

useEffect(() => {
  if (total === 0) return;                   // 空结果：保持用户所在页，别抖动
  if (search.page > pageCount) {
    navigate({ search: (prev) => ({ ...prev, page: pageCount }), replace: true });
  }
}, [total, pageCount, search.page, navigate]);
```

现状完全没有这层（`tasks-page.tsx:873-879, 890`），而 `DataTablePagination` 在 `pageCount <= 1 && !hint` 时直接 `return null`（`components/admin/data-table/pagination.tsx:59`）——一旦 `page` 越界且过滤后为空，**分页控件消失、用户被困空页**。公开页同样缺钳制（`routes/collections/index.tsx:108-110`、`routes/topics/index.tsx:130-134` 只算 totalPages）。

### 4.9 数组参数的编码决策（必须二选一并写进注释）

| 方案 | 形态 | 优点 | 代价 |
| --- | --- | --- | --- |
| **A. 默认序列化（推荐）** | `?status=%5B%22failed%22%2C%22dead-letter%22%5D`（即 `?status=["failed","dead-letter"]`）；手写 `?status=failed&status=dead-letter` 也能读 | 零额外代码、与 `z.array` 天然对齐、SSR/客户端一致 | 可读性差，肉眼分享不友好 |
| B. 逗号自定义 | `?status=failed,dead-letter` | 人可读 | 需全局替换 `stringifySearch/parseSearch` 或 route 内 `z.string().transform`，且变换后输出类型与导航入参必须对齐；与默认 JSON 解析混用会双向不一致 |

推荐 A，并在 schema 上方写死一行注释说明 URL 形态。**禁止**同一路由内部分键用 JSON、部分键用逗号。

另：`DataTableToolbar` 的筛选已支持多选（`components/admin/data-table/toolbar.tsx:43-53` 的 `multi: true` + `value: string[]`，`:77-90` toggle 实现），所以 `status/queue` 用数组不仅为 URL，也为工具栏复用。

### 4.10 排序状态

`AdminDataTable` 已具备排序接口：`sort?: AdminSort`、`onSortChange`（`data-table.tsx:129-130`），类型 `AdminSort = { id: string; desc: boolean } | null`（`data-table/types.ts:4-5`），列需声明 `sortable`（`:21`），表头渲染为按钮（`:32-70`）。**任务页当前完全没传这两个 prop**（`tasks-page.tsx:1321-1350` 无 `sort/onSortChange`），即现有实现没有排序 UI。若要加，映射为：

```ts
const sort = { id: search.sortBy, desc: search.order === "desc" };
onSortChange={(next) =>
  setFilter(next
    ? { sortBy: next.id, order: next.desc ? "desc" : "asc" }
    : { sortBy: "createdAt", order: "desc" })
}
```

前提是后端 `listTasks` 接受排序字段（需 task-2 契约确认）。

---

## 5. 移动端现状

### 5.1 断点与 Hook

```
apps/web-tanstack/src/hooks/use-mobile.ts
3   const MOBILE_BREAKPOINT = 768;
6-8   useState<boolean | undefined>(undefined)        // SSR / 首帧 = undefined
11    matchMedia("(max-width: 767px)")
16    setIsMobile(window.innerWidth < 768)            // 仅 useEffect 内
20    return !!isMobile                               // undefined → false
```

后果：
- **SSR 与 hydration 首帧一律 false**（桌面布局），移动端闪一下再切换。
- 订阅者只有 `tasks-page.tsx:52,838` 与 `components/animate-ui/components/radix/sidebar.tsx:24,74`（影响面小，改造安全）。
- 全仓另有「模块级一次性 `matchMedia`」写法（`components/home/card.tsx:32-36`、`components/ui/skeleton.tsx:4-7`、`lib/view-transition.ts:62-65`），风格不统一。

### 5.2 后台外壳布局（`components/admin/admin-shell.tsx`）

| 结构 | 断点 | 证据 |
| --- | --- | --- |
| 桌面固定侧栏 | `hidden ... lg:flex`（≥1024），宽 14/60 | `:389-393` |
| 移动导航（Sheet 抽屉） | 外层 `lg:hidden` | `:306-308`、`:241-267` |
| 主区 padding | `lg:pl-14 / lg:pl-60`、内容 `max-w-[1400px]`、`px-3 sm:px-5 lg:px-7` | `:439-456` |
| 顶栏 | `h-14 sticky`，滚动时关 `backdrop-blur` | `:299-349` |
| 侧栏折叠 | `useLocalStorageState("galzy:admin:sidebar:collapsed")` | `:361-364` |

→ 后台「移动端」在 CSS 层是 **1024（lg）**，在 JS 层 `useIsMobile` 是 **768**，两者不一致，正是 `5.4` 空洞的根因。

### 5.3 表格与移动卡片（`components/admin/data-table/data-table.tsx`）

| 行为 | 断点 | 证据 |
| --- | --- | --- |
| 桌面表格 | `hidden ... sm:block`（≥640）+ 外层 `overflow-x-auto` | `:227` |
| 移动卡片列表 | `ul ... sm:hidden`（<640） | `:390` |
| 卡片字段角色 | `mobile: "title" / "meta" / "body" / "hidden"`，可按 `mobileCell` 换渲染 | `:413-472`；类型 `data-table/types.ts:29-32` |
| 最小宽度 | 默认 `min-w-[720px]`，任务页传 `min-w-[760px]` | `:180`、`tasks-page.tsx:1350` |
| 列隐藏断点 | `hideBelow: "sm" / "md" / "lg" / "xl"` | `data-table.tsx:18-19`、`types.ts:25-26` |
| 行点击 | 移动卡片 `onClick` 同 `onRowClick` | `:436` |

任务页列配置已正确使用移动角色：状态 `:1037 mobile:"meta"`、类型 `:1052 mobile:"title"`、队列 `:1062-1063 hideBelow:"md" + meta`、进度 `:1082 body`、时间 `:1092-1093 hideBelow:"lg" + hidden`、操作 `:1112 meta`。

### 5.4 详情面板 / 抽屉：**768–1023px 断点空洞（P0）**

```
tasks-page.tsx
838    const isMobile = useIsMobile();              // <768
1442   {!isMobile && (                               // ≥768 才渲染桌面栏
1443     <aside className="hidden lg:block">         // 但 <1024 被 CSS 隐藏
1444       <div className="sticky top-20 ...">{detailPanel}</div>
1448   )}
1452   {isMobile && (                                // <768 才渲染抽屉
1453     <Drawer open={!!selectedJob} ...>
1457       <DrawerContent className="overflow-hidden max-h-[88vh]">
```

| 视口宽度 | 桌面右栏（`:1442-1448`） | 移动抽屉（`:1452-1465`） | 点击行的结果 |
| --- | --- | --- | --- |
| < 640 | 不渲染 | 渲染 | 抽屉 |
| 640–767 | 不渲染 | 渲染 | 抽屉（但表格已是桌面态） |
| **768–1023** | **渲染但 CSS 隐藏** | **不渲染** | **无任何反馈（bug）** |
| ≥ 1024 | 渲染可见 | 不渲染 | 右栏 |

640–767 区间还会出现「桌面表格 + 移动抽屉」的混合态（表格 `sm:block` 生效于 ≥640，`:227`）。

修复建议（按侵入度升序）：
1. **最小改动**：`:1443` 的 `hidden lg:block` 改成 `hidden md:block`，与 `useIsMobile` 的 768 对齐。
2. **推荐**：JS 判断改用与 CSS 相同的查询（`(max-width: 1023px)`），或让 **CSS 单向决定**：始终渲染 `<aside className="hidden lg:block">`，抽屉始终挂载并用 `lg:hidden` 容器承载内容——`isMobile` 只用于「行为」（滚动锁定等），不用于「是否渲染」。
3. `useIsMobile` 用 `useSyncExternalStore` 包 `matchMedia`，SSR 快照给出与 CSS 一致的值，消除首帧跳变。

### 5.5 其他移动端细节

- KPI 网格：`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`（`tasks-page.tsx:1238`），移动端 2 列 × 5 张卡占 3 行，首屏被 KPI 吃掉——URL 化时可考虑收进可折叠区或仅 `xl` 显示。
- 状态 Tabs：`TabsList overflow-x-auto justify-start`（`:1303`），7 个 tab 在 375px 横向滚动，容易漏看「死信」。
- 分页脚：`DataTablePagination` 移动端隐藏首页/尾页与数字页码（`data-table/pagination.tsx:108-130`），只剩上一页/下一页 + 每页条数。
- 详情抽屉 `max-h-[88vh]`、内容 `overflow-y-auto`（`:1457-1462`）；`DrawerHeader` 是 `sr-only`（`:1458-1461`），视觉上无标题。
- 死信抽屉 `DeadLetterDrawer`（`:642-775`）移动端一次性拉 100 条（`:655`）且无虚拟化——长列表滚动压力大。

---

## 6. 风险清单（按优先级）

### R1（P0）预取键漂移 → 首屏空列表回退
- 现状：`tasks.tsx:6,12-18` 与 `tasks-page.tsx:856,870-883` 是两处独立 filters 字面量，仅靠「都写 `""`」保持 key 相等；URL 化后默认值被剥离（`status` 从 `""` 变 `[]`、`pageSize` 可能缺失），组件侧若直接把 search 塞进 key，loader 预取的 key 与读取 key **必然不等**。
- 触发条件：任何筛选/分页进 URL 的改动，或 schema 默认值从 `""` 改成 `undefined`/`[]`。
- 处置：单一来源 `tasksQueryOptions(toTaskListFilters(search))`（`4.5`），并在 `lib/admin/query-keys.ts` 保留该注释约束。

### R2（P1）默认值与空串漏进 URL，破坏可分享性与缓存
- 机制：`qss.js:27` 只跳过 `undefined`；函数式 `search(prev)` 的 prev 已含 schema 默认值（`router.js:316-331`）。
- 反例：`tags-page.tsx:70,92`、`games/index.tsx:797`（`q: ""` ⇒ `?q=`）、`user/index.tsx:213-217`。
- 处置：`stripSearchParams(TASK_SEARCH_DEFAULTS)`（`4.3`）+ 清空筛选时显式给 `undefined`（参考 `Search.tsx:79-81`）。
- 隐性风险：默认值形态变化（`""` → `[]`）会让旧书签与新代码语义不同，需在 `validateSearch` 同时兼容标量与数组（`z.catch` 兜底即可）。

### R3（P1）非法 / 越界 search 无兜底 → 整页错误或困死空页
- 非法值：schema 漏写 `z.catch` 时，`?page=abc` 会被当作 lane error 抛到 `__root.tsx:110-126` 的整页 `Errors`（机制见 `load-client.js:156-162`）。反例 `routes/user/index.tsx:50`。
- 越界值：`page=999` 不做钳制（`tasks-page.tsx:873-879,890`），空结果时分页控件整体消失（`pagination.tsx:59`）。
- 处置：每个分页键都 `z._default(z.catch(...), 默认)`；加 `4.8` 的 canonical `replace` 导航；`pageCount` 由 `total` 实时推导。

### R4（P0，限定平板/小窗）768–1023px 详情不可见
- 详见 `5.4`：`tasks-page.tsx:1442-1448`（`!isMobile` + `hidden lg:block`）与 `:1452-1465`（`isMobile`）在 768–1023 双双失效，行点击无反馈。
- 触发条件：iPad 竖屏 768、iPad 横屏 1024 边界、桌面窗口拖窄、分屏。
- 处置：统一 JS 与 CSS 断点（改 `md:block` 或把 `useIsMobile` 阈值改到 1024）；把「是否渲染」交给 CSS。

### R5（P2）对象式 navigate 整体替换 + 分享/刷新丢状态
- 对象式 `search: {...}` 不与当前 search 合并（`router.js:332`），漏写一个键就丢参数；现有代码靠「手工列全键」维持正确（`games/index.tsx:688-690`），是持续维护负担。
- 当前所有筛选/搜索/抽屉/轮询间隔都是组件内 state（`tasks-page.tsx:840-852`），**刷新或把链接发给同事 = 回到默认视图**；`?refresh=2000` 这类状态也无法复现。
- 处置：全部改用函数式更新；把 `refresh`、`job`、`dead-letter` 纳入 schema（默认值剥离）；对 `selectedIds`、确认弹窗明确「不入 URL」并写注释。

---

## 7. 需要与 task-2（队列 API 契约 V2）对齐的字段

| 前端需要 | 现状证据 | 期望契约 |
| --- | --- | --- |
| `status` 多值 | 现在只传单值（`tasks-page.tsx:877`，空串再转 `undefined`） | `status?: TaskStatus[]` |
| `queue` 多值 | 同上（`:878`） | `queue?: string[]` |
| `q` 服务端搜索 | 现无字段；页内搜索是客户端过滤（`:988-997`） | `q?: string`（对 id/type/label） |
| `sortBy/order` | 现无；`listTasks` 只收 pageIndex/pageSize/status/queue | `sortBy?: string; order?: "asc" / "desc"` |
| `total` | 已用于 `pageCount`（`:889-890`） | 保持返回 `total`，否则无法钳制页码 |
| 详情按 id 单取 | `getTaskDetail` + `adminKeys.taskDetail(jobId)`（`:514`） | 保持（URL `?job=` 依赖） |

---

## 8. 附录：核实方法与命令

```bash
# 1) validateSearch / loaderDeps / useSearch / useNavigate 全量清单
rg -n "validateSearch|loaderDeps|useSearch|useNavigate" apps/web-tanstack/src

# 2) 是否已存在 search 级定制（结论：没有）
rg -n "stringifySearch|parseSearch|stripSearchParams|retainSearchParams" apps/web-tanstack/src

# 3) 版本
rg -n '"@tanstack/react-router"|"@tanstack/react-start"|"zod"' apps/web-tanstack/package.json package.json
rg -n '@tanstack/react-router@|@tanstack/router-core@' bun.lock

# 4) 序列化实现（本机安装版本）
sed -n '20,60p'   node_modules/.bun/@tanstack+router-core@1.171.38/node_modules/@tanstack/router-core/dist/esm/qss.js
sed -n '300,340p' node_modules/.bun/@tanstack+router-core@1.171.38/node_modules/@tanstack/router-core/dist/esm/router.js
sed -n '1,75p'    node_modules/.bun/@tanstack+router-core@1.171.38/node_modules/@tanstack/router-core/dist/esm/searchMiddleware.js

# 5) 移动端
rg -n "useIsMobile|MOBILE_BREAKPOINT" apps/web-tanstack/src
rg -n "lg:flex|lg:hidden|sm:block|sm:hidden|min-w-" apps/web-tanstack/src/components/admin
```

---

## 9. 交付说明

- 本次仅新增本文件（`.dsh-research/router-audit.md`），**未修改任何源码**。
- 行号基于审计时工作区状态（TanStack Router 1.170.45 / router-core 1.171.38 / zod 4.6.7）。
- 若实现阶段采用 `4` 的方案，请同步把 `routes/admin/_authL/tasks.tsx` 的 `DEFAULT_FILTERS` 与 `tasks-page.tsx:856` 合并为一处导出，否则 R1 会立刻复现。
