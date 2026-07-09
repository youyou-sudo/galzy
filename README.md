# Galzy

Galzy 是一个面向中文玩家的现代化 Galgame（日式视觉小说）资源平台。平台收录了汉化版与翻译版 Galgame，提供下载、攻略、汉化资源以及社区功能，一站整合。

**包名:** `Galzy` | **目录:** `galzy` | **许可证:** MIT

---

## 功能特性

- **全文搜索** — 基于 Meilisearch，针对中文优化的索引，覆盖游戏、标签和文章
- **VNDB 集成** — 通过 PostgreSQL Foreign Data Wrapper（FDW）直接访问 Visual Novel Database 获取游戏元数据
- **社区认证** — 支持邮箱/密码登录、OAuth 第三方登录（GitHub、Discord、Twitter、Kungal、Linux.do）及邮箱 OTP 验证
- **管理后台** — 用户管理、评论审核、文章管理、Meilisearch 索引管理
- **游戏管理** — 游戏列表、详情页、文件下载（通过 Alist + Cloudflare Workers 代理）、翻译内容、攻略指南
- **标签系统** — VNDB 标签的汉化支持，游戏-标签关联、批量上传和导出
- **评论系统** — 支持回复嵌套、审核控制（置顶、状态标记）、回复邮件通知
- **数据分析** — 自建 Umami 统计热门游戏、热门标签和下载量
- **OpenAPI / Swagger 文档** — 由 `@elysia/openapi` 自动生成
- **OpenTelemetry 支持** — 分布式链路追踪和可观测性
- **响应式深色/浅色主题** — 基于 Tailwind CSS v4 + shadcn/ui + animate-ui 构建
- **Docker 多阶段构建** — API 和前端均生成 distroless 精简生产镜像
- **CI/CD 流水线** — GitHub Actions 自动构建，推送至 GitHub Container Registry，通过 webhook 触发部署

---

## 技术栈

| 分层                   | 技术                                                        |
| ---------------------- | ----------------------------------------------------------- |
| 单体仓库               | Bun workspaces (bun@1.3.6)                                  |
| 后端运行时               | Bun                                                         |
| 后端框架                 | ElysiaJS ^1.4                                               |
| 后端语言                 | TypeScript (ESNext)                                         |
| 数据库                   | PostgreSQL 16+                                              |
| 数据库工具                | Kysely（类型安全查询构建器）                                      |
| 搜索引擎                 | Meilisearch                                                 |
| 缓存                     | Redis                                                       |
| 认证                     | Better Auth v1.6                                            |
| API 文档                 | @elysia/openapi (OpenAPI / Swagger)                         |
| 遥测追踪                  | OpenTelemetry                                               |
| 前端框架                  | React 19 + TanStack Start                                   |
| 前端路由                  | TanStack Router（基于文件的路由）                             |
| 前端数据请求              | TanStack Query v5 + Server Functions                        |
| 前端 UI                  | Tailwind CSS v4 + shadcn/ui + animate-ui + motion           |
| 前端状态管理              | TanStack Store + Zustand                                    |
| 前端构建工具              | Vite 8 + Rolldown + oxc                                     |
| 代码检查/格式化           | Biome                                                       |
| 容器化                   | Docker（多阶段构建、distroless 镜像）                         |
| CI/CD                   | GitHub Actions -> ghcr.io -> webhook 部署                    |

---

## 仓库结构

```
galzy/
├── apps/
│   ├── api/                       # ElysiaJS 后端 (Bun, TypeScript, 端口 3001)
│   │   ├── src/
│   │   │   ├── index.ts           # 应用入口
│   │   │   ├── modules/           # 14 个业务模块
│   │   │   └── libs/              # 公共库 (kysely, redis, meilisearch, config)
│   │   ├── Dockerfile             # 多阶段 distroless 构建
│   │   └── .env.example           # 环境变量模板
│   └── web-tanstack/             # TanStack Start 前端 (React 19, Vite 8, 端口 3000)
│       ├── src/
│       │   ├── routes/            # 35+ 个基于文件的路由
│       │   ├── components/        # shadcn/ui + 自定义组件
│       │   ├── server/            # Server Functions (BFF 层)
│       │   ├── stores/            # Zustand + TanStack Store
│       │   ├── hooks/             # 自定义 React Hooks
│       │   └── lib/               # 工具函数
│       └── Dockerfile
├── packages/
│   ├── config/                    # 共享 TypeScript 配置
│   │   └── typescript/
│   │       ├── base.json
│   │       └── react-library.json
│   └── libs/                      # 公共库 (Eden Treaty 客户端)
├── scripts/
│   ├── run.ts                     # 并行运行工作空间命令
│   ├── docker.ts                  # Docker 构建编排
│   └── pakadd.ts                  # 包添加辅助工具
├── .github/workflows/
│   ├── build-api.yml              # API Docker -> ghcr.io -> webhook 部署
│   └── build-web.yml              # Web Docker -> ghcr.io -> webhook 部署
├── biome.json                     # Biome 代码检查/格式化配置
├── renovate.json                  # 自动依赖更新配置
├── .editorconfig
├── .gitignore
├── .npmrc
├── opencode.jsonc
├── AGENTS.md
├── bun.lock
└── package.json
```

