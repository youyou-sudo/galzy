# 后台「查看站点」→ 500 错误页，错误页「返回首页」也不恢复

## 症状

1. 在 `/admin` 后台侧栏底部点「查看站点」（`components/admin/admin-shell.tsx` 的 `<Link to="/">`）→ 整页变成
   「500 页面出错了」，地址栏已经是 `/`，后台外壳消失。
2. 在该错误页点「返回首页」（`components/error.tsx` 的 `<Link to="/">`）→ 仍是错误页；按 `F5`
   刷新（文档请求）却一切正常。

同一类崩溃还会出现在**任何进入首页/`/games` 的站内切页**上，只是通常恢复得快，肉眼只当是一次闪烁。

## 根因（已用 Playwright 复现确认）

应用里存在**两套「当前路由」来源**，切页瞬间互不一致：

| 来源 | 更新时机 | 用途 |
| --- | --- | --- |
| `window.location`（地址栏） | furin 在**渲染新页面前**就 `pushState` 改好 | `lib/nav.tsx` 的 `resolvePattern()` 用它反查 route pattern |
| furin SearchStore 快照 | 在 `provider` 的 `useLayoutEffect` 里**渲染之后**才提交 | furin `useSearch(pattern)` 的 `assertSearchRoute` 用它校验 |

`lib/nav.tsx` 旧的 `useSearch()` 把地址栏现算出的 pattern 交给 furin 的 `useSearch(pattern)`：

```ts
// 旧实现
const pattern = resolvePattern(options?.from);   // from 缺省时读 window.location
const [search] = useFurinSearch(pattern as never);
```

于是切页第一帧里 `assertSearchRoute` 拿到的是**上一页**的快照：

```ts
// @teyik0/furin/src/client/router/search/index.ts
if (from !== snapshot.currentPattern && from !== pathnameFromLogicalHref(snapshot.currentHref)) {
  throw new Error(`[furin] useSearch("${from}") does not match the current route.`);
}
```

抛在渲染期 → depth-0 错误边界接住 → `pages/error.tsx` 固定按 500 渲染（furin 的
`DEFAULT_ERROR_STATUS = 500`）→ 用户看到「500 页面出错了」。

实测到的原始报错（重现脚本见下）：

```
Error: [furin] useSearch("/admin") does not match the current route.
  at assertSearchRoute (furin dist/client/router/search/index.js:17)
  at useSearchSelection → useSearch → @web/lib/nav useSearch
  at SearchInput (apps/web/src/components/home/search/Search.tsx)
```

全站只有 `Search.tsx` 调用 `useSearch`（首页 `pages/index.tsx` 与 `/games` 各一处），所以
「只有进首页/`/games` 会 500、后台内部切页正常」完全吻合。

**为什么 F5 正常**：文档请求只渲染一次，没有「上一帧快照」；hydration 时 store 的初始快照
直接取自当前 match，不存在滞后。

**为什么错误页点「返回首页」也不恢复**：错误边界只在自己被 reset 时清错，reset 由
`resetKey = ${currentHref}:${resetVersion}` 驱动，而 `resetVersion` 只在**非 error 提交**时 +1。
错误提交把 `href` 写成了 `/`（pushState 先发生），`resetKey` 一字不变 → 边界不清错；
再点一次 `<Link to="/">` 若 store 仍停在旧路由，就重抛同一条断言，错误页原地续命。

## 修复

1. `apps/web/src/lib/nav.tsx` —— `useSearch()` 改为**只读地址栏**，不再参与 furin 的路由断言：
   ```ts
   export function useSearch<T = any>(_options?: { from?: string; strict?: boolean }): T {
     const location = useLocationSnapshot();          // 自家 patched-history store
     return React.useMemo(() => parseSearch(location.searchStr) as T, [location.searchStr]);
   }
   ```
   `NavPathContext` 由「只有 path」扩展成 `{ pathname, searchStr }`，`getServerSnapshot`
   带上下发的 search，保证 SSR 与水合读到同一份值；`from` 保留在签名里但不再参与取值。
2. `apps/web/src/pages/root.tsx` —— 根布局 loader 下发 `search`（`new URL(request.url).search`），
   传给 `<NavPathProvider initialPath={path} initialSearch={search}>`，让服务端首屏也能读到 query。
3. `components/home/search/Search.tsx` / `pages/games/index.tsx` —— 去掉已经失去意义的
   `from="/games"` 参数。
4. `components/error.tsx` + `pages/error.tsx` —— 顺带修掉「永远只显示默认文案」的问题：
   furin 传进来的 `error` 是 `{ message, digest, status }` **普通对象**而不是 `Error` 实例，
   旧实现按 `instanceof Error` 取 message，真实原因被丢弃。现在原始 message / digest /
   status 进折叠区「查看错误详情」，正文仍保持友好文案。

