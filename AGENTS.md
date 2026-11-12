# Repository Guidelines

## Project Overview

Galzy is a Chinese-language Galgame resource platform — a Bun monorepo with an ElysiaJS backend API and a Furin (React 19 on Bun + Elysia 2) frontend. It provides game discovery via VNDB data sync, Meilisearch full-text search, OAuth authentication, nested comments, strategy guides, download management via Alist + Cloudflare Workers, and an admin panel.

**Stack:** Bun 1.3+, TypeScript 6 strict, PostgreSQL 16+ (Drizzle ORM), Redis 7+, Meilisearch, Better Auth, Furin 0.8 (Elysia 2 + Bun) frontend, Biome 2.x, Docker multi-stage builds.

## Architecture & Data Flow

```
Browser ──▶ Furin SSR (Bun + Elysia 2, port 3000)
                │  loader → BFF (in-process dispatch)
                │  Eden Treaty (typed RPC)
                ▼
         ElysiaJS API (port 3001)
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
PostgreSQL    Redis     Meilisearch
 (Drizzle)  (locks/queue) (search)
```

- **API** (`apps/api/`): ElysiaJS HTTP server. 19 domain modules, each a three-file Elysia plugin (`index.ts` routes, `model.ts` TypeBox schemas, `service.ts` business logic). Better Auth handles authentication with `auth`/`isAdmin` macros. Drizzle ORM (bun-sql adapter) for PostgreSQL. Redis only for distributed locks / idempotency / rate-limit / task queue (no business cache). Meilisearch for full-text search.
- **Web** (`apps/web/`): Furin SSR app on Bun + Elysia 2. File-based pages (`src/pages/**`, `defineRoute(...).config().loader().head().page()`); the same Elysia process serves `/api/*`. BFF handlers live in `src/server/impl/<domain>.ts` (`defineBff`) and are exposed through isomorphic surfaces in `src/server/<domain>.ts` (`bffFn`): SSR dispatches in-process, the browser POSTs `/api/_bff/:id`. TanStack Query v5 for client state (seeded from loader data via `useSeedQueries`). `src/lib/nav.tsx` is a thin navigation adapter over Furin's public APIs (`Link`/`useNavigate`/`useRouter`/`getRouteApi`/`redirect`, plus local `usePathname`/`useLocation`/`useSearch`); route ids are Furin patterns (`/:id`). shadcn/ui (base-nova style) + Tailwind CSS v4 via `bun-plugin-tailwind`.
- **Shared** (`packages/`): `libs` provides the Eden Treaty client (`treaty<app>`) with cookie forwarding and timeout. `config` provides shared TypeScript configs with path aliases (`@api`, `@web`, `@libs`). Pure TypeScript source — no build step.
- **Data flow:** Browser → SSR (server functions) → Eden Treaty → Elysia API → Drizzle ORM → PostgreSQL. Redis sits alongside only for locks / idempotency / rate-limit / queue — there is **no business read cache**. Meilisearch is populated by cron jobs and queried by the search module.

## Key Directories

```
galzy/
├── apps/api/                     # ElysiaJS backend (port 3001)
│   ├── src/
│   │   ├── index.ts              # App bootstrap — builds Elysia, mounts all modules
│   │   ├── modules/              # 19 domain modules (see below)
│   │   ├── db/                   # Drizzle ORM schema + client
│   │   │   ├── client.ts         # Bun SQL → drizzle() initialization
│   │   │   ├── schema/           # 5 schema files: alist, auth, content, services, vndb
│   │   │   └── migrate.ts        # Startup DB check — auto-migrates fresh DBs; skips (with warning) when tables exist without migration journal
│   │   └── libs/                 # Shared utilities (redis, meilisearch, typebox)
│   ├── drizzle/                  # Migration SQL files (Drizzle Kit)
│   └── .env.example              # All environment variables
├── apps/web/                     # Furin frontend (port 3000)
│   ├── src/
│   │   ├── pages/                # Furin file-based pages (~46 incl. layouts/root)
│   │   ├── server/               # BFF: impl/** (server-only) + <domain>.ts (isomorphic surfaces)
│   │   ├── api/                  # Elysia routes: /api/_bff, /api/auth, /api/search, /api/game, upload proxies
│   │   ├── components/           # shadcn/ui + custom components
│   │   ├── stores/               # TanStack React Store (UI state)
│   │   ├── hooks/                # Custom React hooks
│   │   ├── lib/                  # cn(), cookiePass(), elysiaErrorF(), etc.
│   │   ├── integrations/         # TanStack Query provider, Better Auth
│   │   └── styles.css            # Tailwind CSS v4 entry + theme variables
│   └── furin.config.ts / bunfig.toml  # Furin build + dev plugins
├── packages/
│   ├── libs/src/api/index.ts     # Eden Treaty client — treaty<app>(host, opts)
│   └── config/typescript/        # Shared tsconfig (base.json, react-library.json)
├── scripts/
│   ├── run.ts                    # Concurrent workspace command runner
│   ├── docker.ts                 # Parallel Docker builds
│   └── pakadd.ts                 # Add dep to specific workspace
├── biome.json                    # Biome formatter + linter config
├── renovate.json                 # Automated dependency updates
├── deploy/docker-compose.yml     # Dokploy Compose/Stack 全栈部署文件
└── .github/workflows/            # build-deploy.yml → GHCR + per-service Dokploy webhooks (api/web)
```

