# 后台 SPA 化重构：切页不再等 loader

> 目标：`/admin/**` 的页面切换与页内操作（Tab / 筛选 / 分页 / 详情）达到 SPA 的响应速度，
> 不再出现「点侧栏 → 旧页面停住 → 等服务端数据 → 才换页」的等待。
>
> 范围：`apps/web-tanstack`（furin 前端），不涉及 API 业务逻辑。

## 1. 为什么原来慢

furin 的站内导航不是「换组件」，而是：

1. 客户端向目标页发一条 `<页面 URL>?_furin=data` 请求；
2. 服务端**重跑整条 loader 链**（root → 目录 `_route` → 页面），把结果序列化成 NDJSON；
3. 客户端拿到数据 + 页面模块 chunk 后才 commit（没有 pendingComponent，旧页面原地不动）。

后台当时每个页面 loader 都在服务端取数，于是**每次切页**都要付：

| 来源 | 代价 |
| --- | --- |
| `admin/_route.tsx` 的 `getSession()` | web → API → Better Auth → DB 一次往返 |
| 根布局 `loadTopAdSlot()` | 非后台页再付一次广告接口往返（后台已跳过） |
| 各页面 loader（列表/统计/进度） | 每个页面 1~4 次 web → API → DB |

在本仓库的远程数据库环境下，一次 `SELECT 1` 约 250ms，所以切一次后台页面常要 0.5~3s，
而且这段时间**界面毫无反应**——这正是「不像 SPA」的根因。

## 2. 方案

### 2.1 区分「文档请求」与「切页取数」

新增 [`apps/web-tanstack/src/lib/spa-request.ts`](../apps/web-tanstack/src/lib/spa-request.ts)：

- `isSpaDataRequest()`：识别 `?_furin=data` / `__furin_data.ndjson`；
- `documentOnly(request, load)`：文档请求执行取数，切页取数返回 `null`。

⚠️ 不能直接看 loader 里的 `request.url`：furin 在路由前就剥掉了 `_furin=data`
（`@teyik0/furin` 的 `stripNavigationDataRequest`），应用级 `onRequest` 拿到的也已经是剥干净的 URL。
**原始请求**只存在于 `src/server.ts` 新增的 `.wrap()` 里——它比 furin 的 wrap 更靠外，
捕获后写进 AsyncLocalStorage（`lib/request-context.ts`，与 BFF cookie 透传共用同一实例）。
`spa-request.ts` 通过同一个 `Symbol.for` 键读该实例，因此不会把 `node:async_hooks`
拖进浏览器包。

### 2.2 页面 loader：首屏 SSR，切页交给客户端 Query

所有后台页面统一成：

```ts
.loader(async ({ request }) => ({
  users: await documentOnly(request, () => adminListUsers({ ... })),
}))
.page(({ users }) => <UsersRoute users={users} />)

function UsersRoute({ users }: { users: Awaited<...> | null }) {
  // null = 站内切页：不 seed，交给页面内 useQuery 取数
  useSeedQueries(users ? [[DEFAULT_KEY, users]] : []);
  return <UsersPage />;
}
```

- **直链 / 刷新 / 前进后退**（文档请求）：SSR 照旧带数据进水合，首屏不闪骨架；
- **站内切页**：loader 只返回 `null`，`?_furin=data` 响应只剩页面壳（实测 ~20ms），
  页面组件挂载后用自己的 `useQuery` 取数；命中缓存则直接渲染。

Query 缓存默认 `gcTime` 从 60s 提到 5min，后台各页来回切换时优先命中上次数据
（stale 也会先渲染再后台刷新），不会每进一次页面就看一次骨架。

### 2.3 目录守卫：文档请求才做服务端鉴权

`pages/admin/_route.tsx` 的 `getSession()` 只在文档请求上执行：

- 未登录直链 `/admin/**` 依旧服务端 302 到登录页（不会闪后台界面）；
- 站内切页不再校验会话（省掉一次 API + DB 往返），由 `AdminShell` 的客户端
  `authClient.useSession()` 兜底：会话过期时跳登录；
- 每个后台接口本身还有 `isAdmin` 宏，页面壳不含任何敏感数据。

