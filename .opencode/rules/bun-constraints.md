# Bun-Only AI Constraints

本项目强制使用 bun 作为唯一的包管理器和运行器。AI 助手必须遵守以下规则。

## 硬性规则

### 1. 只允许使用 `bun` 和 `bunx`

**禁止**使用 `npm`、`npx`、`yarn`、`pnpm` 的任何命令。

| 操作 | 允许 | 禁止 |
|------|------|------|
| 安装依赖 | `bun add <pkg>` | `npm install` / `yarn add` |
| 移除依赖 | `bun remove <pkg>` | `npm uninstall` |
| 运行脚本 | `bun run <script>` | `npm run` |
| 运行命令 | `bunx <cmd>` | `npx` |
| 更新依赖 | `bun update` | `npm update` |

### 2. Tauri 相关

- Tauri CLI 必须使用 `bunx tauri`（已配置在 `package.json` 的 `scripts.tauri` 中）
- 开发命令：`bun run dev`
- 构建命令：`bun run build`

### 3. 锁文件

- 项目锁文件为 `bun.lock`
- **切勿**创建 `package-lock.json`、`yarn.lock` 或 `pnpm-lock.yaml`
- 如发现上述锁文件，应删除

### 4. Scripts 执行

- 所有 `package.json` 中的 script 通过 `bun run <script>` 执行
- 传递参数时：`bun run <script> -- <args>`

### 5. 初始化/脚手架

- 如需创建新项目，使用 `bun create <template>`
- 不要建议 `npm init` 或 `npx create-*`

## 检查方式

如果对某个命令是否应使用 bun 有疑问，检查：
- `package.json` 中有 `"packageManager": "bun@1.x"`
- 项目根目录有 `bun.lock`
- `.npmrc` 中有 `engine-strict=true`