## Development Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install all workspace dependencies |
| `bun run dev` | Start all workspaces in dev mode (parallel) |
| `bun run build` | Build all workspaces |
| `bun run lint` | Run Biome check + oxlint across workspaces |
| `bun run docker` | Build all Docker images |
| `bun --cwd apps/api dev` | Start API only (watch mode, port 3001) |
| `bun --cwd apps/web dev` | Start Web only (`bun --hot src/server.ts`, port 3000) |
| `bun --cwd apps/web start` | Run the Furin production server (`.furin/build/bun/server.js`, port 3000) |
| `bun --cwd apps/web build` / `build:binary` | `furin build --target bun` → `.furin/build/bun/`; `--compile embed` → single-file binary |
| `bun --cwd apps/api db:generate` | Generate Drizzle migration |
| `bun --cwd apps/api db:up` | Apply migrations |
| `bun --cwd apps/api db:check` | Verify schema ↔ database consistency |
| `bun --cwd apps/api db:studio` | Open Drizzle Studio (visual DB explorer) |
| `bun --cwd apps/web test` | Run Vitest tests |
| `bun add:api <pkg>` | Add dependency to API workspace |
| `bun add:web <pkg>` | Add dependency to Web workspace |

**Drizzle migration rules (CRITICAL):**
- **NEVER** use `db:push` (it diffs against the entire DB including non-app tables, prompting drops).
- **NEVER** use `drizzle-kit migrate` (bug: hangs indefinitely).
- `db:up` 应用挂起迁移：走 bun-sql migrator（`src/db/up.ts`，与启动自动迁移同一实现/日志表 `drizzle.__drizzle_migrations`，幂等）。drizzle-kit 0.31 的 `up` 命令只是快照格式升级器，**不应用迁移**，不要改回 `drizzle-kit up`。
- Correct workflow: `db:generate` → `db:up` → `db:check`.

## 外部 API 使用约束（CRITICAL）

第三方 API（Kungal/NextMoe 的 `https://api.nextmoe.dev/v2`、VNDB `https://api.vndb.org/kana`，以及其他任何非本项目自建的接口）**不是可以随便扫的公开数据源**。AI 在运行时发出的每一次请求都记在真实配额与风控账上：

- **禁止无密钥批量遍历**：不要写脚本对整站 id 空间 / 全量分页「不带 key 地爬一遍」来摸底、比对或验证。这类行为会触发提供方的滥用警报（进而限流、封 IP、封来源），且难以撤销。
- **必须带上密钥**：走项目既有客户端与密钥环境变量（Kungal：`KUNGALAPI_KEY`，`nmk_` 前缀 v2 应用密钥，`Authorization: Bearer`），不要用匿名请求绕过。
- **必须遵守对方文档的速率限制**：以对方文档写明的 limits 为准并留余量（Kungal 上游配额 600 次/分，项目内客户端固定按 **300 次/分** ≈ 5 req/s 令牌桶实现、`refs=` 批量 ≤100/次；可用 `KUNGAL_RATE_PER_MIN` 往下调，但硬上限就是 300，不要拉满）；遇到 `429` 全局冷却退避，不要并发压满。
- **先量后遍历**：要扫 N 条前先确认 N；优先用批量接口（`refs=` / 多 id 查询）而不是逐 id 请求；本地已有数据（`galrc_kungal_*` 表、`docs/kungal-*.md` 里的取证结果）能复用就不要重新打接口。
- **代码入口唯一**：Kungal 的所有请求必须经 `apps/api/src/libs/kungal-api/client.ts` 的 `KungalClient`（已内置鉴权、令牌桶、429 退避）。不要在新代码或临时脚本里裸 `fetch('https://api.nextmoe.dev/...')`。
- **探测优先级**：先查 `docs/kungal-characters-api.md` / `docs/kungal-walkthroughs-api.md` 的 schema 与样本，再考虑真实请求；确需新增探测时只取 1–2 条样本并放后台任务，禁止全量扫描。

