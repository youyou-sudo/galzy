# AI Instructions

## 包管理器 / Package Manager
本项目使用 **bun** 作为包管理器。禁止使用 `npm` 或 `pnpm`。
This project uses **bun** as its package manager. Do NOT use `npm` or `pnpm`.

### 命令对照 / Command Mapping

| 操作 | 禁止使用 ❌ | 必须使用 ✅ |
|------|-----------|-----------|
| 安装依赖 | `npm install` / `pnpm install` | `bun install` |
| 添加依赖 | `npm install <pkg>` / `pnpm add <pkg>` | `bun add <pkg>` |
| 移除依赖 | `npm uninstall <pkg>` / `pnpm remove <pkg>` | `bun remove <pkg>` |
| 运行脚本 | `npm run <script>` / `pnpm <script>` | `bun run <script>` |
| 更新依赖 | `npm update` / `pnpm update` | `bun update` |
| 执行包命令 | `npx <cmd>` / `pnpm dlx <cmd>` | `bunx <cmd>` |
| 全局安装 | `npm install -g <pkg>` | `bun install -g <pkg>` |
