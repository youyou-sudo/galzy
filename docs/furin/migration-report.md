# 前端 Furin 重构报告（feat/furin-frontend）

## 目标

把 `apps/web-tanstack` 从 TanStack Start 重构到 [@teyik0/furin](https://teyik0.github.io/furin/) 0.8.0-alpha.0（Bun + Elysia 2 + 文件路由 + SSR），**UX 与 UI 结果保持与迁移前一致**。

调研产物：[furin-implementation-guide.md](./furin-implementation-guide.md)（1229 行，20 项能力逐项 ✅/⚠️/❌ + TanStack 对照表 + 10 个决策点）。

## 目标架构

```text
浏览器
  │  GET /<page>               (文档请求，SSR loader 取数)
  │  GET /<page>?_furin=data   (SPA 导航，NDJSON 路由数据)
  │  POST /api/_bff/:id        (客户端 BFF 调用，同源 cookie)
  ▼
Furin (Bun + Elysia 2, :3000)
  ├── pages/**      defineRoute(...).config().loader().head().page()
  ├── api/**        Elysia 路由（_bff、auth 代理、search/game/上传代理、health）
  └── server/impl   defineBff(handler)  ← 原 createServerFn 的 body，server-only
        │ Eden Treaty + cookie/ip 透传
        ▼
Elysia API (:3001)
```

关键机制：

1. **server function → BFF surface**
   - `createServerFn().validator(S).handler(H)` 机械转换为 `defineBff(S, H)`，文件落到 `src/server/impl/<domain>.ts`（带 `@teyik0/furin/server-only`）。
   - 同名 surface `src/server/<domain>.ts` 只保留 `bffFn<typeof impl.fn>("domain.fn")`（120 个函数），因此**所有组件调用点零改动**。
   - SSR：`bffFn` 的 `.server` 分支动态 import `lib/bff/server` → registry 进程内 dispatch（无 HTTP hop）；浏览器：`.client` 分支 POST `/api/_bff/:id`。
   - Furin 的 strip 插件在生产 client bundle 中整体移除 `.server` 分支与其独占 import（已实测 grep 无 server-only 代码）。
2. **请求上下文**：`.server` 分支拿不到 Request，因此用 Elysia `onRequest` + AsyncLocalStorage（挂在 `globalThis[Symbol.for]`，规避 dev 双模块图）注入 `src/lib/request-context.ts`；`cookiePass()`/`ipPass()`/`authServerClient` 改为读它，业务 handler 主体无需改动。
3. **查询缓存**：旧 app 靠 TanStack Start 的 SSR dehydrate/hydrate；现在 loader 数据作为 page props 下发，页面组件用 `useSeedQueries` 在渲染期灌回同 key 的 TanStack Query 缓存（首屏不闪空、不重复请求）。
4. **路由兼容层** `src/lib/nav.tsx`：Link / useNavigate / useRouter / useRouterState / useSearch / useParams / useMatches / useLocation / Outlet / getRouteApi / redirect / Await，语义对齐 @tanstack/react-router；旧 route id 通过生成的 `lib/route-manifest.ts` 映射到 Furin pattern。222 处 `Link`、43 处 `useNavigate`、21 处 `useSearch` 等调用点因此不用改。
5. **SSR 路径**：根布局从 Furin 拿原生 `path` prop，经 `NavPathProvider` 提供给首帧 useRouterState（消除 Header 激活态 hydration mismatch）；客户端改由 history store 驱动。

## 变更清单

| 区域 | 变更 |
|---|---|
| 依赖 | 移除 @tanstack/react-start / react-router / router-devtools / ssr-query / vite / nitro / @tailwindcss/vite / @vitejs/plugin-react / @tanstack/router-plugin / devtools；新增 @teyik0/furin 0.8.0-alpha.0、elysia 2.0.0-beta.32、bun-plugin-tailwind、evlog、exact-mirror、typebox、react 19.3.1 |
| 路由 | 43 个页面 + 2 个布局从 `src/routes/**` 改写为 `src/pages/**`（id/URL 不变）；`__root.tsx` → `pages/root.tsx`；error/not-found 改为 `pages/error.tsx`/`pages/not-found.tsx` |
| BFF | 22 个 server 模块拆成 `src/server/impl/**`（120 个 defineBff）+ `src/server/<domain>.ts` surface + 自动生成的 `registry.ts` |
| API | `src/routes/api/*` 迁移为 Elysia 插件（`src/api/`：_bff、auth 代理、search、game、upload/upload-image、health） |
| 入口 | `src/server.ts`（Elysia + furin + ALS + `--healthcheck`）；dev 用 `bun --hot`，无需 Vite |
| 构建 | `furin.config.ts` + `bunfig.toml`；`furin build --target bun` → `.furin/build/bun/`；`--compile embed` → 单文件；Dockerfile 改为构建单文件二进制 |
| 清理 | 删除 router.tsx / routeTree.gen.ts / vite 配置与插件 / Nitro 产物脚本 / capability-probe / devtools |
| 文档 | README 重写；AGENTS.md 栈、目录、BFF/页面约定更新；`docs/furin/` 调研与报告 |
| 测试 | `vitest.config.ts` 补回 tsconfig paths 与 jsdom；测试 mock 改为 `@web/lib/nav`；275/275 通过 |

## 验证结果

- `bunx tsc --noEmit`：**0 error**（120 个 BFF 函数保持 Eden 推导类型）。
- `bunx vitest run`：**275 passed / 34 files**。
- `furin build --target bun`：成功（client bundle + server.js）；`bun .furin/build/bun/server.js` 生产模式启动正常。
- 全站冒烟：43 个页面 + 布局全部 200；`/producer` 为迁移前既有 500；`/admin/**`、`/user`、`/introduction/*` 未登录 302 到登录页（与旧版一致，`return_to` 保留）。
- 浏览器（headless Chrome）：hydration 无 mismatch、控制台无报错，SPA 导航 `/tools → /tags` 正常更新 URL/标题/内容，`POST /api/_bff/adverts.getAdSlot` 200，`/api/auth/get-session` 200。
- UI 平价：`.parity/` 基线（旧版生产构建，43 路由 × 3 变体 = 129 张）vs `candidate-furin`（新版生产构建，同一 manifest/视口/主题），报告见 `.parity/reports/after-furin/report.md`。

  | 变体 | 通过 | 平均像素差 | 说明 |
  | --- | ---: | ---: | --- |
  | 1440x900-light | 15/43 | 1.43% | 未通过项见下 |
  | 1440x900-dark | 16/43 | 1.62% | 同上 |
  | 390x844-light | 16/43 | 2.86% | 同上 |

  未通过项的构成（逐条核对）：
  - **视觉一致，仅 URL/标题归一化差异**：admin 12 条（仅多 `return_to` 查询参数，像素差 0.07%）、`/$id/comment` 等 5 条（旧版标题错用了「下载」，新版为「评论」；tag 文案 `# x` vs `#x` 是文本归一化把两个节点拼在一起的产物，像素差 0.02%）。
  - **默认值不进 URL**：`/games`、`/collections`、`/tags`、`/topics`、`/search`、`/producer` 等（Furin 会把等于 schema 默认值的参数从地址栏省略；页面内容一致）。
  - **内容漂移/图片长尾**：首页「本周热门」是周榜，基线与候选相隔约 17 小时，名次变化会让封面整体换位（diff 图上表现为大片红色封面块）；合集/移动端若干路由同理来自远程封面加载与否不一致。均为数据/网络噪声，不是布局或样式差异。
  - 本地静态资源（广告素材 `/dzmm.webp`、友链头像 `/telegram.png`、`/robots.txt`）已由 `src/api/public.ts` 301 到 `/public/*` 修复，见「已知差异 #4」。
  - **迁移前既有错误页**：`/producer`（旧版即 500）、`/auth/signup/Verification`（旧版 500，新版为 422 参数校验）。

## 已知差异 / 风险

1. **pendingComponent 无对应机制**：Furin SPA 导航在 loader 完成前保留旧页面（旧版 60ms 后切骨架屏）。顶栏 spinner 仍由兼容层的导航态驱动；整页骨架屏不再出现。
2. **共享元素 View Transition 未接线**：旧版 `defaultViewTransition` 让游戏封面/标题跨页飞入；Furin 侧保留组件的 `viewTransitionName`，但兼容层尚未用 `document.startViewTransition` 包裹导航（可在 `lib/nav.tsx` 单点补上）。
3. **响应头**：Furin 按渲染模式接管 `Cache-Control`（ssr 一律 `no-store`），旧 `headers(): Cache-Control/Cache-Tag` 的 CDN 语义只能改为 ISR + `config({ tags })`，本次未切换（页面行为不变，CDN 缓存策略需部署侧确认）。预压缩 `.gz/.br` 产物没有对应物。
4. **静态资源 URL**：Furin 的 public 资源在 `/public/*`，代码内引用已同步；历史遗留的根路径资源（广告素材 `/dzmm.webp`、友情链接头像 `/telegram.png`、`/robots.txt` 等，含 DB 里存的值）由 `src/api/public.ts` 统一 **301 到 `/public/*`**：内置 10 个已知文件 + 通用规则（根级 `*.webp|png|ico|txt|xml|woff2` 等，排除 `/api`、`/public`、`/_client`、`/_bun`、`/_furin`），因此不会再出现 `dzmm-bk0xvbek.webp` 这类打包哈希路径或 500。页面 URL 不含扩展名，`/:id` 游戏页不受影响。
5. **Better Auth**：`tanstackStartCookies` 插件已移除（与 Furin 不兼容）。读会话正常；若某流程依赖「服务端 server function 设置 cookie」（如 email OTP 验证），需要 BFF 侧补 Set-Cookie 转发（当前登录走 `/api/auth/*` 代理，不受影响）。
6. **zod query 限制**：重复 key 聚合与 `"true"` → boolean 仅 TypeBox 支持；`/admin/tasks` 已改用 TypeBox 双生 schema，其余页面仅用标量参数。
7. **admin 视觉未验证**：无管理员凭据，仅验证 302 守卫、类型、模块注册；登录态下的首屏播种需要人工 QA。
8. **Elysia 2 beta + alpha 框架**：版本已锁定；后续升级需重跑平价与 BFF。
9. **Docker**：Dockerfile 已改为 `build:binary` 单文件；Linux 交叉编译未在本机验证（Windows 上 `--compile embed` 产物已实测可运行）。

## 运行

```bash
bun install
bun --cwd apps/web-tanstack dev        # :3000（API 需在 :3001）
bun --cwd apps/web-tanstack typegen    # 新增/移动页面后
bun --cwd apps/web-tanstack build      # .furin/build/bun/
```

平价回归：

```bash
bun scripts/parity/capture.ts --base http://localhost:3103 --out .parity/candidate-furin \
  --manifest .parity/routes.json --variants desktop-light,desktop-dark,mobile-light --concurrency 5
bun scripts/parity/diff.ts --baseline .parity/baseline --candidate .parity/candidate-furin \
  --out .parity/reports/after-furin
```