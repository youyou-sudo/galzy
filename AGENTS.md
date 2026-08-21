# Repository Guidelines

## Project Overview

Galzy is a Chinese-language Galgame resource platform — a Bun monorepo with an ElysiaJS backend API and a TanStack Start (React 19) frontend. It provides game discovery via VNDB data sync, Meilisearch full-text search, OAuth authentication, nested comments, strategy guides, download management via Alist + Cloudflare Workers, and an admin panel.

**Stack:** Bun 1.3+, TypeScript 6 strict, PostgreSQL 16+ (Drizzle ORM), Redis 7+, Meilisearch, Better Auth, Biome 2.x, Docker multi-stage builds.

## Architecture & Data Flow

```
Browser ──▶ TanStack Start SSR (port 3000)
                │  createServerFn (BFF layer)
                │  Eden Treaty (typed RPC)
                ▼
         ElysiaJS API (port 3001)
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
PostgreSQL    Redis     Meilisearch
 (Drizzle)   (cache)    (search)
```

- **API** (`apps/api/`): ElysiaJS HTTP server. 17 domain modules, each a three-file Elysia plugin (`index.ts` routes, `model.ts` TypeBox schemas, `service.ts` business logic). Better Auth handles authentication with `auth`/`isAdmin` macros. Drizzle ORM (bun-sql adapter) for PostgreSQL. Redis for caching + distributed locks. Meilisearch for full-text search.
- **Web** (`apps/web-tanstack/`): TanStack Start SSR app. TanStack Router file-based routing. Server Functions (`createServerFn`) act as BFF layer, calling the API via Eden Treaty. TanStack Query v5 for server state. TanStack React Store for UI state. shadcn/ui (base-nova style) + Tailwind CSS v4.
- **Shared** (`packages/`): `libs` provides the Eden Treaty client (`treaty<app>`) with cookie forwarding and timeout. `config` provides shared TypeScript configs with path aliases (`@api`, `@web`, `@libs`). Pure TypeScript source — no build step.
- **Data flow:** Browser → SSR (server functions) → Eden Treaty → Elysia API → Drizzle ORM → PostgreSQL. Redis sits alongside as cache. Meilisearch is populated by cron jobs and queried by the search module.

## Key Directories

```
galzy/
├── apps/api/                     # ElysiaJS backend (port 3001)
│   ├── src/
│   │   ├── index.ts              # App bootstrap — builds Elysia, mounts all modules
│   │   ├── modules/              # 17 domain modules (see below)
│   │   ├── db/                   # Drizzle ORM schema + client
│   │   │   ├── client.ts         # Bun SQL → drizzle() initialization
│   │   │   ├── schema/           # 5 schema files: alist, auth, content, services, vndb
│   │   │   └── migrate.ts        # Startup DB check — auto-migrates fresh DBs; skips (with warning) when tables exist without migration journal
│   │   └── libs/                 # Shared utilities (redis, meilisearch, typebox)
│   ├── drizzle/                  # Migration SQL files (Drizzle Kit)
│   └── .env.example              # All environment variables
├── apps/web-tanstack/            # TanStack Start frontend (port 3000)
│   ├── src/
│   │   ├── routes/               # File-based routes (~35 route files)
│   │   ├── server/               # Server Functions (BFF layer per domain)
│   │   ├── components/           # shadcn/ui + custom components
│   │   ├── stores/               # TanStack React Store (UI state)
│   │   ├── hooks/                # Custom React hooks
│   │   ├── lib/                  # cn(), cookiePass(), elysiaErrorF(), etc.
│   │   ├── integrations/         # TanStack Query provider, Better Auth
│   │   └── styles.css            # Tailwind CSS v4 entry + theme variables
│   └── vite.config.ts            # Vite 8 + TanStack Start + Tailwind
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
| `bun --cwd apps/web-tanstack dev` | Start Web only (Vite dev, port 3000) |
| `bun --cwd apps/api db:generate` | Generate Drizzle migration |
| `bun --cwd apps/api db:up` | Apply migrations |
| `bun --cwd apps/api db:check` | Verify schema ↔ database consistency |
| `bun --cwd apps/api db:studio` | Open Drizzle Studio (visual DB explorer) |
| `bun --cwd apps/web-tanstack test` | Run Vitest tests |
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

### Frontend: TanStack Start Patterns

**Server Functions (BFF layer)** — `apps/web-tanstack/src/server/<domain>/`:
```typescript
import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import z from 'zod'

// GET with Zod validation
export const getGameDetail = createServerFn()
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { data: result, error } = await api.games.get({ query: { id: data.id } })
    elysiaErrorF(error)  // MUST call on every Eden response
    return result
  })

