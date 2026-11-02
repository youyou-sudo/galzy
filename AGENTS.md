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
 (Drizzle)   (cache)    (search)
```

- **API** (`apps/api/`): ElysiaJS HTTP server. 19 domain modules, each a three-file Elysia plugin (`index.ts` routes, `model.ts` TypeBox schemas, `service.ts` business logic). Better Auth handles authentication with `auth`/`isAdmin` macros. Drizzle ORM (bun-sql adapter) for PostgreSQL. Redis for caching + distributed locks. Meilisearch for full-text search.
- **Web** (`apps/web/`): Furin SSR app on Bun + Elysia 2. File-based pages (`src/pages/**`, `defineRoute(...).config().loader().head().page()`); the same Elysia process serves `/api/*`. BFF handlers live in `src/server/impl/<domain>.ts` (`defineBff`) and are exposed through isomorphic surfaces in `src/server/<domain>.ts` (`bffFn`): SSR dispatches in-process, the browser POSTs `/api/_bff/:id`. TanStack Query v5 for client state (seeded from loader data via `useSeedQueries`). `src/lib/nav.tsx` is a TanStack-Router-compatible navigation layer (Link/useNavigate/useRouterState/useSearch/getRouteApi/redirect). shadcn/ui (base-nova style) + Tailwind CSS v4 via `bun-plugin-tailwind`.
- **Shared** (`packages/`): `libs` provides the Eden Treaty client (`treaty<app>`) with cookie forwarding and timeout. `config` provides shared TypeScript configs with path aliases (`@api`, `@web`, `@libs`). Pure TypeScript source — no build step.
- **Data flow:** Browser → SSR (server functions) → Eden Treaty → Elysia API → Drizzle ORM → PostgreSQL. Redis sits alongside as cache. Meilisearch is populated by cron jobs and queried by the search module.

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
└── service.ts  # Business logic — Drizzle queries, Redis cache
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

**`service.ts` — Business Logic:**
```typescript
import { db, sql, vn, vnTitles } from '@api/libs'
import { eq, desc } from 'drizzle-orm'
import { getKv, setKv } from '@api/libs/redis'

export const Game = {
  async List({ pageIndex, pageSize }: GameModel.gameList) {
    // Check Redis cache first
    const cached = await getKv(`galzy:games:list:${pageIndex}:${pageSize}`)
    if (cached) return JSON.parse(cached)

    // Query DB
    const result = await db.select().from(vn)... // Drizzle query

    // Cache result
    await setKv(`galzy:games:list:${pageIndex}:${pageSize}`, JSON.stringify(result), 3600)
    return result
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

### Redis Caching

Utilities in `apps/api/src/libs/redis/kv.ts`:
- `getKv(key)` / `setKv(key, value, ttl?)` / `delKv(key)` — basic KV operations
- `delKvPattern(pattern)` — SCAN-based batch delete (production-safe)
- `acquireLockKv(lockKey, lockValue, ttl)` / `releaseLockKv(key, value)` — distributed locks via Lua EVALSHA
- `acquireIdempotentKey(key, ttl)` / `storeIdempotentResult(key, result, ttl)` — idempotency for cron jobs
- Key convention: `galzy:<domain>:<id>[:<params>]`
- Typical TTLs: 30min (counts), 1hr (tags, lists), 2hr (game lists), 6hr (game info)
- All operations use `safeRedisOp` wrapper — fails gracefully if Redis is unavailable

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
- 组件仍从 `@web/lib/nav` 导入 Link / useNavigate / useRouterState / useSearch / useParams / getRouteApi / redirect（兼容层，旧 route id 由 `lib/route-manifest.ts` 映射）。
- `pendingComponent` 无对应机制；`isNavigating` 可做顶栏加载指示。
- **loader 只服务首屏**：furin 的站内切页会重跑整条 loader 链（root → `_route` → 页面），loader 里做 `web → API → DB` 取数会直接变成切页等待。需要首屏 SSR 数据时用 `@web/lib/spa-request` 的 `documentOnly(request, load)` 包住取数：文档请求正常返回，`?_furin=data` 切页请求返回 `null`，页面内 `useQuery` 自己取（`gcTime` 5 分钟，切回命中缓存）。后台示例见 `docs/admin-spa-refactor.md`。
- 页内状态（Tab / 筛选 / 分页）用 `@web/lib/admin/use-shallow-search` 的 `useShallowSearch` 改地址栏（`history.replaceState`），**不要**用 `useNavigate`——那会触发一次页面取数与重挂载。
- **客户端预取策略**：卡片/列表默认走**意图预取**（`hooks/use-viewport-preload.ts` 的 `PREFETCH_MODE = "intent"`：hover 停留 60ms / focus / pointerdown 才发 `?_furin=data`），不要在挂载或滚入视口时成片预取——实测首页一次会打出 16 条预取，占满同源连接后把图片/会话/点击导航全排在后面。`useIdlePreload` 只用于极少量入口：等 `load` 后空闲调度、整页预算 6 条、开发模式（`bun --hot` 按需编译路由）自动关闭。排查数据与取舍见 `docs/client-navigation-perf.md`。

### 用户视图缓存（ISR + CDN）

- **页面分级**：用户视图（首页/游戏/标签/合集/厂商/论坛/友链/contact 等）用 `config({ mode: "isr", revalidate, tags })`，由源站（Redis 页面缓存）+ CDN（Cloudflare）两层缓存；后台/用户中心/登录/创建编辑页保持 `ssr`。根布局 `pages/root.tsx` 必须是 `isr`——它若为 ssr，furin 的 `resolveDocumentMode` 会把整条链回落成 ssr。
- **登录态绝不进缓存**：根布局只用 `isPersonalizedPath(path)` 命中的路径在服务端取会话（`authKnown = true` 时才 seed `['auth']`）；用户视图的登录态由客户端 `useAuthSession()` 取。ISR 页面的 loader 禁止读会话/cookie（`PublicLoaderContext` 会直接抛错），需要个性化数据要么给 BFF 加 `publicOnly` 跳过会话，要么放到组件里的 `useQuery`。
- **失效链路（Redis 频道，跨进程只靠一条 `REDIS_URL`）**：API 写操作（2xx 的 POST/PUT/PATCH/DELETE）→ `apps/api/src/libs/isr-invalidation.ts` 按路由前缀分流 → `libs/cloudflare-cache.ts` 的语义 helper → publish `galzy:isr:invalidate` → web 订阅后 `revalidatePath()` / `revalidateTag()` 删 Redis 页面产物，并把实际失效 URL publish 到 `galzy:isr:cdn-purge` → API 订阅后用 Cloudflare 凭据按 URL 清 CDN（频道常量见 `packages/libs/src/isr.ts`）。新增写接口要把它加进前缀映射；新增列表筛选维度时给路由补 `tags`（标签能连带清掉所有查询串变体）。
- **连接配置**：web 与 API 一样只认一条 `REDIS_URL`（`@web/lib/redis` 用 Bun 内置客户端；本地开发默认不用 Redis，可设 `REDIS_ENABLED=true` 调试）。Cloudflare 凭据/`SITE_URL` 只留在 API 进程；CDN 侧仍需 Cache Rule：`/admin/*`、`/api/*`、`/auth/*`、`/user/*` Bypass，其余 GET 页面尊重源站 Cache-Control。
- 设计与取舍见 `docs/isr-cdn-cache.md`。

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
- **服务端读会话一律用 `@web/server/auth/server-session` 的 `getServerSession()`**（15s 进程内缓存 + 并发合并 + 无 cookie 直接返回 null），不要直接 `authServerClient.getSession()`：会话查询在远端库上单次可达 1.2s，而它散落在多个 BFF/loader 里，列表页预取会把开销放大十倍。
- 根布局 `pages/root.tsx` 随文档下发 `authSession` 并 seed 进 `['auth']`；客户端统一用 `@web/lib/use-auth-session` 的 `useAuthSession()` 读会话，不要各自 `authClient.getSession()`（否则每次刷新都要等一次会话请求才出登录态）。详见 `docs/auth-session-perf.md`。
- API 侧会话配了 Redis secondary storage（`apps/api/src/modules/auth/service.ts`，`storeSessionInDatabase: true` 保底）；升级前的旧会话可用 `bun --cwd apps/api run scripts/prewarm-auth-sessions.ts --apply` 预热进 Redis。

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
| `apps/api/src/libs/redis/kv.ts` | Redis KV, locks, idempotency utilities |
| `apps/api/src/libs/meilisearch/index.ts` | Meilisearch singleton client |
| `apps/api/.env.example` | All environment variables |
| `apps/api/drizzle.config.ts` | Drizzle Kit config |
| `apps/web/src/pages/root.tsx` | Root document — HTML shell, theme script, providers, Header/Footer/ads |
| `apps/web/src/router.tsx` | TanStack Router config |
| `apps/web/src/server/auth/auth.server.ts` | SSR auth client with cookie forwarding |
| `apps/web/src/server/auth/auth-client.ts` | Browser auth client |
| `apps/web/src/server/auth/betterPlugins.ts` | Shared Better Auth plugin config |
| `apps/web/src/lib/cookie-pass.ts` | SSR cookie forwarding for Eden calls |
| `apps/web/src/lib/elysia-error.ts` | Eden error → redirect/throw |
| `apps/web/src/lib/nav.tsx` | TanStack Router compatible navigation layer |
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
| adverts | `/adverts` | public read / admin (write) | 广告位 + 素材：公开按广告位 key 读取（在投过滤 / 设备定向 / 权重轮换，Redis 60s 缓存），管理员管理广告位、素材、排期与曝光/点击统计 |
| producer | `/producer` | public | Producer/developer info, game lists |
| search | `/search` | public | Meilisearch full-text search, admin embedder management |
| media | `/media` | auth | S3 image upload (avatars, game media), hash-based dedup |
| download | `/download` | public | Alist file proxy with CF Worker load balancing |
| strategy | `/strategy` | admin (write) | Game strategy guides, articles |
| views | `/views` | public | View tracking, hot games/tags rankings |
| vndb-sync | `/vndb-sync` | admin | VNDB full/delta sync with progress tracking |
| kungal-sync | `/kungal-sync` | admin | Kungal (NextMoe) catalog sync — vndb-anchored works, kungal-priority display |
| cron | — | — | Scheduled tasks: Meilisearch index, Alist sync, CF metrics |
| health | `/health` | public | Health check: `{ ok: true }` |
| status | `/status` | public | Deploy lifecycle: starting → migrating → ready / error |
| otel | — | — | OpenTelemetry tracing (production toggle) |
