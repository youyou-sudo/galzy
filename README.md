# Galzy

> 面向中文玩家的 Galgame 资源平台：发现、搜索、下载、攻略与社区，一站整合。

![Bun](https://img.shields.io/badge/Bun-1.4+-000?logo=bun) ![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript) ![ElysiaJS](https://img.shields.io/badge/ElysiaJS-1.4-6B46C1?logo=elysia) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![License](https://img.shields.io/badge/License-MIT-brightgreen)

## 核心特性

- **全文搜索** — Meilisearch 三索引（游戏 / 标签 / 制作商），中文优化
- **VNDB 同步** — Kana API 全量/增量同步，分布式锁 + 进度跟踪 + CDN 缓存清理
- **KunGal 同步** — 对接 NextMoe·未萌开放 API，以 VNDB ID 为锚点
- **登录方式** — 邮箱密码、邮箱 OTP；GitHub / Discord / Twitter / Kungal / Linux.do / Hikarinagi OAuth
- **标签系统** — VNDB 标签中文化、游戏关联、批量导入导出
- **评论与论坛** — 嵌套评论、置顶/审核、回复邮件通知；话题发布、点赞、收藏
- **攻略** — Markdown 文章 CRUD 与游戏关联
- **下载** — Cloudreve 签名直链，CF Worker 节点配置与文件同步
- **访问统计** — 自建事件追踪（`galrc_event_views`）与热门排行
- **任务队列** — `@stacksjs/bun-queue`，管理端可查状态/日志并手动入队
- **管理后台** — 用户、评论、文章、合集、广告位、友情链接、搜索索引
- **OpenAPI** — `@elysia/openapi` 自动生成接口文档
- **容器化** — distroless / Chainguard 精简镜像，GHCR + Dokploy 自动部署

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Furin 0.8（Bun + Elysia 2 SSR）· React 19 · TanStack Query v5 / Store / Form · Tailwind CSS v4（`bun-plugin-tailwind`）· shadcn/ui（base-nova）· React Compiler |
| 后端 | ElysiaJS ^1.4 · TypeBox 校验 · Better Auth ^1.7 · `@stacksjs/bun-queue` |
| 数据 | PostgreSQL 16+（Drizzle ORM）· Redis（Bun 内置客户端）· Meilisearch |
| 工程 | Bun workspaces · TypeScript strict · Biome + oxlint · Vitest · Docker 多阶段 · GitHub Actions |

## 架构

```
浏览器 ──▶ Furin SSR（:3000）
             │  loader / 组件调用 BFF（SSR 进程内 dispatch，浏览器 POST /api/_bff/:id）
             │  Eden Treaty（类型安全 RPC）
             ▼
        ElysiaJS API（:3001）
             │
   ┌─────────┼──────────┐
   ▼         ▼          ▼
PostgreSQL  Redis   Meilisearch
 (Drizzle) （缓存/锁） （搜索）
```

- 同一 Elysia 进程既渲染页面，也提供 `/api/*`（BFF、auth、上传代理）
- Redis 提供缓存、分布式锁、幂等键；开发模式默认关闭（直查 DB），`REDIS_ENABLED=true` 可强制开启
- 后台任务经 bun-queue 异步执行，管理端 `/tasks` 查进度与日志

## 项目结构

```
galzy/
├── apps/
│   ├── api/                      # ElysiaJS 后端（:3001）
│   │   └── src/
│   │       ├── index.ts          # 应用入口，挂载全部模块
│   │       ├── modules/          # 20 个业务模块（index / model / service 三文件）
│   │       ├── db/               # Drizzle schema、客户端、启动自动迁移
│   │       └── libs/             # redis / meilisearch / queue / vndb-api / cloudreve / identity
│   └── web-tanstack/             # Furin 前端（:3000）
│       └── src/
│           ├── pages/            # 文件即路由（defineRoute）
│           ├── server/           # BFF：impl/（defineBff）+ 同构 surface（bffFn）
│           ├── api/              # /api/* 路由：BFF、auth、搜索、上传代理
│           ├── components/       # shadcn/ui + 业务组件
│           ├── stores/ · hooks/  # 客户端 UI 状态与 Hooks
│           └── lib/              # nav、cookiePass、bff、utils
├── packages/
│   ├── libs/                     # Eden Treaty 客户端（含 Cookie 转发）
│   └── config/typescript/        # 共享 tsconfig（@api / @web / @libs）
├── scripts/                      # run.ts / docker.ts / pakadd.ts
└── .github/workflows/build-deploy.yml
```

## API 模块

| 模块 | 前缀 | 权限 | 说明 |
|---|---|---|---|
| auth | `/auth` | — | Better Auth：OAuth、密码、OTP，`auth` / `isAdmin` 宏 |
| games | `/games` | 公开 | 列表、详情、筛选、文件树、VID 关联 |
| search | `/search` | 公开 | Meilisearch 搜索、索引与 Embedder 管理 |
| tags | `/tags` | 公开 | 标签中文化、游戏关联、批量导入导出 |
| comments | `/comments` | 登录写 | 嵌套评论、置顶/审核、邮件通知 |
| topics | `/topics` | 登录 | 论坛话题：CRUD、点赞、收藏 |
| collections | `/collections` | 管理员写 | 精选合集 |
| friend-links | `/friend-links` | 管理员写 | 友情链接与排序 |
| adverts | `/adverts` | 管理员写 | 广告位与素材、排期、曝光统计 |
| producer | `/producer` | 公开 | 制作商信息与游戏列表 |
| strategy | `/strategy` | 管理员写 | 攻略/文章 CRUD |
| download | `/download` | 公开 | Cloudreve 直链代理、CF Worker 配置 |
| media | `/media` | 登录 | S3 图片上传（依赖内容哈希去重） |
| views | `/views` | 公开 | 访问事件追踪、热门排行 |
| vndb-sync | `/vndb-sync` | 管理员 | VNDB 全量/增量同步 |
| kungal-sync | `/kungal-sync` | 管理员 | KunGal 目录同步 |
| tasks | `/tasks` | 管理员 | 队列查询与手动入队 |
| cron | — | — | 定时任务：索引重建、文件同步 |
| health | `/health` | 公开 | `{ ok, db, redis }`；启动失败时 503 |
| status | `/status` | 公开 | 部署生命周期：starting → migrating → ready / error |

> 另有 `otel` 插件（`opentelemetry()`）已实现但未在入口挂载，链路追踪当前未启用。

## 快速开始

前置：**Bun ≥ 1.4**、**PostgreSQL ≥ 16**、**Redis ≥ 7**（开发可省）、**Meilisearch**、Docker（可选）。

```bash
cp apps/api/.env.example apps/api/.env   # 按需填写
bun install
bun --cwd apps/api db:up                 # 应用迁移（空库首次启动也会自动迁移）
bun run dev                              # API :3001 + Web :3000
```

常用环境变量（完整清单见 `apps/api/.env.example`）：

| 分组 | 变量 |
|---|---|
| 服务 | `PORT`（API 默认 3001 / Web 默认 3000）、`HOST`（Web 绑定）、`WEB_HOST`（API CORS 来源） |
| 数据 | `DATABASE_URL`、`REDIS_URL`、`REDIS_ENABLED` |
| 搜索 | `MEILISEARCH_HOST`、`MEILISEARCH_MASTER`、`MEILISEARCH_*INDEXNAME` |
| 认证 | `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`GITHUB_* / DISCORD_* / TWITTER_* / KUNGAL_* / LINUXDO_* / HIKARINAGI_*` |
| 同步 | `VNDB_API_TOKEN`、`KUNGALAPI_KEY` |
| 存储 | `S3_*`（媒体上传）、`CLOUDREVE_HOST / CLOUDREVE_EMAIL / CLOUDREVE_PASSWORD`（下载） |
| 其他 | `EMAIL_KEY`（邮件）、`CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN`（CDN 清理） |

## 数据库迁移

> 迁移优先，**禁用 `db:push`**（会对比整库并提示删除非应用表）。

```bash
bun --cwd apps/api db:generate   # 生成迁移 SQL
bun --cwd apps/api db:up         # 应用挂起迁移（bun-sql migrator，幂等）
bun --cwd apps/api db:check      # 校验 schema 与数据库一致性
bun --cwd apps/api db:studio     # 可视化管理
```

不要使用 `drizzle-kit migrate`（已知会无限挂起）。`db:up` 与启动自动迁移共用同一实现。

## 部署

- **API**：`bun build --compile` 单二进制 → `gcr.io/distroless/base`
- **Web**：`furin build --compile embed` 单文件（静态资源内嵌）→ `cgr.dev/chainguard/glibc-dynamic`，非 root 65532，健康检查走二进制自带 `--healthcheck`
- 构建：`bun run docker`（或 `bun --cwd apps/api docker` / `bun --cwd apps/web-tanstack docker`）
- CI：push `main` → 按路径过滤 → typecheck → buildx 推送 `ghcr.io` → Dokploy webhook（`DEPLOY_WEBHOOK_API` / `DEPLOY_WEBHOOK_WEB`）

## 开发约定

- **API 三文件**：`modules/<name>/{index,model,service}.ts`；校验一律 TypeBox（`t`），不用 Zod
- **页面**：`pages/**` 的 `defineRoute(...).config().loader().head().page()`；`params` 用 TypeBox，`query` 可用 Zod
- **BFF**：`server/impl/**` 用 `defineBff(schema, handler)`（仅服务端），`server/<domain>.ts` 用 `bffFn` 暴露；新增后需重建 registry
- **请求上下文**：SSR 调 Eden 用 `cookiePass()` / `ipPass()`，错误统一走 `elysiaErrorF(error)`（401 → 登录页）
- **格式化**：Biome（2 空格、单引号、80 列）；Lint：API 用 Biome，Web 用 oxlint
- 提交前：`bun run lint && bun run typecheck`

| 命令 | 说明 |
|---|---|
| `bun run dev` / `build` / `lint` / `typecheck` | 全工作空间并行执行 |
| `bun --cwd apps/api dev` | 仅 API（watch，:3001） |
| `bun --cwd apps/web-tanstack dev` | 仅 Web（`bun --hot src/server.ts`，:3000） |
| `bun --cwd apps/web-tanstack test` | Vitest |

## 许可证

MIT