// Authenticated request — forward cookies
import { cookiePass } from '@web/lib'
const { data, error } = await api.comments.post(body, cookiePass())
```
- All server functions MUST use `.validator()` with Zod for input validation.
- Every Eden response MUST pass `error` to `elysiaErrorF()` — 401 redirects to login, others throw structured errors.
- Authenticated calls use `cookiePass()` which returns `{ fetch: { headers: { cookie: ... } } }`.

**Route patterns:**
- `beforeLoad` for auth guards (admin `_authL.tsx` only)
- `loader` + `loaderDeps` for data loading with search param dependencies
- `validateSearch` with Zod schemas for typed search params
- `head()` for dynamic meta/title
- `pendingComponent` for loading skeletons
- `staleTime`/`gcTime` in loaders for client-side caching

**Auth (Better Auth):**
- Browser: `createAuthClient` from `better-auth/react` → `authClient.useSession()`, `authClient.signIn.email()`
- SSR: `createAuthClient` from `better-auth/client` → cookie forwarding via `getRequestHeader('Cookie')`
- Session query key: `['auth']` — prefetched via `ensureQueryData` in loaders, invalidated on signIn/signOut

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

- **Path aliases:** `@api` → `apps/api/src`, `@web` → `apps/web-tanstack/src`, `@libs` → `packages/libs/src`
- API modules import from `@api/libs` (barrel: db, schema, redis, meilisearch)
- Web server functions import `api` from `@libs` (Eden Treaty client)
- Web components import from `@web/components/ui/<name>` or `@web/components/<name>`

## Important Files

| File | Purpose |
|------|---------|
| `apps/api/src/index.ts` | API entry — builds Elysia app, mounts all modules, exports `type app` |
| `apps/api/src/modules/index.ts` | Module barrel — re-exports all 17 plugins |
| `apps/api/src/modules/auth/index.ts` | Auth plugin — CORS, Better Auth mount, auth/isAdmin macros |
| `apps/api/src/modules/auth/service.ts` | Better Auth config — OAuth providers, email OTP, plugins |
| `apps/api/src/db/client.ts` | DB connection — Bun SQL → drizzle() |
| `apps/api/src/db/schema/` | All table definitions (5 files) |
| `apps/api/src/libs/redis/kv.ts` | Redis KV, locks, idempotency utilities |
| `apps/api/src/libs/meilisearch/index.ts` | Meilisearch singleton client |
| `apps/api/.env.example` | All environment variables |
| `apps/api/drizzle.config.ts` | Drizzle Kit config |
| `apps/web-tanstack/src/routes/__root.tsx` | Root route — HTML shell, theme script, providers |
| `apps/web-tanstack/src/router.tsx` | TanStack Router config |
| `apps/web-tanstack/src/server/auth/auth.server.ts` | SSR auth client with cookie forwarding |
| `apps/web-tanstack/src/server/auth/auth-client.ts` | Browser auth client |
| `apps/web-tanstack/src/server/auth/betterPlugins.ts` | Shared Better Auth plugin config |
| `apps/web-tanstack/src/lib/cookie-pass.ts` | SSR cookie forwarding for Eden calls |
| `apps/web-tanstack/src/lib/elysia-error.ts` | Eden error → redirect/throw |
| `apps/web-tanstack/vite.config.ts` | Vite config — TanStack Start, Tailwind, React Compiler |
| `packages/libs/src/api/index.ts` | Eden Treaty client — `treaty<app>(host, opts)` |
| `packages/config/typescript/base.json` | Shared tsconfig with path aliases |
| `scripts/run.ts` | Concurrent workspace command runner |
| `biome.json` | Formatter + linter config |
| `package.json` | Root workspace — `"packageManager": "bun@1.3.14"` |

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
- `package.json` declares `"packageManager": "bun@1.3.14"`
- `.npmrc` enforces `engine-strict=true`

### Linting & Formatting
- **Formatter:** Biome (`bun run format` or `biome format --write`)
- **Linter (API):** Biome (`bun run lint` in api)
- **Linter (Web):** oxlint (`bun run lint` in web-tanstack)
- **Root lint:** `bun run lint` runs both via `scripts/run.ts`

### TypeScript
- Strict mode enabled project-wide
- `module: "Preserve"`, `target: "ESNext"`, bundler module resolution
- Path aliases: `@api/*`, `@web/*`, `@libs`
- Both apps extend `config/typescript/base.json`
- `noEmit: true` — no compilation step; Bun runs TypeScript directly

### Docker
- Multi-stage builds → `gcr.io/distroless/base` runtime
- API: `bun build --compile` → single binary
- Web: Vite build + `bun build --compile` → single binary with embedded assets
- CI: GitHub Actions → `ghcr.io` → webhook deploy

## Testing & QA

- **Web:** Vitest v4 + Testing Library + jsdom. Run via `bun --cwd apps/web-tanstack test`.
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
| producer | `/producer` | public | Producer/developer info, game lists |
| search | `/search` | public | Meilisearch full-text search, admin embedder management |
| media | `/media` | auth | S3 image upload (avatars, game media), hash-based dedup |
| download | `/download` | public | Alist file proxy with CF Worker load balancing |
| strategy | `/strategy` | admin (write) | Game strategy guides, articles |
| views | `/views` | public | View tracking, hot games/tags rankings |
| vndb-sync | `/vndb-sync` | admin | VNDB full/delta sync with progress tracking |
| cron | — | — | Scheduled tasks: Meilisearch index, Alist sync, CF metrics |
| health | `/health` | public | Health check: `{ ok: true }` |
| status | `/status` | public | Deploy lifecycle: starting → migrating → ready / error |
| otel | — | — | OpenTelemetry tracing (production toggle) |
