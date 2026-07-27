# AI Instructions

## 包管理器 / Package Manager

本项目使用 **bun** 作为包管理器。禁止使用 `npm` 或 `pnpm`。
This project uses **bun** as its package manager. Do NOT use `npm` or `pnpm`.

### 命令对照 / Command Mapping

| 操作       | 禁止使用 ❌                                 | 必须使用 ✅            |
| ---------- | ------------------------------------------- | ---------------------- |
| 安装依赖   | `npm install` / `pnpm install`              | `bun install`          |
| 添加依赖   | `npm install <pkg>` / `pnpm add <pkg>`      | `bun add <pkg>`        |
| 移除依赖   | `npm uninstall <pkg>` / `pnpm remove <pkg>` | `bun remove <pkg>`     |
| 运行脚本   | `npm run <script>` / `pnpm <script>`        | `bun run <script>`     |
| 更新依赖   | `npm update` / `pnpm update`                | `bun update`           |
| 执行包命令 | `npx <cmd>` / `pnpm dlx <cmd>`              | `bunx <cmd>`           |
| 全局安装   | `npm install -g <pkg>`                      | `bun install -g <pkg>` |

### Tauri

- Tauri CLI 必须使用 `bunx tauri`（已配置在 `package.json` 的 `scripts.tauri` 中）
- 开发命令：`bun run dev`
- 构建命令：`bun run build`

### 锁文件 / Lock File

- 项目锁文件为 `bun.lock`
- **切勿**创建 `package-lock.json`、`yarn.lock` 或 `pnpm-lock.yaml`
- 如发现上述锁文件，应删除

### Scripts 执行

- 所有 `package.json` 中的 script 通过 `bun run <script>` 执行
- 传递参数时：`bun run <script> -- <args>`

### 初始化 / Scaffold

- 如需创建新项目，使用 `bun create <template>`
- 不要建议 `npm init` 或 `npx create-*`

## Drizzle Migration 工作流

数据库在 `apps/api/` 下，与 Coolify 等系统共用同一个 PostgreSQL 实例。

| 操作           | 命令                                 | 说明                                 |
| -------------- | ------------------------------------ | ------------------------------------ |
| 生成 Migration | `cd apps/api && bun run db:generate` | 根据 schema 变更生成 SQL 文件        |
| 应用 Migration | `cd apps/api && bun run db:up`       | 应用到数据库（**禁止**用 `db:push`） |
| 验证一致性     | `cd apps/api && bun run db:check`    | 检查 schema 与数据库是否一致         |

**红线：**

- **禁止**使用 `drizzle-kit push` 或 `bun run db:push` — 它会拉全库比对，这个库有其他服务的表，push 会提示删表
- **禁止**使用 `drizzle-kit migrate` — 这版本有 bug 一直转圈不返回
- 正确的流程：`generate` → `up` → `check`

## 检查方式

如果对某个命令是否应使用 bun 有疑问，检查：

- `package.json` 中有 `"packageManager": "bun@1.x"`
- 项目根目录有 `bun.lock`
- `.npmrc` 中有 `engine-strict=true`
