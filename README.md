# Galzy

> 面向中文玩家的现代化 Galgame 资源平台 —— 收录汉化版与翻译版 Galgame，提供发现、下载、攻略与社区功能，一站整合。

![Bun](https://img.shields.io/badge/Bun-1.4+-000?logo=bun) ![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript) ![ElysiaJS](https://img.shields.io/badge/ElysiaJS-^1.4-6B46C1?logo=elysia) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![TanStack Start](https://img.shields.io/badge/TanStack_Start-1.168-FF4154?logo=react) ![License](https://img.shields.io/badge/License-MIT-brightgreen)

---

## 核心特性

- **📖 全文搜索** — 基于 Meilisearch，覆盖游戏、标签、制作商三个索引，针对中文优化，毫秒级响应
- **🔄 VNDB 数据同步** — 通过 VNDB API（Kana）全量/增量同步视觉小说、标签、发行版、制作商数据，带分布式锁与进度跟踪，同步后自动清除 CDN 缓存
- **🌐 KunGal 目录同步** — 对接 NextMoe·未萌开放 API，以 VNDB ID 为锚点同步目录数据
- **🔐 多种登录方式** — 邮箱/密码、邮箱 OTP，以及 GitHub、Discord、Twitter、Kungal、Linux.do 等 OAuth 登录，中文本地化
- **🏷️ 标签系统** — VNDB 标签中文本地化、游戏-标签关联、批量导入导出
- **💬 评论与社区** — 嵌套评论、管理员审核（置顶/状态）、回复邮件通知；论坛话题（发布、点赞、收藏）
- **📝 攻略模块** — Markdown 文章 CRUD（攻略指南、博客、教程），游戏-文章关联
- **📥 游戏下载** — 基于 Cloudreve 的签名直链下载，文件树浏览与数据同步
- **📊 自建访问统计** — 页面访问事件追踪（`galrc_event_views`），热门游戏/标签排行，替代第三方统计
- **🗂️ 任务队列** — 基于 `@stacksjs/bun-queue` 的后台任务队列，管理端可查询任务状态、日志并手动入队
- **🔧 管理后台** — 用户管理、评论审核、文章管理、合集管理、搜索索引管理
- **📄 OpenAPI 文档** — 由 `@elysia/openapi` 自动生成 Swagger 文档
- **📡 OpenTelemetry** — 分布式链路追踪（生产环境按需开启）
- **🎨 现代前端** — React 19 + TanStack 全家桶 + Tailwind CSS v4 + shadcn/ui，深色/浅色主题，React Compiler 加持
- **🐳 容器化交付** — Docker 多阶段构建生成 distroless 精简镜像，GitHub Actions 自动构建推送 ghcr.io 并通过 webhook 触发部署

---

## 技术栈

| 分类 | 技术 |
|------|------|
| **🖥️ 前端框架** | React 19 + TanStack Start（SSR、Server Functions）+ TanStack Router / Query v5 / Store / Form |
| **🎨 前端 UI** | Tailwind CSS v4 + shadcn/ui（base-nova，基于 @base-ui/react）+ motion + lucide-react + sonner |
| **🛠️ 前端工具链** | Vite 8（Rolldown + oxc）+ React Compiler + oxlint + Vitest + Testing Library |
| **⚙️ 后端框架** | ElysiaJS ^1.4 + TypeBox 校验 + `@elysiajs/cors` / `cron` / `opentelemetry` |
| **🗄️ 数据库** | PostgreSQL 16+（Drizzle ORM + Drizzle Kit，bun-sql 驱动） |
| **🔍 搜索** | Meilisearch（游戏 / 标签 / 制作商索引） |
| **⚡ 缓存** | Redis 7+（KV 缓存、分布式锁、幂等键；开发模式可选关闭） |
| **🔐 认证** | Better Auth ^1.7 + Drizzle Adapter + 中文本地化 |
| **📮 任务队列** | @stacksjs/bun-queue（复用 Bun 内置 Redis 客户端） |
| **📦 容器化** | Docker 多阶段构建 → `gcr.io/distroless/base` |
| **🔄 CI/CD** | GitHub Actions → ghcr.io → Dokploy webhook 部署 |
| **🔧 代码质量** | Biome 2.x + oxlint + TypeScript 6 strict + EditorConfig |
| **🔄 依赖管理** | Renovate 自动更新 + Bun workspaces 单体仓库 |

---

## 架构

```
浏览器 ──▶ TanStack Start SSR（端口 3000）
                │  createServerFn（BFF 层）
                │  Eden Treaty（类型安全 RPC）
                ▼
         ElysiaJS API（端口 3001）
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
PostgreSQL    Redis     Meilisearch
 (Drizzle)  （缓存/锁）   （搜索）
```

- 浏览器 → SSR Server Functions → Eden Treaty → Elysia API → Drizzle ORM → PostgreSQL
- Redis 提供缓存、分布式锁与任务队列底层存储；开发模式下默认不启用（直查 DB），可设 `REDIS_ENABLED=true` 强制开启
- 后台任务（搜索索引重建、Cloudreve 同步等）经 bun-queue 异步执行，管理端可通过 `/tasks` 查询进度与日志

---

## 项目结构

```
galzy/
├── apps/
│   ├── api/                          # ElysiaJS 后端（端口 3001）
│   │   ├── src/
│   │   │   ├── index.ts              # 应用入口，挂载全部模块
│   │   │   ├── modules/              # 19 个业务模块（三体结构）
│   │   │   ├── db/                   # Drizzle schema + 客户端 + 启动自动迁移
│   │   │   └── libs/                 # redis / meilisearch / queue / vndb-api / cloudreve / ...
│   │   ├── drizzle/                  # 迁移 SQL（Drizzle Kit 生成）
│   │   ├── Dockerfile                # 多阶段 distroless 构建
│   │   └── .env.example              # 环境变量模板
│   └── web-tanstack/                 # TanStack Start 前端（端口 3000）
│       ├── src/
│       │   ├── routes/               # 基于文件的约定式路由
│       │   ├── server/               # Server Functions（BFF 层，按领域划分）
│       │   ├── components/           # shadcn/ui + 自定义组件
│       │   ├── stores/               # TanStack Store / Zustand（客户端 UI 状态）
│       │   ├── hooks/                # 自定义 React Hooks
│       │   └── lib/                  # cn() / cookiePass() / elysiaErrorF() 等工具
│       └── Dockerfile
├── packages/
│   ├── libs/                         # Eden Treaty 类型安全客户端（含 Cookie 转发）
│   └── config/typescript/            # 共享 tsconfig（路径别名 @api / @web / @libs）
├── scripts/
│   ├── run.ts                        # 工作空间并发命令执行器
│   ├── docker.ts                     # Docker 构建编排
│   └── pakadd.ts                     # 按工作空间添加依赖
├── .github/workflows/build-deploy.yml # CI：Docker 构建 → ghcr.io → webhook 部署
├── biome.json                        # Biome 格式化 / Lint 配置
├── renovate.json                     # 自动依赖更新配置
└── AGENTS.md                         # AI 编程助手项目指南
```

---

## 功能模块

| 模块 | 路由前缀 | 权限 | 说明 |
|------|---------|------|------|
| auth | `/auth` | — | Better Auth：OAuth、邮箱密码、邮箱 OTP，提供 `auth` / `isAdmin` 宏 |
| games | `/games` | 公开 | 游戏列表、详情、筛选统计、VID 关联、文件树 |
| search | `/search` | 公开 | Meilisearch 全文搜索、Embedder 与可搜索属性管理 |
| tags | `/tags` | 公开读 | VNDB 标签中文化、游戏-标签关联、批量导入导出 |
| comments | `/comments` | 登录写 | 嵌套评论 CRUD、置顶/审核、邮件通知 |
| topics | `/topics` | 登录 | 论坛话题：CRUD、点赞、收藏 |
| collections | `/collections` | 管理员写 | 精选游戏合集 |
| producer | `/producer` | 公开 | 制作商信息与旗下游戏列表 |
| strategy | `/strategy` | 管理员写 | 攻略/文章 CRUD，游戏关联 |
| download | `/download` | 公开 | Cloudreve 签名直链下载代理 |
| media | `/media` | 登录 | S3 图片上传（头像、游戏媒体），哈希去重 |
| views | `/views` | 公开 | 访问事件追踪、热门游戏/标签排行 |
| vndb-sync | `/vndb-sync` | 管理员 | VNDB API 全量/增量同步，进度跟踪与缓存失效 |
| kungal-sync | `/kungal-sync` | 管理员 | KunGal（NextMoe）目录同步 |
| tasks | `/tasks` | 管理员 | 任务队列查询（列表/详情/日志）与手动入队 |
| cron | — | — | 定时/手动触发：索引重建、Cloudreve 同步 |
| health | `/health` | 公开 | 健康检查 `{ ok: true }` |
| status | `/status` | 公开 | 部署生命周期：starting → migrating → ready / error |
| otel | — | — | OpenTelemetry 链路追踪（生产环境开关） |

---

## 快速开始

### 前置条件

| 工具 | 版本要求 |
|------|---------|
| **Bun** | >= 1.3（推荐 1.4）— [安装 Bun](https://bun.sh) |
| **PostgreSQL** | >= 16 |
| **Redis** | >= 7（开发模式可省略） |
| **Meilisearch** | 最新版 — [自托管指南](https://www.meilisearch.com/docs/learn/self_hosting/getting_started_with_self_hosting) |
| **Docker** | 可选，用于容器化部署 |

### 环境变量

```bash
cp apps/api/.env.example apps/api/.env
```

核心变量（完整列表见 `apps/api/.env.example`）：

| 分组 | 变量 | 说明 |
|------|------|------|
| 服务器 | `API_PORT` / `WEB_HOST` | API 端口（默认 3001）/ 前端地址（CORS 来源） |
| 数据库 | `DATABASE_URL` | PostgreSQL 连接字符串 |
| 数据同步 | `VNDB_API_TOKEN` | VNDB API 凭据（全量/增量同步） |
| 数据同步 | `KUNGALAPI_KEY` | KunGal 开放 API 密钥 |
| 搜索 | `MEILISEARCH_HOST` / `MEILISEARCH_MASTER` | Meilisearch 地址与主密钥 |
| 缓存 | `REDIS_URL` / `REDIS_ENABLED` | Redis 连接；开发模式默认关闭缓存 |
| 认证 | `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Better Auth 密钥与服务地址 |
| OAuth | `GITHUB_*` / `DISCORD_*` / `TWITTER_*` / `KUNGAL_*` / `LINUXDO_*` | 各 OAuth 提供商凭据 |
| 存储 | `S3_BUCKET` / `S3_ENDPOINT` / ... | S3 对象存储（媒体上传与图片 CDN） |
| 下载 | `CLOUDREVE_HOST` / `CLOUDREVE_EMAIL` / `CLOUDREVE_PASSWORD` | Cloudreve 文件存储 |
| 邮件 | `EMAIL_KEY` | 邮件服务密钥（评论通知、OTP） |
| CDN | `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_API_TOKEN` / `SITE_URL` | 数据变更后的 CDN 缓存清除 |

### 安装与启动

```bash
# 1. 安装所有工作空间依赖
bun install

# 2. 应用数据库迁移（首次启动也会自动迁移空库）
bun --cwd apps/api db:up

# 3. 启动开发服务器（并行运行所有应用：API 3001 + Web 3000）
bun run dev
```

也可单独启动：

```bash
bun --cwd apps/api dev            # 仅 API（watch 模式）
bun --cwd apps/web-tanstack dev   # 仅 Web（Vite dev server）
```

### 健康检查

```bash
curl http://localhost:3001/health
# {"ok":true}
```

---

## 数据库迁移

> **重要：** 本项目采用迁移优先工作流，**禁止使用 `db:push`**（它会对比整个数据库并可能提示删除非应用表）。

```bash
# 1. 根据 schema 变更生成迁移 SQL
bun --cwd apps/api db:generate

# 2. 应用挂起的迁移（bun-sql migrator，幂等）
bun --cwd apps/api db:up

# 3. 校验 schema 与数据库一致性
bun --cwd apps/api db:check
```

补充说明：

- API 启动时自动检测：全新数据库会自动完成首次迁移；已有表但无迁移日志的库会跳过并告警
- 不要使用 `drizzle-kit migrate`（已知问题：无限挂起）；`db:up` 使用与启动自动迁移相同的实现
- 可视化管理：`bun --cwd apps/api db:studio`

---

## Docker 部署

多阶段构建，最终产物为 `gcr.io/distroless/base` 之上的单二进制运行时：

```bash
# 一键构建全部镜像
bun run docker

# 或分别构建
bun --cwd apps/api docker
bun --cwd apps/web-tanstack docker
```

镜像特性：

- API：`bun build --compile` 编译为单二进制
- Web：Vite 构建产物嵌入单二进制
- 最小攻击面，无 shell、无包管理器

### CI/CD

推送至 `main` 分支后，`build-deploy.yml` 按变更路径自动选择构建目标（`apps/api/**` 或 `apps/web-tanstack/**`），构建 Docker 镜像推送至 ghcr.io，再通过 webhook 通知生产环境拉取部署。

---

## 开发指南

### 常用命令

| 命令 | 说明 |
|------|------|
| `bun install` | 安装所有工作空间依赖 |
| `bun run dev` | 并行启动全部工作空间（开发模式） |
| `bun run build` | 构建所有工作空间 |
| `bun run lint` | 全工作空间代码检查（Biome + oxlint） |
| `bun run typecheck` | 全工作空间 TypeScript 类型检查 |
| `bun --cwd apps/api dev` | 仅启动 API（端口 3001） |
| `bun --cwd apps/web-tanstack dev` | 仅启动 Web（端口 3000） |
| `bun --cwd apps/web-tanstack test` | 运行 Vitest 测试 |
| `bun add:api <pkg>` | 向 API 工作空间添加依赖 |
| `bun add:web <pkg>` | 向 Web 工作空间添加依赖 |

### 代码规范

- **TypeScript strict** 全项目启用；`module: Preserve` + bundler 解析，Bun 直接运行 TS，无编译步骤
- **Biome 格式化**：2 空格缩进、单引号、尾逗号、80 字符行宽、LF 换行
- **Lint**：API 用 Biome，Web 用 oxlint；提交前请跑 `bun run lint`

### API 模块三体结构

每个业务模块位于 `apps/api/src/modules/<name>/`，统一遵循三层结构：

```
modules/<name>/
├── index.ts    # Elysia 插件 —— 路由、中间件、auth/isAdmin 宏
├── model.ts    # TypeBox 模式 —— 请求校验与响应类型
└── service.ts  # 业务逻辑 —— Drizzle 查询、Redis 缓存、外部 API
```

校验一律使用 Elysia 的 `t`（TypeBox），不使用 Zod。

### 前端约定

- Server Functions 必须使用 `.validator()`（Zod）校验输入；每次 Eden 调用必须将 `error` 传给 `elysiaErrorF()`（401 重定向登录页）
- 登录态请求通过 `cookiePass()` 转发 Cookie
- 路由使用 `loader` + `loaderDeps` + `validateSearch`（Zod）模式；管理页用 `beforeLoad` 守卫
- UI 组件基于 shadcn/ui（@base-ui/react），变体用 `cva`，类名合并用 `cn()`

详细约定参见 [AGENTS.md](AGENTS.md)。

### 贡献流程

1. Fork 本仓库
2. 创建功能分支：`feat/<功能>` 或 `fix/<修复>`
3. 遵循上述代码规范（API 三体结构 / 前端路由约定 / Biome 格式化）
4. 运行 `bun run lint && bun run typecheck` 确保质量
5. 提交 Pull Request，附清晰的修改说明

---

## 许可证

本项目以 [MIT](https://opensource.org/licenses/MIT) 许可证开源。

---

<p align="center">用 ❤️ 和 Bun 构建 · 让 Galgame 文化更易触及</p>