## Code Conventions & Common Patterns

### Formatting (Biome)
- 2-space indent, LF line endings, single quotes, trailing commas, semicolons as-needed
- 80-character line width, arrow parens always, JSX double quotes
- Imports organized on save (Biome assist)
- Relaxed lints: a11y off, noExplicitAny off, noUnusedImports off, useExhaustiveDependencies off

### API Module Pattern (Three-File Structure)

Every module under `apps/api/src/modules/<name>/` follows this pattern:

```
modules/games/
├── index.ts    # Elysia plugin — routes, middleware, hooks
├── model.ts    # TypeBox schemas (namespace + types)
└── service.ts  # Business logic — Drizzle queries（不写读缓存）
```

**`index.ts` — Route Plugin:**
```typescript
import { Elysia } from 'elysia'
import { GameModel } from './model'
import { Game } from './service'

export const game = new Elysia({ prefix: '/games' })
  .get('/', async ({ query: { id } }) => {
    return await Game.InfoGet({ id })
  }, { query: GameModel.infoId })
```

**`model.ts` — Validation Schemas:**
```typescript
import { t } from 'elysia'

export namespace GameModel {
  export const gameList = t.Object({
    pageSize: t.Number({ minimum: 1 }),
    pageIndex: t.Number({ minimum: 0 }),
  })
  export type gameList = typeof gameList.static
}
```
Use TypeBox (`@sinclair/typebox`) via Elysia's `t` — NEVER Zod on the API side.

**`service.ts` — Business Logic（直连 DB，不写读缓存）:**
```typescript
import { db, sql, vn, vnTitles } from '@api/libs'
import { eq, desc } from 'drizzle-orm'

export const Game = {
  async List({ pageIndex, pageSize }: GameModel.gameList) {
    // 每次请求都实时查库：靠索引与查询本身的速度，不做任何读缓存
    return await db.select().from(vn)... // Drizzle query
  },
}
```

### Auth Macros (Elysia)

Two macros defined in `modules/auth/index.ts`, available to any plugin that `.use(betterAuth)`:

```typescript
// Requires valid session; attaches session to context
.get('/protected', async () => { ... }, { auth: true })

// Requires admin role (role === 'admin'); 403 otherwise
.post('/admin-action', async () => { ... }, { isAdmin: true })
```

### Database (Drizzle ORM)

- **Client:** `apps/api/src/db/client.ts` — `new SQL(DATABASE_URL)` wrapped in `drizzle({ client, schema })`
- **Schema files:** 5 modules under `db/schema/` — `alist.ts`, `auth.ts`, `content.ts`, `services.ts`, `vndb.ts`
- **Table naming:** app tables use `galrc_` prefix; VNDB-synced tables are unprefixed (`vn`, `tags`, `releases`, `producers`, etc.)
- **Query pattern:** `db.select().from(table).where(eq(...)).orderBy(desc(...))`
- **Joins:** Use Drizzle `relations()` API for cross-table references; `sql` template literals for JSON aggregation (`json_agg`, `row_to_json`)
- **No Kysely** — the codebase uses Drizzle ORM exclusively. The `@api/libs` barrel re-exports `db`, `sql`, and all schema tables.

### Redis 使用（无业务缓存）