## 验证

单测（`bun --cwd apps/web test`，共 42 个文件 / 329 条全绿）：

- `src/lib/nav.search.test.tsx` —— 复刻「地址栏已变、store 未提交」的状态；旧实现直接抛
  `useSearch("/games") does not match the current route`，修复后通过；并覆盖 SSR search 取值。
- `src/pages/error.test.tsx` —— 错误页必须把真实 message / digest 渲染进详情折叠区。

浏览器（Chromium，伪造 admin 会话 + 把 `?_furin=data` 延迟 0.6–3s 放大竞争窗口）：

| 场景 | 修复前 | 修复后 |
| --- | --- | --- |
| `/admin` → 点「查看站点」 | 500 错误页 | 正常回首页，0 条断言 |
| 错误页再点「返回首页」 | 错误页续命 | 无错误页（不再进入错误态） |
| `/games`、`/v31813`、`/collections` → 首页 | 偶发断言 + 闪烁 | 正常 |
| `/` → `/games` 搜索、`/games?q=…` 再检索 | 断言（`useSearch("/games")`） | 正常，URL 与结果同步 |
| `/?q=helloworld` 直链、`/games?q=love` | — | 输入框 SSR 预填正确，无新增 hydration 警告 |

## 遗留风险 / 后续建议

1. **上游问题（唯一阻塞项）**：furin 的 SearchStore 在 `useLayoutEffect` 里提交、却在渲染期做断言，
   本身就是时序不一致；本仓库只是绕开（改用地址栏 + SSR 下发）。上游修好后可恢复
   `useSearch(pattern)` 的强类型用法，见文末「升级复核」与 `docs/furin-navigation-alignment.md` 的切换清单。
2. **`useSearch()` 目前只读地址栏**，返回未解析的字符串（`Record<string, string | string[]>`），
   不含 query schema 的默认值/数字转换。当前唯一消费方是搜索框（只读 `q/sortBy/order/日期` 字符串），
   够用；将来若有页面依赖 schema 默认值，需要页面自己解析或等上游修复。
3. `/games` 存在**预存在的** hydration 警告（虚拟列表 `height` 与服务端不一致），与本次修复无关。

## 2026-11-04 升级复核（结论：仍不能切回框架实现）

用户升级依赖后复测，`@teyik0/furin` **并没有变**：

- `apps/web/package.json` 仍精确锁定 `0.8.0-alpha.0`；`bun update` 只升级了根依赖
  （biome 2.6.4 / better-auth 1.7.15 / @types/bun 1.4.4），`bun.lock` 里 furin 仍是同一版本。
- npm registry 的 `latest` 仍是 `0.8.0-alpha.0`（2026-10-20 发布），没有更新版本可装。
- GitHub `main`（2026-10-30 push）里 `packages/core/src/client/router/search/index.ts` 的
  `assertSearchRoute`、以及 `provider.tsx` 的 `useLayoutEffect(() => { searchStore.setSnapshot(); flush() })`
  与已发布版本逐字相同 —— 上游 main 也没修。

实测（把 `lib/nav.tsx` 的 `useSearch` 临时改回框架实现，其余不变）：

| 场景 | 结果 |
| --- | --- |
| 最小探针页 `useSearch("/tmp-probe")`，`/` → 切页进入 | 1 次断言抛错（页面靠 React 重试恢复） |
| `/admin` → 点「查看站点」（首页 `SearchInput` 调 `useSearch()`） | **复现「500 页面出错了」错误页（~2.1s）** |
| `/` → `/games`（页内 `useSearch("/games")`） | 1 次断言抛错（未显示错误页，但不能依赖） |
| 直链 `/games?q=x`、同路由改 search | 正常（SSR 与 store 一致） |

结论：**保持现状**——`lib/nav.tsx` 的 `useSearch` 继续只读地址栏，`NavPathProvider` 继续下发 SSR search。
切回步骤已写入 `docs/furin-navigation-alignment.md#切换到框架的-usesearch待上游修复`。

## 复现脚本

本地起 `apps/api`（3001）与 `apps/web`（3000）后，用 Playwright：

- 拦截 `**/api/auth/get-session*` 返回伪造 admin 会话（**不写数据库**）；
- 用 `ctx.route(/\/\?_furin=data/, …)` 延迟数据响应 0.6–3s，稳定放大竞争窗口；
- `/` → SPA 导航到 `/admin` → 点「查看站点」→ 断言页面无「页面出错了」、控制台无
  `[furin] useSearch` 断言。
