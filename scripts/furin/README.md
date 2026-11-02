# Furin 迁移工具

| 脚本 | 用途 |
|---|---|
| `gen-registry.mjs` | 扫描 `apps/web/src/server/impl/**`，重建 `src/server/registry.ts`（新增 BFF handler 后必跑） |
| `migrate-server-fns.mjs` | 一次性迁移工具：把 `src/server/<domain>.ts` 里的 `createServerFn().validator().handler()` 拆成 `impl/<domain>.ts`（`defineBff`）+ 同构 surface（`bffFn`）。迁移已完成，保留作参考 |
| `lib/scan-server-fns.mjs` | 上面脚本共用的 `createServerFn` 链扫描器（typescript@7 不导出 JS 编译器 API，故手写） |

运行（仓库根目录）：

```bash
bun scripts/furin/gen-registry.mjs
```