本仓库**不缓存业务数据**（用户明确要求：缓存是对慢设计的逃避，删掉所有缓存、把查询与索引做快）。Redis 仅承载非缓存原语，工具在 `apps/api/src/libs/redis/kv.ts`：
- `acquireLockKv(lockKey, lockValue, ttl)` / `releaseLockKv(key, value)` — 分布式锁（Lua EVALSHA）
- `acquireIdempotentKey(key, ttl)` / `storeIdempotentResult(key, result, ttl)` / `getIdempotentResult(key)` — 定时任务幂等
- `setKv` / `getKvTime` / `incrKv` — 邮箱验证码冷却、访问限流等短时计数器
- `delKvPattern(pattern)` — 队列残留锁清理（SCAN，生产安全）
- 任务队列 `@stacksjs/bun-queue` 复用同一条 `REDIS_URL`
- 所有操作走 `safeRedisOp`，Redis 不可用时优雅降级
- **不要新增业务读缓存**：页面全部 SSR，数据直连 PostgreSQL / Meilisearch。

### Frontend: Furin Patterns

**Pages** — `apps/web/src/pages/**` (文件即路由):
```tsx
import { defineRoute } from "@teyik0/furin"
import { t } from "elysia"
import * as z from "zod/mini"

export const route = defineRoute("/tags/[tagId]")
  .config({ mode: "ssr", params: t.Object({ tagId: t.String() }), query: z.object({ page: z.optional(z.number()) }) })
  .loader(async ({ params, query }) => ({ data: await getTagData({ data: { tagId: params.tagId } }) }))
  .head(({ data }) => seoMeta({ title: data.title, path: "/tags/" + data.id }) as never)
  .page(({ data }) => <TagDetailPage data={data} />)
```
- `params` 必须用 TypeBox（furin 从 `schema.properties` 读取动态段）；`query` 可用 zod（Standard Schema），但**多选 / 布尔**字段要用 TypeBox（zod 不会聚合重复 key，也不会把 "true" 转 boolean）。
- loader 返回值就是 page props；旧 `context.queryClient.setQueryData` 语义用 `@web/lib/query-seed` 的 `useSeedQueries` 复刻。
- **路由 id 一律用 furin pattern**（`/:id`、`/tags/:tagId`、`/admin`），不再有 TanStack 的 `$id` / `_layout` / `_authL`（`lib/route-manifest.ts` 已删除）。
- 组件从 `@web/lib/nav` 导入导航 API：`Link` / `useNavigate` / `useRouter` / `getRouteApi` / `redirect` 直接复用 `@teyik0/furin` 的公开接口，`usePathname` / `useLocation` / `useSearch` 是本地薄封装。
  - `router.preloadRoute` → `router.prefetch`，`router.invalidate` → `router.refresh`（furin 命名）。
  - `<Link>` 不支持 `viewTransition` 属性；需要退出过渡时只在 `navigate()` 上传 `viewTransition: false`。
  - `useSearch()` 只读地址栏：furin 0.8.0-alpha 的 `useSearch(pattern)` 在切页首帧会用上一帧 SearchStore 快照断言并抛错（把整页打成 500），绕行原因见 `docs/admin-view-site-500.md`，升级 furin 后复评。
- `pendingComponent` 无对应机制；`isNavigating` 可做顶栏加载指示。
- **loader 只服务首屏**：furin 的站内切页会重跑整条 loader 链（root → `_route` → 页面），loader 里做 `web → API → DB` 取数会直接变成切页等待。需要首屏 SSR 数据时用 `@web/lib/spa-request` 的 `documentOnly(request, load)` 包住取数：文档请求正常返回，`?_furin=data` 切页请求返回 `null`，页面内 `useQuery` 自己取（`gcTime` 5 分钟，切回命中缓存）。后台示例见 `docs/admin-spa-refactor.md`。
- 页内状态（Tab / 筛选 / 分页）用 `@web/lib/admin/use-shallow-search` 的 `useShallowSearch` 改地址栏（`history.replaceState`），**不要**用 `useNavigate`——那会触发一次页面取数与重挂载。
- **客户端预取策略**：卡片/列表默认走**意图预取**（`hooks/use-viewport-preload.ts` 的 `PREFETCH_MODE = "intent"`：hover 停留 60ms / focus / pointerdown 才发 `?_furin=data`），不要在挂载或滚入视口时成片预取——实测首页一次会打出 16 条预取，占满同源连接后把图片/会话/点击导航全排在后面。`useIdlePreload` 只用于极少量入口：等 `load` 后空闲调度、整页预算 6 条、开发模式（`bun --hot` 按需编译路由）自动关闭。排查数据与取舍见 `docs/client-navigation-perf.md`。

