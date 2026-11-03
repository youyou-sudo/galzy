# 前端按 Furin 官方文档收敛（导航层重构）

参考文档：<https://teyik0.github.io/furin/llms-full.txt>（Furin 0.8.0-alpha.0）。
目标：把从 TanStack Router 迁移过来时留下的「双轨写法」清掉，站内导航只保留一套 furin 语义。

## 1. 路由 id：`$id` → `:id`

| 旧（TanStack） | 新（furin pattern） |
| --- | --- |
| `/$id`、`/$id/_layout` | `/:id` |
| `/$id/introduction`、`/$id/comment`、`/$id/translate`、`/$id/relations` | `/:id/introduction` … |
| `/$id/introduction/$articleId` | `/:id/introduction/:articleId` |
| `/collections/$id` | `/collections/:id` |
| `/tags/$tagId`、`/tags/category/$categoryKey` | `/tags/:tagId`、`/tags/category/:categoryKey` |
| `/topics/$topicId`、`/topics/$topicId/edit` | `/topics/:topicId`、`/topics/:topicId/edit` |
| `/producer/$pid` | `/producer/:pid` |
| `/introduction/$articleId/edit`、`/admin/articles/$articleId/edit` | `…/:articleId/edit` |
| `/admin/_authL/...` | `/admin/...` |

`defineRoute(id)` 的 id 本来就已经是 furin 形态（文件路径），这次统一的是**调用点**：
`<Link to>`、`navigate({to})`、`redirect({to})`、`getRouteApi(pattern)`、`router.prefetch({to})`。
迁移完成后 `lib/route-manifest.ts`（`$id ↔ pattern` 的映射表，102 行）已删除。

## 2. Router API 用 furin 名字

| 旧（TanStack） | 新（furin） |
| --- | --- |
| `router.preloadRoute({...})` | `router.prefetch({...})` |
| `router.invalidate()` / `invalidate({filter})` | `router.refresh()` |
| `router.history.back()` | `window.history.back()` |
| `useRouterState({ select })` | `usePathname()` / `useNavigationPending()`（或 `router.isNavigating`） |
| `useMatches()` | `usePathname()` + 前缀判断 |
| `<Outlet />` | 布局组件的 `children` |
| `<Link viewTransition={false}>` | 删除该属性（furin `<Link>` 不支持；需要跳过过渡只在 `navigate()` 上传 `viewTransition: false`） |

## 3. `lib/nav.tsx`：兼容层 → 薄适配层

从 489 行降到 ~350 行，结构变成三块：

1. **公开 API 再导出**：`Link` / `useNavigate` / `useRouter` / `getRouteApi` 来自 `@teyik0/furin`；
   `getRouteApi(pattern)` 直接转发给框架（不再做 id 映射）。
2. **本应用的 UX 约定**：`useNavigate` 包一层 View Transition（页面上有成对的
   `view-transition-name`）；`prefetch` 的 `void` 返回值归一成 `Promise`，供
   `useIdlePreload` / `useViewportPreload` 的队列统一编排。
3. **框架缺陷绕行**（见下）。

`useSearch` 仍只读地址栏 + 根布局下发的 SSR search。原因：furin 的 SearchStore 在
`useLayoutEffect` 里提交（渲染之后），而 `assertSearchRoute` 在渲染期用上一帧快照校验
`from`；站内切页时地址栏先变、store 后提交，官方用法 `useSearch("/games")` 在首帧必抛
`[furin] useSearch("…") does not match the current route.`，整页被打成 500。
已用 Playwright 在「无任何业务代码参与」的最小探针上复现，确认是本仓库之外的时序问题，
升级 furin 后应复评并改回官方写法。详见 `docs/admin-view-site-500.md`。

## 4. 其它顺带清理

- `lib/seo.ts` 的 `seoMeta()` 返回类型由 `Record<string,string>` 改成 furin 的
  `HeadOptions`，删掉 23 处 `.head(() => seoMeta(...) as never)` 里的断言。
- 删除死代码：`parentGameFromMatches()`（TanStack 时代的 matches 读取器，无人调用）。
- `pages/` 里的 `router.invalidate({ filter })` 语义退化为「刷新当前页」：
  furin `refresh()` 没有 filter 概念，编辑页保存后刷新当前路由即可。