---

## 项目地图详解

### apps/api - ElysiaJS 后端 API

每个 API 模块采用统一的三体结构：

- `index.ts` — Elysia 插件（路由定义、中间件、钩子）
- `model.ts` — TypeBox 模式定义（请求校验、响应类型）
- `service.ts` — 业务逻辑（Kysely 查询、Redis 缓存、外部 API 调用）

**14 个模块：**

| 模块       | 路由前缀          | 说明                                                                                                                      |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| auth       | (better-auth)     | 基于 Better Auth 的认证：邮箱/密码、OAuth (Kungal、Linux.do、GitHub、Discord、Twitter)、邮箱 OTP、管理员 RBAC、中文本地化。同时定义 `auth` 和 `isAdmin` 两个 Elysia 宏 |
| health     | `/health`         | 健康检查端点                                                                                                              |
| games      | `/games`          | 游戏列表（来自 VNDB 数据）、详情页、文件树浏览、VID 关联管理、数据过滤统计                                                  |
| comments   | `/comments`       | 嵌套评论的完整 CRUD、管理员审核（置顶、状态）、回复邮件通知                                                                 |
| cron       | (无路由)          | 手动触发 + 定时任务：Meilisearch 重建索引、Alist 同步、CF Worker 指标拉取                                                    |
| umami      | `/umami`          | 数据分析：热门标签、热门游戏（周排行）、各游戏下载量                                                                        |
| tags       | `/tags`           | VNDB 标签 + 中文汉化、游戏-标签关联、标签编辑、批量上传/导出                                                               |
| download   | `/download`       | Alist 文件代理下载（含 CF Worker 负载均衡）、Worker 配置管理                                                               |
| search     | `/search`         | Meilisearch 全文搜索、标签搜索、可搜索属性配置、Embedder 配置                                                              |
| strategy   | `/strategy`       | 文章 CRUD（攻略指南、博客文章、教程）、游戏-文章关联                                                                        |
| media      | `/media`          | S3 图片上传（头像、游戏媒体）、媒体与条目关联、基于哈希的去重                                                              |
| producer   | `/producer`       | 制作商/开发商信息、按制作商查看游戏列表                                                                                     |
| status     | `/status`         | 部署生命周期状态（启动中 -> 迁移中 -> 就绪 / 错误）                                                                        |
| otel       | (elysia 插件)     | OpenTelemetry 链路追踪                                                                                                     |

**公共库** (`src/libs/`)：

- `kysely/` — 数据库连接与查询辅助层
- `redis/` — Redis 缓存客户端
- `meilisearch/` — Meilisearch 客户端配置
- `config/` — 基于环境变量的配置
- `typeboxChinessError/` — TypeBox 校验错误中文提示
- `seedMail.ts` — 邮件种子数据

### apps/web-tanstack - TanStack Start 前端

**基于文件的路由**（14 个路由目录/文件）：

| 路由                | 说明                                              |
| ------------------- | ------------------------------------------------- |
| `/`                 | 首页 — 游戏列表、搜索、热门标签/游戏排行           |
| `/$id/`             | 游戏详情页（下载、汉化信息、攻略指南、评论）       |
| `/auth/`            | 登录、注册、邮箱验证                              |
| `/admin/`           | 受保护的管理后台（用户、评论、文章、Meilisearch）  |
| `/search/`          | Meilisearch 全文搜索页面                          |
| `/tags/`            | 标签浏览及按标签筛选游戏                          |
| `/producer/`        | 制作商列表及详情页                                |
| `/user/`            | 用户个人资料和设置                                |
| `/api/`             | BFF 代理路由，转发请求至 API 服务器               |
| `/contact.tsx`      | 关于/联系方式页面                                 |
| `/friend-links.tsx` | 友情链接页面                                      |
| `/openapi.tsx`      | OpenAPI / Swagger 文档查看器                      |
| `/tools/`           | 工具箱页面                                        |