### 页面渲染（源站全部 SSR + CDN 边缘缓存）

- **源站不缓存**：所有页面（含 `pages/root.tsx`）一律 `config({ mode: "ssr" })`，不接 furin 页面缓存后端（`pageCache`）、不订阅缓存失效频道。每次请求都实时 SSR，数据直连 DB / Meilisearch。
- **CDN 缓存公开页**：`apps/web/src/lib/cdn-cache.ts` 在 `server.ts` 的 `.wrap()` 里把 furin 的 `no-store` 改写成 `public, max-age=0, s-maxage=<N>, stale-while-revalidate=<N>`（首页 60s、列表 60–120s、详情 300s、contact/tools 3600s）。评论页（`/*/comment`）、后台、用户中心、登录、创建编辑页保持 `no-store`。
- **写后主动清 CDN**：API 写操作成功后，service 层按精确 id 调 `libs/cloudflare-cache.ts` 的语义 helper（`purgeGamePages` / `purgeTagPages` / `purgeAfterSync` …），API 层再用 `libs/cdn-invalidation.ts` 按路由前缀兜底；两者都直接调 Cloudflare `purge_cache`（`CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_API_TOKEN`，origin 用 `SITE_URL` 或 `WEB_HOST`）。列表页的查询串变体无法枚举，靠较短的 s-maxage 自愈。
- **登录态**：`getServerSession()` 只在**当前请求内**做 single-flight 合并（基于 `request-context` 的 AsyncLocalStorage，随请求结束丢弃），**无跨请求 TTL 缓存**；root 按 `isPersonalizedPath(path)` 决定是否服务端 seed `['auth']`。公开页不读会话，避免 `Set-Cookie` 让 CDN 无法缓存。
- **统计改为写时增量聚合**：浏览量/下载量不再「每次事件写一行明细 + 读时聚合 + Redis 缓存」，而是写时自增 `galrc_stat_windows`（每对象每周一行），热榜/累计都只做小范围求和，见 `libs/stats.ts` 的 `bumpStatWindows()`。
- 历史 ISR 设计见 `docs/isr-cdn-cache.md` 顶部说明（已废弃，CDN 部分以本段为准）。

**BFF** — `apps/web/src/server`:
```ts
// impl/admin/adverts.ts (server-only)
export const adminCreateAdSlot = defineBff(z.object({ key: z.string() }), async ({ data }) => { /* Eden 调用 */ })
// server/admin/adverts.ts (browser-safe surface)
export const adminCreateAdSlot = bffFn<typeof impl.adminCreateAdSlot>("admin/adverts.adminCreateAdSlot")
```
- 页面 loader / 组件都调用 surface：SSR 走进程内 dispatch，浏览器走 `POST /api/_bff/:id`（同源 cookie）。
- 新增 handler 后运行 `bun scripts/furin/gen-registry.mjs` 重建 registry。
- `cookiePass()` / `ipPass()` 从 `src/lib/request-context.ts` 的 AsyncLocalStorage 读当前请求（`src/server.ts` 最外层 `.wrap()` 注入；必须比 furin 的 wrap 更外，才能拿到带 `?_furin=data` 的原始请求）。

**Auth (Better Auth):**
- Browser: `createAuthClient` from `better-auth/react` → `authClient.useSession()`, `authClient.signIn.email()`
- SSR: `createAuthClient` from `better-auth/client` → cookie forwarding via `getRequestHeader('Cookie')`
- Session query key: `['auth']` — prefetched via `ensureQueryData` in loaders, invalidated on signIn/signOut
- **服务端读会话一律用 `@web/server/auth/server-session` 的 `getServerSession()`**（当前请求内 single-flight 合并 + 无 cookie 直接返回 null；**无跨请求缓存**），不要直接 `authServerClient.getSession()`。
- 根布局 `pages/root.tsx` 随文档下发 `authSession` 并 seed 进 `['auth']`；客户端统一用 `@web/lib/use-auth-session` 的 `useAuthSession()` 读会话，不要各自 `authClient.getSession()`（否则每次刷新都要等一次会话请求才出登录态）。详见 `docs/auth-session-perf.md`。
- 会话以 PostgreSQL 为准（`storeSessionInDatabase: true`，`cookieCache.enabled: false`）；不再使用 Redis secondary storage。