## 5. 保留的非文档写法（有意为之）

| 位置 | 内容 | 原因 |
| --- | --- | --- |
| `lib/nav.tsx` | `useSearch` 只读地址栏 | furin 0.8.0-alpha 的断言时序 bug（见上） |
| `lib/nav.tsx` | `NavPathProvider` + 打补丁的 history store | SSR 没有 `RouterProvider`（框架回退 `currentHref="/"`），首屏路径/激活态需要 loader 下发的真实 path |
| `lib/spa-request.ts` | `documentOnly()` / `isSpaDataRequest()` | 后台/列表页切页不重跑 `web → API → DB` 取数（仓库性能约定，见 AGENTS.md） |
| `lib/cdn-cache.ts` + `server.ts` | CDN 缓存头改写 | 源站全 SSR、公开页交 CDN，属于部署策略 |

## 6. 验证

- `bunx tsc --noEmit -p apps/web`：0 error。
- `bunx vitest run`（apps/web）：42 文件 / 329 用例全绿。
- Playwright 冒烟（真实浏览器 + 真实 DB）：首页 → 列表/合集/会社/论坛、详情页四个页签、
  搜索跳转、后台侧栏切页、后台「查看站点」、404 页，全部命中预期 URL 且无错误页；
  旧的 `useSearch` 断言 0 次。
- `oxlint`：0 error（剩余 1 条 `no-useless-fallback-in-spread` 为历史遗留，与本次无关）。

## 7. 后续可做

1. **切换到框架的 `useSearch`（待上游修复）**——目前不可用，见下节。
2. `pages/games/index.tsx`、`pages/admin/articles/[articleId]/edit.tsx` 仍带 `// @ts-nocheck`，
   建议单独排期补类型。
3. dev 模式下 `/tags` 首次编译要 15–30s（页面模块大），会触发 `ERR_EMPTY_RESPONSE`；
   属开发体验问题，生产构建不受影响。

## 切换到框架的 `useSearch`（待上游修复）

**前置条件**：furin 把 SearchStore 的提交挪到渲染之前（或让 `assertSearchRoute` 容忍切页首帧）。
判断方法：下面 1 分钟内可复验——临时把 `lib/nav.tsx` 的 `useSearch` 改成
`useFurinSearch(options?.from ?? "/")`，跑 `docs/admin-view-site-500.md` 的复现脚本；
若 `/admin` → 「查看站点」不再出现错误页，说明上游已修。

**2026-11-04 状态**：npm `latest` = `0.8.0-alpha.0`（2026-10-20），GitHub `main`（2026-10-30）
代码与已发布版本一致，**未修**；实测切回后 500 复用，故暂不切换。

上游修好后按这三步切换：

1. `lib/nav.tsx`：`useSearch` 改回框架实现（其余不动）

   ```ts
   import { useSearch as useFurinSearch } from "@teyik0/furin/search";

   export function useSearch<T = any>(options?: { from?: string; strict?: boolean }): T {
     const [search] = useFurinSearch((options?.from ?? "/") as never);
     return search as T;
   }
   ```

2. `components/home/search/Search.tsx`：恢复 `from` 入参并用 `useSearch({ from })`；
   `pages/games/index.tsx` 的搜索框改回 `<SearchInput from="/games" />`
   （首页保持 `<SearchInput />`，`from` 缺省时回落 `/`）。

3. 删掉 SSR search 管道：`pages/root.tsx` 的 loader 去掉 `search: requestSearch(request)`、
   `requestSearch()` 与 `RootLayoutProps.search`；`NavPathProvider` 去掉 `initialSearch`，
   `NavPathContext` 退回只带 `pathname`，`lib/nav.tsx` 里 `useLocationSnapshot` /
   `getServerSnapshot` 的 `searchStr` 恒为 `""`（`useLocation().search` 在 SSR 为 `{}`）。

验证：`tsc` 0 error、`vitest run` 全绿（`src/lib/nav.search.test.tsx` 里「读取根布局下发的
SSR search」用例需同步改成断言 `useSearch()` 的框架返回）、以及
`docs/admin-view-site-500.md` 的浏览器复现脚本（`/admin` → 「查看站点」无错误页、
`/games?q=` SSR 预填正确）。