### 2.4 预取 + 反馈

- `AdminShell` 在首屏渲染后的浏览器空闲时间用 `router.preloadRoute()` 预取全部 11 个后台路由
  （页面模块 + 页面壳数据，furin 内部 30s 缓存、in-flight 去重），点侧栏直接换页；
- `RouteLoadingIndicator` 改为**延迟 PENDING_DELAY_MS(180ms) 才亮**：预取命中时切页在
  一两帧内完成，不再每次都闪一下 spinner；真慢（未命中预取）才显示；
- 根布局广告位 loader 在切页取数时不再请求（首屏已进 query 缓存）。

### 2.5 页内操作：浅层 URL 更新，不触发页面导航

新增 [`apps/web-tanstack/src/lib/admin/use-shallow-search.ts`](../apps/web-tanstack/src/lib/admin/use-shallow-search.ts)：

- 页内状态（Tab / 筛选 / 分页 / 任务详情 id）放在 React state 中，组件不重挂载；
- 地址栏用 `history.replaceState` 改写（`lib/nav.tsx` patch 过 history，会同步
  `useLocation`，侧栏高亮 / 面包屑照常更新），不产生历史记录，与旧实现 `replace: true` 一致；
- 深链 / 刷新仍按 `config.query` 的 schema 还原到同一视图。

已接入：`/admin/tasks`（筛选、排序、分页、任务详情）、`/admin/adverts`（Tab）、
`/admin/meilisearch`（Tab、索引切换）。

## 3. 改动清单

| 文件 | 改动 |
| --- | --- |
| `src/lib/spa-request.ts` | 新增 `isSpaDataRequest` / `documentOnly` |
| `src/lib/admin/use-shallow-search.ts` | 新增页内状态 + 浅层 URL 同步 hook |
| `src/server.ts` | `.wrap()` 最外层捕获原始 Request 进 ALS（替代 `onRequest`） |
| `src/pages/admin/_route.tsx` | 文档请求才做会话校验 |
| `src/pages/admin/*.tsx`（11 个页面 + 文章编辑） | loader 改为 `documentOnly` + 条件 seed |
| `src/components/admin/admin-shell.tsx` | 空闲预取全部后台路由、客户端会话兜底 |
| `src/components/admin/adverts-page.tsx` | Tab 改浅层 URL |
| `src/components/shared/route-loading-indicator.tsx` | 延迟显示 + 对应单测 |
| `src/integrations/tanstack-query/furin-provider.tsx` | `gcTime` 60s → 5min |
| `src/lib/adverts-data.ts` | 切页取数时跳过广告接口 |

## 4. 验证

```bash
# 切页取数不再触发会话校验 / 广告 / 页面数据（匿名也返回 200 页面壳，实测 ~20ms）
curl -s -w '\n%{time_total}s\n' 'http://localhost:3000/admin/users?_furin=data'
# 文档请求仍然是服务端 302
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/admin/users'
# 广告：文档请求带广告，切页取数 adSlot 为 null
curl -s 'http://localhost:3000/auth/login' | grep -c adSlot
curl -s 'http://localhost:3000/auth/login?_furin=data' | grep -c adSlot
```

单测：`bun --cwd apps/web-tanstack test`（含 `spa-request.test.ts`、`use-shallow-search.test.tsx`、
`adverts-data.test.ts`、`route-loading-indicator.test.tsx`）。

## 5. 取舍与后续

- **安全**：`/admin/**?_furin=data` 匿名可拿到页面壳（loader 数据全为 `null`），
  与「静态资源可公开访问」同级；数据仍在每个后台接口的 `isAdmin` 之后。
  如未来后台 loader 需要放敏感数据，**必须**继续走 `documentOnly` 之外的服务端校验。
- **首屏**：后台从「SSR 直出全量数据」变成「切页时客户端取数」，首次进入某页会看到骨架
  （文档请求仍是 SSR 直出）。这是 SPA 化的必要取舍。
- **可继续做**：侧栏 hover 时预取目标页的默认列表查询；`useShallowSearch` 接入更多页面的
  筛选态；对 `/admin/articles/[articleId]/edit` 这类详情页做行级预取。