**State (TanStack React Store):**
```typescript
import { createStore } from '@tanstack/react-store'

type ModalState = { open: boolean; data: any | null }
export const myStore = createStore<ModalState>({ open: false, data: null })
export const myActions = {
  open(data: any) { myStore.setState(s => ({ ...s, open: true, data })) },
  close() { myStore.setState(s => ({ ...s, open: false, data: null })) },
}
// Usage: useSelector(myStore, s => s.open)
```
- All stores are client-only UI state (marked `@CLIENT_ONLY`).
- `r18Store` persists to localStorage.

**Components:**
- shadcn/ui `base-nova` style, built on `@base-ui/react` primitives
- `cva` (class-variance-authority) for variant management
- `cn()` from `@web/lib/utils` (`clsx` + `tailwind-merge`) for className composition
- Icons from `lucide-react`
- Toasts from `sonner`
- Theme: light/dark/auto via `document.documentElement.classList` + CSS variables (OKLCH), persisted to localStorage

### Error Handling

- **API:** `throw status(code, message)` from Elysia for business errors. Top-level `onError` catches `VALIDATION` errors. Better Auth `APIError` for auth errors.
- **Web:** `elysiaErrorF(error)` — 401 → redirect `/auth/login`; 403/429/500/502 → throw `{ status, message }` (caught by `__root.tsx` `errorComponent`).

### Import Conventions

- **Path aliases:** `@api` → `apps/api/src`, `@web` → `apps/web/src`, `@libs` → `packages/libs/src`
- API modules import from `@api/libs` (barrel: db, schema, redis, meilisearch)
- Web server functions import `api` from `@libs` (Eden Treaty client)
- Web components import from `@web/components/ui/<name>` or `@web/components/<name>`

## Important Files

| File | Purpose |
|------|---------|
| `apps/api/src/index.ts` | API entry — builds Elysia app, mounts all modules, exports `type app` |
| `apps/api/src/modules/index.ts` | Module barrel — re-exports all API plugins |
| `apps/api/src/modules/auth/index.ts` | Auth plugin — CORS, Better Auth mount, auth/isAdmin macros |
| `apps/api/src/modules/auth/service.ts` | Better Auth config — OAuth providers, email OTP, plugins |
| `apps/api/src/db/client.ts` | DB connection — Bun SQL → drizzle() |
| `apps/api/src/db/schema/` | All table definitions (5 files) |
| `apps/api/src/libs/redis/kv.ts` | Redis locks / idempotency / rate-limit utilities（无业务缓存） |
| `apps/api/src/libs/meilisearch/index.ts` | Meilisearch singleton client |
| `apps/api/.env.example` | All environment variables |
| `apps/api/drizzle.config.ts` | Drizzle Kit config |
| `apps/web/src/pages/root.tsx` | Root document — HTML shell, theme script, providers, Header/Footer/ads |
| `apps/web/src/server/auth/auth.server.ts` | SSR auth client with cookie forwarding |
| `apps/web/src/server/auth/auth-client.ts` | Browser auth client |
| `apps/web/src/server/auth/betterPlugins.ts` | Shared Better Auth plugin config |
| `apps/web/src/lib/cookie-pass.ts` | SSR cookie forwarding for Eden calls |
| `apps/web/src/lib/elysia-error.ts` | Eden error → redirect/throw |
| `apps/web/src/lib/nav.tsx` | Navigation facade — re-exports Furin `Link`/`useNavigate`/`useRouter`/`getRouteApi`, adds view transitions, `usePathname`/`useLocation`/`useSearch` |
| `apps/web/src/lib/bff/` | Isomorphic BFF runtime (transport, dispatch, registry) |
| `packages/libs/src/api/index.ts` | Eden Treaty client — `treaty<app>(host, opts)` |
| `packages/config/typescript/base.json` | Shared tsconfig with path aliases |
| `scripts/run.ts` | Concurrent workspace command runner |
| `biome.json` | Formatter + linter config |
| `package.json` | Root workspace — `"packageManager": "bun@1.4.3"` |

## Runtime & Tooling Preferences

### Package Manager (Bun)

**All commands use `bun` — NEVER `npm`, `pnpm`, `yarn`, or `npx`.**

