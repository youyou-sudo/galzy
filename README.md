# Galzy

> 面向中文玩家的现代化 Galgame 资源平台 —— 收录汉化版与翻译版 Galgame，提供下载、攻略、社区功能，一站整合。

![Bun](https://img.shields.io/badge/Bun-1.3+-000?logo=bun) ![ElysiaJS](https://img.shields.io/badge/ElysiaJS-^1.4-6B46C1?logo=elysia) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![TanStack Start](https://img.shields.io/badge/TanStack_Start-1.168-FF4154?logo=react) ![License](https://img.shields.io/badge/License-MIT-brightgreen)

---

## 核心特性

- **📖 全文搜索** — 基于 Meilisearch，针对中文优化的索引，覆盖游戏、标签和文章，毫秒级响应
- **🗄️ VNDB 数据同步** — 通过 PostgreSQL Foreign Data Wrapper（FDW）直接访问 VNDB 获取游戏元数据，支持 VNDB API 与 Kun Wiki API 对接
- **🔐 多种登录方式** — 支持邮箱/密码登录、邮箱 OTP 验证，以及 GitHub、Discord、Twitter、Kungal、Linux.do 等 OAuth 第三方登录
- **🏷️ 标签系统** — VNDB 标签中文本地化，游戏-标签关联，批量上传与导出
- **💬 评论系统** — 嵌套评论、管理员审核（置顶、状态标记）、回复邮件通知
- **📝 攻略模块** — 文章 CRUD（攻略指南、博客文章、教程），游戏-文章关联
- **📥 游戏下载** — 基于 Alist + Cloudflare Workers 代理的文件下载，支持 Worker 负载均衡与配置管理
- **🖼️ 媒体管理** — S3 图片上传（头像、游戏媒体），基于哈希的去重
- **📊 数据分析** — 自建 Umami 统计热门游戏、热门标签和下载量
- **🔧 管理后台** — 用户管理、评论审核、文章管理、Meilisearch 索引管理
- **📄 OpenAPI 文档** — 由 `@elysia/openapi` 自动生成 Swagger 文档
- **📡 OpenTelemetry 支持** — 分布式链路追踪与可观测性
- **🎨 响应式主题** — 基于 Tailwind CSS v4 + shadcn/ui + motion 构建，支持深色/浅色主题切换
- **🐳 Docker 多阶段构建** — API 和前端均生成 distroless 精简生产镜像
- **🚀 CI/CD 流水线** — GitHub Actions 自动构建，推送至 GitHub Container Registry，通过 webhook 触发部署

---

## 技术栈

| 分类 | 技术 |
|------|------|
| **🖥️ 前端** | React 19 + TanStack Start（基于文件路由），TanStack Router，TanStack Query v5，TanStack Store + Zustand |
| **🎨 前端 UI** | Tailwind CSS v4 + shadcn/ui + motion + animate-ui，Markdown 编辑器（`@uiw/react-md-editor`），表情选择器 |
| **🛠️ 前端工具链** | Vite 8 + Rolldown + oxc，oxlint 代码检查，Vitest 测试，`@tanstack/router-plugin` |
| **⚙️ 后端框架** | ElysiaJS ^1.4 + TypeScript strict 模式，`@elysiajs/cors`，`@elysiajs/opentelemetry`，`@elysiajs/cron` |
| **🗄️ 数据库** | PostgreSQL 16+（主库 + VNDB FDW），Kysely（类型安全查询构建器），Drizzle ORM + Drizzle Kit（迁移管理） |
| **🔍 搜索** | Meilisearch（全文搜索引擎，支持 Embedder 配置） |
| **⚡ 缓存** | Redis 7+（会话与缓存存储） |
| **🔐 认证** | Better Auth ^1.6，支持多 OAuth 提供商，中文本地化 |
| **📦 容器化** | Docker 多阶段构建 + `gcr.io/distroless/base` 基础镜像 |
| **🔄 CI/CD** | GitHub Actions → ghcr.io → webhook 部署 |
| **🔧 代码质量** | Biome 2.x（格式 + 检查），oxlint，TypeScript 6.x，EditorConfig |
| **🔄 依赖管理** | Renovate（自动依赖更新），Bun workspaces 单体仓库 |

---

## 项目结构

```
galzy/
├── apps/
│   ├── api/                          # ElysiaJS 后端 API（端口 3001）
│   │   ├── src/
│   │   │   ├── index.ts              # 应用入口
│   │   │   ├── modules/              # 15 个业务模块（auth, games, comments, ...）
│   │   │   └── libs/                 # 公共库（kysely, redis, meilisearch, config）
│   │   ├── Dockerfile                # 多阶段 distroless 构建
│   │   └── .env.example              # 环境变量模板
│   └── web-tanstack/                # TanStack Start 前端（端口 3000）
│       ├── src/
│       │   ├── routes/               # 14+ 个基于文件的路由
│       │   ├── components/           # shadcn/ui + 自定义组件
│       │   ├── server/               # Server Functions（BFF 层）
│       │   ├── stores/               # Zustand + TanStack Store 状态管理
│       │   ├── hooks/                # 自定义 React Hooks
│       │   └── lib/                  # 工具函数
│       └── Dockerfile
├── packages/
│   ├── config/                       # 共享 TypeScript 配置
│   │   └── typescript/               # base.json, react-library.json
│   └── libs/                         # 公共库（Eden Treaty 类型安全客户端）
├── scripts/
│   ├── run.ts                        # 并行运行工作空间命令
│   ├── docker.ts                     # Docker 构建编排
│   └── pakadd.ts                     # 包添加辅助工具
├── .github/workflows/
│   ├── build-api.yml                 # API Docker → ghcr.io → webhook 部署
│   └── build-web.yml                 # Web Docker → ghcr.io → webhook 部署
├── biome.json                        # Biome 代码检查/格式化配置
├── renovate.json                     # 自动依赖更新配置
├── AGENTS.md                         # AI 编程助手指令
├── opencode.jsonc                    # OpenCode 配置
├── todo.md                           # 开发任务跟踪
└── package.json                      # 根工作空间配置
```

---

## 主要功能模块

### Auth（认证模块）
基于 Better Auth 的完整认证系统，支持邮箱/密码登录、邮箱 OTP 验证，以及 GitHub、Discord、Twitter、Kungal、Linux.do 五种 OAuth 登录。内置管理员 RBAC 和中文本地化，同时注册 `auth` 和 `isAdmin` 两个 Elysia 宏。

### Games（游戏模块）
游戏列表（数据源自 VNDB）、详情页、文件树浏览、VID 关联管理、数据过滤与统计。

### Search（搜索模块）
Meilisearch 全文搜索，覆盖游戏和标签索引，支持 Embedder 配置、可搜索属性动态配置、标签筛选。

### Tags（标签模块）
VNDB 标签的中文本地化、游戏-标签关联管理、标签编辑、批量上传与导出（CSV）。

### Comments（评论模块）
嵌套式评论完整 CRUD、管理员审核控制（置顶、状态标记、隐藏）、回复邮件通知。

### Strategy（攻略模块）
文章 CRUD（攻略指南、博客文章、教程），支持 Markdown 编辑，游戏-文章关联。

### Download（下载模块）
基于 Alist + Cloudflare Workers 代理的文件下载，支持 Worker 负载均衡与配置管理。

### Media（媒体模块）
S3 图片上传（头像、游戏媒体），媒体与条目关联，基于哈希的图片去重。

### Umami（数据分析）
自建 Umami 分析平台，统计热门标签、热门游戏（周排行）、各游戏下载量。

### Producer（制作商模块）
制作商/开发商信息管理，按制作商查看游戏列表。

### Health（健康检查）
`/health` 端点，提供 API 服务状态检测。

### Status（部署状态）
部署生命周期状态管理：启动中 → 迁移中 → 就绪 / 错误。

### Cron（定时任务）
手动触发 + 定时任务：Meilisearch 重建索引、Alist 同步、CF Worker 指标拉取。

### OTel（链路追踪）
通过 `@elysiajs/opentelemetry` 实现的 OpenTelemetry 分布式链路追踪。

### VNDB Sync（VNDB 数据同步）
VNDB 全量/增量数据同步模块，通过 VNDB API 同步视觉小说（VN）、标签、发行版和制作商数据，支持同步进度跟踪与缓存失效。

---

## 快速开始

### 前置条件

| 工具 | 版本要求 |
|------|---------|
| **Bun** | >= 1.3.14 — [安装 Bun](https://bun.sh) |
| **PostgreSQL** | >= 16（含 `postgres_fdw` 扩展用于 VNDB 数据同步） |
| **Redis** | >= 7 |
| **Meilisearch** | 最新版 — [安装指南](https://www.meilisearch.com/docs/learn/self_hosting/getting_started_with_self_hosting) |
| **Docker** | 可选，用于容器化部署 |

### 环境变量配置

```bash
# 复制环境变量模板
cp apps/api/.env.example apps/api/.env
```

核心环境变量说明（完整列表见 `apps/api/.env.example`）：

| 分组 | 变量 | 说明 |
|------|------|------|
| 服务器 | `API_PORT` | API 端口（默认 3001） |
| 数据库 | `DATABASE_URL` | PostgreSQL 主库连接字符串 |
| 数据库 | `VNDB_DATABASE_URL` | VNDB FDW 数据库连接字符串 |
| 搜索 | `MEILISEARCH_HOST` | Meilisearch 服务器地址 |
| 搜索 | `MEILISEARCH_MASTER` | Meilisearch 主密钥 |
| 缓存 | `REDIS_URL` | Redis 连接字符串 |
| 认证 | `BETTER_AUTH_SECRET` | Better Auth 密钥 |
| 认证 | `BETTER_AUTH_URL` | 认证服务器 URL |
| 认证 | `WEB_HOST` | 前端主机 URL（CORS 来源） |
| OAuth | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth 凭据 |
| OAuth | `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord OAuth 凭据 |
| OAuth | `KUNGAL_CLIENT_ID` / `KUNGAL_CLIENT_SECRET` | Kungal OAuth 凭据 |
| OAuth | `LINUXDO_CLIENT_ID` / `LINUXDO_CLIENT_SECRET` | Linux.do OAuth 凭据 |
| OAuth | `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` | Twitter OAuth 凭据 |
| 存储 | `S3_BUCKET` / `S3_ENDPOINT` / ... | S3 对象存储配置（媒体文件） |
| 下载 | `CLOUDREVE_HOST` / `CLOUDREVE_EMAIL` / `CLOUDREVE_PASSWORD` | Cloudreve 文件存储（游戏文件搜索、目录、下载、媒体删除） |
| 邮件 | `EMAIL_KEY` | CloudMailin SMTP 密钥 |

### 安装与启动

```bash
# 1. 安装所有工作空间依赖
bun install

# 2. 执行数据库迁移
bun --cwd apps/api db:push

# 3. 启动开发服务器（并行运行所有应用，API 端口 3001，Web 端口 3000）
bun run dev
```

也可单独启动：

```bash
# API 服务器
bun --cwd apps/api dev

# Web 前端
bun --cwd apps/web-tanstack dev
```

### 健康检查

```bash
curl http://localhost:3001/health
# {"ok":true}
```

API 服务器启动时自动执行：连接 PostgreSQL（主库 + VNDB FDW）→ 创建数据表 → 设置 VNDB 外部表 → 连接 Redis 和 Meilisearch → 启动 HTTP 服务。

---

## Docker 部署

项目使用多阶段 Docker 构建，生成基于 `gcr.io/distroless/base` 的精简生产镜像：

```bash
# 构建 API 镜像
bun --cwd apps/api docker

# 构建 Web 镜像
bun --cwd apps/web-tanstack docker

# 或使用工作空间脚本一次性构建所有应用
bun run docker
```

### 镜像特性

- **基础镜像：** `gcr.io/distroless/base` — 最小攻击面
- **编译方式：** API 使用 `bun build --compile` 生成单二进制文件
- **暴露端口：** 3001（API），3000（Web）
- **构建阶段：** 依赖缓存层 → 完整构建 → distroless 运行时

---

## CI/CD 流水线

推送到 `main` 分支时自动触发 GitHub Actions：

1. **路径检测** — 根据变更路径自动选择构建目标：
   - `apps/api/**` → 触发 API 构建工作流
   - `apps/web-tanstack/**` → 触发 Web 构建工作流
2. **构建与推送** — 安装 Bun → 构建 Docker 镜像 → 推送至 `ghcr.io`
3. **部署触发** — 通过 webhook 通知生产服务器拉取新镜像

---

## 开发指南

### 代码规范

- **TypeScript strict 模式** — 全项目启用，类型安全贯穿前后端
- **Biome 格式化** — 2 空格缩进、单引号、尾逗号、80 字符行宽
- **代码检查** — Biome（主）+ oxlint（前端补充），运行 `bun run lint`
- **换行符** — LF（由 `.editorconfig` 强制）

### API 模块规范

每个后端业务模块采用统一的三体结构：

```
modules/<name>/
├── index.ts    # Elysia 插件（路由、中间件、钩子）
├── model.ts    # TypeBox 模式（请求校验、响应类型）
└── service.ts  # 业务逻辑（Kysely 查询、Redis 缓存、外部 API 调用）
```

### 数据库迁移

```bash
# 生成迁移文件
bun --cwd apps/api db:generate

# 推送到数据库
bun --cwd apps/api db:push

# 启动 Drizzle Studio（可视化数据管理）
bun --cwd apps/api db:studio

# 检查迁移状态
bun --cwd apps/api db:check
```

### 测试

```bash
# 前端测试（Vitest）
bun --cwd apps/web-tanstack test
```

### 可用脚本

| 脚本 | 说明 |
|------|------|
| `bun run dev` | 并行启动所有工作空间的开发模式 |
| `bun run build` | 构建所有工作空间 |
| `bun run docker` | 构建所有应用的 Docker 镜像 |
| `bun run lint` | 对所有工作空间运行代码检查 |
| `bun --cwd apps/api dev` | 启动 API 开发服务器（端口 3001） |
| `bun --cwd apps/web-tanstack dev` | 启动 Web 开发服务器（端口 3000） |
| `bun --cwd apps/api db:push` | 执行数据库迁移 |
| `bun --cwd apps/api db:studio` | 启动 Drizzle Studio |
| `bun add:api <pkg>` | 向 API 工作空间添加依赖 |

### 贡献指南

1. **Fork** 本仓库
2. 创建功能分支：`feat/你的功能` 或 `fix/你的修复`
3. 遵循现有代码规范：
   - API 模块使用三体结构
   - 前端遵循基于文件的路由约定
   - 使用 Biome 格式化代码
4. 运行 `bun run lint` 确保代码质量
5. 提交 Pull Request，附上清晰的修改说明

---

## 许可证

本项目基于 [MIT](LICENSE) 许可证开源。

---

<p align="center">用 ❤️ 和 Bun 构建 · 让 Galgame 文化更易触及</p>
