# 登录态性能排查：为什么「一登录，每次访问/刷新都慢」

> 结论先行：慢的不是「登录」本身，而是**会话查询被放在了每个服务端取数路径里**，
> 并且**客户端每次刷新都要等一次 `get-session` 才知道登录态**。列表页的视口预取
> 会把这两件事放大 7~20 倍。修复后：会话查询从「每次取数一次」降到「每 15s 至多一次」，
> 登录态随 HTML 一起到达浏览器（首帧即登录态）。

## 1. 测量到的现象

| 请求 | 结果 |
| --- | --- |
| 匿名 `GET /auth/get-session`（API 直连） | 1.5~1.8ms（无 cookie 直接短路） |
| 登录态服务端 `getSession`（cookieCache 命中） | 3~7ms |
| 登录态服务端 `getSession`（**cookieCache 过期**） | 493ms / 1558ms / 2354ms（回 PostgreSQL） |
| 加载 `/topics`（登录态） | 首屏 SSR 后跟 7 条 `/topics/:id` 预取，每条 1~3s |
| 加载 `/games`（登录态/匿名都） | 首屏 SSR 后跟 ~18 条 `/:id` 预取，每条 1~5s |

关键点：**匿名用户没有会话 cookie，`getSession` 在 API 侧直接返回 null（1.5ms）；
登录用户则要真的校验一次会话**。当 cookieCache 的 5 分钟过期后，每次都是数据库查询。

## 2. 根因

### 2.1 会话查询散落在每个服务端取数路径

`getTopics` / `getTopic` / `getFileList` / 后台 `_route` 守卫 / 登录页 / 用户中心
都会「顺带查一次会话」，各自走 `web → API → better-auth → PG`。

- 首屏 loader 一次；
- **每条视口预取的详情页 loader 又一次**；
- cookieCache 过期时，每次都是 250~500ms 的数据库查询；并发预取时还会形成
  惊群（同一会话被并发查十几次），把 API/PG 连接池打满，整页跟着变慢。

### 2.2 客户端每次刷新都要等一次 `get-session`

`Header` 的用户菜单位于客户端懒加载 chunk 里，挂载后才发 `/api/auth/get-session`。
在拿到响应之前只能渲染骨架（截图里的空头像圈），这期间用户已经能看到页面，
但「登录态」迟迟不出现；登录用户对这一步尤其敏感。

### 2.3 列表页的视口预取放大了上面两点

`useViewportPreload` 会在卡片进入视口时预取详情页（最多 4 并发）。详情页的
`?_furin=data` 会跑整条 loader 链；登录用户每条都带一次会话查询
（话题详情尤其明显：`getTopic` 每次都查）。这是「登录后切页/刷新明显更慢」的放大器。

## 3. 修复

### 3.1 API：会话进 Redis（secondary storage），数据库仍是真源

`apps/api/src/modules/auth/service.ts`：

```ts
session: {
  cookieCache: { enabled: true, maxAge: 5 * 60 },
  // Redis 只是加速层：缓存丢了回源数据库，不会把用户登出
  storeSessionInDatabase: true,
},
secondaryStorage: { get, set, delete, getAndDelete, increment },
verification: { storeInDatabase: true }, // 验证码不走 Redis，避免 Redis 抖动影响登录
```

- Redis 命中：`get-session` 只有一次 Redis 往返（毫秒级），不再回 PG；
- Redis 未命中 / Redis 不可用：better-auth 回源数据库（`storeSessionInDatabase`）；
- 新增 `incrKv()` 供 `increment`（限流/尝试次数）使用；
- 写/更新/删除都走两层，登出会先删 Redis 再删数据库行。

> 注意：上线前已创建的旧会话不在 Redis 里，会继续回源数据库，用户重新登录后即生效。

### 3.2 Web：服务端会话读取带短缓存 + 并行合并

新增 `apps/web-tanstack/src/server/auth/server-session.ts`：

- 没有 better-auth cookie → 直接返回 null，**不发请求**（匿名页面零开销）；
- 同一份 cookie 15s 内复用结果；并发请求合并成一次（single-flight）；
- 替换了 `impl/auth`、`impl/game`（`getFileList`）、`impl/topics`（`getTopics`/`getTopic`）
  里直接调 `authServerClient.getSession()` 的写法。

副作用：会话撤销/角色变更在服务端最多延迟 15s 生效（接口仍有 `isAdmin` 二次校验）；
登录/登出会更换 cookie，缓存键随之失效，所以不会出现「登出后仍显示登录」。

### 3.3 根布局：登录态随文档下发

`apps/web-tanstack/src/pages/root.tsx` 的 loader 增加 `authSession`：

```ts
loader: async ({ request }) => ({
  adSlot: await loadTopAdSlot(request),
  authSession: await documentOnly(request, () => getSession()),
})
```

- 文档请求：会话随 HTML 下发，`AppChrome` 把它 seed 进 React Query 的 `['auth']`，
  hydration 首帧就是登录态（用户菜单不再先显示「登录/骨架」再补请求）；
- 站内切页（`?_furin=data`）：`documentOnly` 返回 null，**不重复取**，直接用缓存；
- 匿名请求：无 cookie → 零 API 调用。

### 3.4 客户端：统一读会话

新增 `apps/web-tanstack/src/lib/use-auth-session.ts`（`useAuthSession()`），
`UserMenu`、后台 `AdminShell`（会话兜底 + 侧栏头像）改为复用它（同一个 `['auth']` key），
不再各自 `authClient.useSession()` / `authClient.getSession()` 重复拉取。

## 4. 验证方式

```bash
# 1) 匿名：服务端不该发会话请求（页面照常返回）
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' http://localhost:3000/topics

# 2) 会话读取不再打到 PG（API 侧 get-session 匿名/无效令牌为毫秒级）
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' http://localhost:3001/auth/get-session

# 3) 登录态页面：浏览器 Network 里 /api/auth/get-session 应消失（改由文档内联会话提供）
```

`bun --cwd apps/web-tanstack test`、`bunx tsc --noEmit`（web + api）、
`bun --cwd apps/web-tanstack build` 均通过。

## 5. 还没做的（可选下一步）

- **预取风暴**：列表页首屏仍会预取 7~20 个详情页，每个详情取数 1~3s（远端库环境下）。
  会话问题修好后这部分不再叠加会话查询，但详情页数据本身仍是主要耗时；
  可考虑「首屏只预取前 N 个 / 悬停再预取更多」或把详情页重查询做缓存。
- 旧会话回源数据库的过渡期：可加一次性脚本把 PG 中的有效会话灌入 Redis（非必需）。