**Server Functions**（BFF 层，位于 `src/server/`）：

| Server Functions | 作用                                   |
| ---------------- | -------------------------------------- |
| `auth/`          | 会话管理、验证、账户信息               |
| `game/`          | 游戏详情、标签、文件列表、汉化数据、排行 |
| `comments/`      | 评论 CRUD                             |
| `search/`        | Meilisearch 搜索（含日期筛选）         |
| `tags/`          | 标签数据和搜索                         |
| `introduction/`  | 攻略文章 CRUD                         |
| `producer/`      | 制作商信息及游戏列表                   |
| `upload/`        | 头像上传                               |
| `admin/`         | 管理操作（Meilisearch、评论、文章）    |

**核心 UI 组件：** 25+ 个 shadcn/ui 组件、自定义 animate-ui 库、`@uiw/react-md-editor` 用于 Markdown 编辑、BBCode 渲染器、表情选择器、深色/浅色主题切换。

### packages/config - 共享 TypeScript 配置

基础 TypeScript 配置，采用 ESNext 模块、bundler 模块解析、 strict 模式。另提供一份针对 React 库的配置变体。

### packages/libs - 公共库

Eden Treaty 客户端，在单体仓库中实现类型安全的 API 调用。

### scripts/

| 脚本          | 说明                                       |
| ------------- | ------------------------------------------ |
| `run.ts`      | 在所有工作空间包中并行执行指定命令         |
| `docker.ts`   | 编排所有应用的 Docker 镜像构建             |
| `pakadd.ts`   | 向特定工作空间目标添加包的辅助工具         |

---

## 快速开始

### 前置条件