| Operation | Use |
|-----------|-----|
| Install | `bun install` |
| Add dep | `bun add <pkg>` |
| Remove dep | `bun remove <pkg>` |
| Run script | `bun run <script>` |
| Execute package | `bunx <cmd>` |
| Pass args | `bun run <script> -- <args>` |
| Scaffold | `bun create <template>` |

- Lock file: `bun.lock` (delete any `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` found)
- `package.json` declares `"packageManager": "bun@1.4.3"`
- `.npmrc` enforces `engine-strict=true`

### Linting & Formatting
- **Formatter:** Biome (`bun run format` or `biome format --write`)
- **Linter (API):** Biome (`bun run lint` in api)
- **Linter (Web):** oxlint (`bun run lint` in web)
- **Root lint:** `bun run lint` runs both via `scripts/run.ts`

### TypeScript
- Strict mode enabled project-wide
- `module: "Preserve"`, `target: "ESNext"`, bundler module resolution
- Path aliases: `@api/*`, `@web/*`, `@libs`
- Both apps extend `config/typescript/base.json`
- `noEmit: true` — no compilation step; Bun runs TypeScript directly

### Docker
- Multi-stage builds → 运行期精简镜像（无 shell / 无包管理器）
- API 运行镜像：`gcr.io/distroless/base`；Web 运行镜像：`cgr.dev/chainguard/glibc-dynamic`（glibc + ca-certificates，非 root 65532）
- API: `bun build --compile` → single binary
- Web: `furin build --compile embed` → `.furin/build/bun/server` 单文件二进制（静态资源内嵌）
- Web 运行镜像只有 `/app/server`，`HEALTHCHECK` 调用二进制自带的 `--healthcheck`（请求本机 `/api/health`）；入口同时兼容 Dokploy 既有的 `healthcheck` 拼写
- CI: GitHub Actions → `ghcr.io` → webhook deploy

## Testing & QA

- **Web:** Vitest v4 + Testing Library + jsdom. Run via `bun --cwd apps/web test`.
- **API:** No test infrastructure yet (no vitest config, no test files).
- Test files do not currently exist in any workspace — testing is declared but not yet implemented.
- Before adding tests, follow existing patterns: Vitest for the web app, no established convention for the API.
- Run `bun run lint` before committing — it checks all workspaces.

## Module Reference

### API Modules (`apps/api/src/modules/`)

| Module | Prefix | Auth Required | Description |
|--------|--------|---------------|-------------|
| auth | `/auth` | — | Better Auth: OAuth, email/password, email OTP, macros |
| games | `/games` | public | Game list, search, filtering, VID association, file tree |
| tags | `/tags` | public | VNDB tag localization, game-tag association, batch import/export |
| comments | `/comments` | auth + admin | Nested comments, admin pin/status, email notifications |
| topics | `/topics` | auth | Forum: CRUD, like, favorite |
| collections | `/collections` | admin (write) | Curated game collections |
| friend-links | `/friend-links` | public list / admin (write) | 友情链接：公开列表，管理员增删与拖动排序 |
| adverts | `/adverts` | public read / admin (write) | 广告位 + 素材：公开按广告位 key 读取（在投过滤 / 设备定向 / 权重轮换，直连 DB），管理员管理广告位、素材、排期与曝光/点击统计 |
| producer | `/producer` | public | Producer/developer info, game lists |
| search | `/search` | public | Meilisearch full-text search, admin embedder management |
| media | `/media` | auth | S3 image upload (avatars, game media), hash-based dedup |
| download | `/download` | public | Alist file proxy with CF Worker load balancing |
| strategy | `/strategy` | admin (write) | Game strategy guides, articles |
| views | `/views` | public | View tracking, hot games/tags rankings |
| vndb-sync | `/vndb-sync` | admin | VNDB full/delta sync with progress tracking |
| kungal-sync | `/kungal-sync` | admin | Kungal (NextMoe) catalog sync — vndb-anchored works, kungal-priority display（外部请求遵守「外部 API 使用约束」：带 `KUNGALAPI_KEY`、走 `KungalClient`、≤300 次/分 = 上游 600/分 的一半） |
| cron | — | — | Scheduled tasks: Meilisearch index, Alist sync, CF metrics |
| health | `/health` | public | Health check: `{ ok: true }` |
| status | `/status` | public | Deploy lifecycle: starting → migrating → ready / error |
| otel | — | — | OpenTelemetry tracing (production toggle) |