- **Bun 1.3.6+** — [安装 Bun](https://bun.sh)
- **PostgreSQL 16+** — 主数据库 + VNDB Foreign Data Wrapper
- **Redis 7+** — 会话和缓存存储
- **Meilisearch**（最新版） — 全文搜索引擎
- **Docker**（可选）— 容器化部署

### 安装配置

```bash
# 克隆仓库
git clone https://github.com/youyou-sudo/galzy.git
cd galzy

# 安装所有工作空间依赖（在根目录执行）
bun install

# 配置环境变量
cp apps/api/.env.example apps/api/.env

# 编辑 apps/api/.env，填入你的凭据：
#   - DATABASE_URL: PostgreSQL 连接字符串
#   - VNDB_DATABASE_URL: VNDB FDW 的 PostgreSQL 连接字符串
#   - REDIS_URL: Redis 连接字符串
#   - MEILISEARCH_HOST + MEILISEARCH_MASTER: 搜索引擎配置
#   - BETTER_AUTH_SECRET: 认证密钥
#   - BETTER_AUTH_URL: 认证服务器 URL
#   - WEB_HOST: 前端主机 URL (用于 CORS)

# 启动开发服务器（并行运行所有应用）
bun run dev
```

你也可以单独启动应用：

```bash
# API 服务器，端口 3001
bun --cwd apps/api dev

# Web 开发服务器，端口 3000
bun --cwd apps/web-tanstack dev
```

### 启动流程

API 服务器启动时自动执行以下操作：

1. 连接 PostgreSQL（主数据库 + VNDB FDW）
2. 创建所有必需的数据表
3. 设置 VNDB 外部表
4. 连接 Redis 和 Meilisearch
5. 在端口 3001 启动 Elysia HTTP 服务

### 健康检查

```bash
curl http://localhost:3001/health
# -> {"ok":true}
```

---

## Docker 部署

两个应用均使用多阶段 Docker 构建，生成 distroless 精简生产镜像：

```bash
# 构建 API 镜像
docker build -t mono-api:latest -f apps/api/Dockerfile .

# 构建 Web 镜像
docker build -t mono-web:latest -f apps/web-tanstack/Dockerfile .
```

也可以使用工作空间脚本：

```bash
bun run docker
# 或单独构建：
# bun --cwd apps/api docker
# bun --cwd apps/web-tanstack docker
```

### 生产镜像特性

- **基础镜像：** `gcr.io/distroless/base` — 最小攻击面
- **编译方式：** API 使用 Bun compile（单二进制文件），Web 应用使用服务端可执行文件
- **暴露端口：** 3001 (API)，3000 (Web)
- **构建阶段：** 依赖缓存层 -> 完整构建 -> distroless 运行时

---

## CI/CD 流水线

项目使用 GitHub Actions 实现持续集成和持续交付：

1. **推送到 `main` 分支**触发变更应用的构建：
   - `apps/api/**` 发生变更 —> API 构建工作流
   - `apps/web-tanstack/**` 发生变更 —> Web 构建工作流
2. 每个工作流依次执行：
   - 安装 Bun
   - 构建 Docker 镜像
   - 推送至 `ghcr.io/youyou-sudo/mono-api:latest` 或 `ghcr.io/youyou-sudo/mono-web:latest`
   - 发送 webhook 触发生产服务器部署

---

## 配置说明

关键环境变量（完整列表见 `apps/api/.env.example`）：

| 分组       | 变量                          | 说明                                       |
| ---------- | ----------------------------- | ------------------------------------------ |
| 服务器     | `API_PORT`                    | API 服务器端口（默认：3001）               |
| 服务器     | `API_HOST`                    | API 服务器主机地址                         |
| 认证       | `BETTER_AUTH_SECRET`         | Better Auth 密钥                           |
| 认证       | `BETTER_AUTH_URL`            | Better Auth 服务器 URL                     |
| 认证       | `WEB_HOST`                    | 前端主机 URL（CORS 来源）                  |
| 数据库     | `DATABASE_URL`                | PostgreSQL 连接字符串（主库）               |
| 数据库     | `VNDB_DATABASE_URL`           | PostgreSQL 连接字符串（VNDB FDW 库）       |
| 数据库     | `DEVVNDB_DATABASE_URL`        | PostgreSQL 连接字符串（开发 VNDB 库）       |
| 数据库     | `POSTGRES_POOL_MAX`           | 最大连接池数（默认：10）                    |
| 搜索       | `MEILISEARCH_HOST`            | Meilisearch 服务器 URL                     |
| 搜索       | `MEILISEARCH_MASTER`          | Meilisearch 主密钥                          |
| 搜索       | `MEILISEARCH_INDEXNAME`       | 游戏索引名称                               |
| 搜索       | `MEILISEARCH_TAG_INDEXNAME`   | 标签索引名称                               |
| 缓存       | `REDIS_URL`                   | Redis 连接字符串                           |
| 数据       | `UMAMI_URL`                   | Umami 分析服务器 URL                       |
| 数据       | `UMAMI_DATA_WEBSITE_ID`       | Umami 网站 ID                              |
| 数据       | `UMAMI_DATA_USER`             | Umami 数据 API 用户名                      |
| 数据       | `UMAMI_DATA_PASSWORD`           | Umami 数据 API 密码                        |
| 数据       | `UMAMI_LOCAL_URL`             | 内网 Umami URL                             |
| 邮件       | `EMAIL_KEY`                   | CloudMailin SMTP 密钥                      |
| 下载       | `OPENLIST_API_KEY`            | OpenList API 密钥                          |
| 下载       | `OPENLIST_HOST`               | OpenList 基础 URL                          |

---

## 脚本参考

| 脚本                                  | 说明                                         |
| ------------------------------------- | -------------------------------------------- |
| `bun run dev`                         | 启动所有工作空间的开发模式（并行）           |
| `bun run build`                       | 构建所有工作空间                             |
| `bun run docker`                      | 为所有应用构建 Docker 镜像                   |
| `bun run lint`                        | 对所有工作空间运行 Biome 检查               |
| `bun --cwd apps/api dev`              | 在端口 3001 启动 API 开发服务器              |
| `bun --cwd apps/web-tanstack dev`     | 在端口 3000 启动 Web 开发服务器              |

---

## 贡献指南

欢迎贡献代码。以下是从头开始的步骤：

1. **Fork** 本仓库
2. **创建功能分支**：`feat/你的功能` 或 `fix/你的修复`
3. **按照现有代码模式进行修改**：
   - API 模块使用三体结构 (index.ts, model.ts, service.ts)
   - 前端遵循基于文件的路由约定
   - 所有代码使用 Biome 格式化（2 空格缩进、单引号、尾逗号）
4. **运行代码检查**：`bun run lint`
5. **提交 Pull Request**，并附上清晰的修改说明

### 代码风格

- TypeScript strict 模式
- 使用 Biome 进行格式化和代码检查（配置见 `biome.json`）
- 兼容 Prettier 的约定（空格缩进、80 字符行宽）
- LF 换行符（由 `.editorconfig` 强制执行）

---

## 许可证

本项目基于 [MIT](LICENSE) 许可证开源。
