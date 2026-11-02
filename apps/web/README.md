# Galzy Web（@teyik0/furin）

Galzy 前端：Bun + Elysia 2 + Furin 文件路由，React 19 SSR。
API 网关由同进程的 Elysia 插件承担，页面通过 loader 在服务端取数、客户端通过 `/api/_bff/*` 复用同一份 BFF 处理逻辑。

## 目录结构

```text
src/
├── server.ts              # Furin 入口：Elysia(api) + furin({ pagesDir })
├── api/                   # Elysia 路由：/api/health、/api/_bff/:id、/api/auth/*、/api/search、/api/game、上传代理
├── pages/                 # 文件路由（URL 即路径）
│   ├── root.tsx           # 文档外壳：HeadContent/Scripts、主题脚本、Provider、Header/Footer
│   ├── error.tsx          # 全站错误边界
│   ├── not-found.tsx      # 404
│   ├── index.tsx          # /
│   ├── [id]/_route.tsx    # /:id 游戏详情布局（tab 导航）
│   └── ...                # 其余页面同 URL 结构
├── server/                # BFF 层（同构 surface + server-only impl）
│   ├── <domain>.ts        # 浏览器可 import：bffFn("domain.fn")，SSR 走进程内、浏览器走 POST /api/_bff
│   └── impl/<domain>.ts   # 真正实现（@teyik0/furin/server-only），只被 registry 引入
├── components/            # 业务组件（shadcn/@base-ui + Tailwind v4）
├── lib/                   # 工具、nav 兼容层、BFF 运行时、query 播种
└── store`, `hooks`, `integrations`
```

## 开发

```bash
bun install
bun run dev            # bun --hot src/server.ts，默认 :3000
bunx furin typegen     # 重新生成 furin-env.d.ts（新增/移动页面后）
bunx tsc --noEmit -p tsconfig.json
```

后端 API 默认 `http://localhost:3001`（`API_HOST`）。

## 页面约定

```tsx
import { defineRoute } from "@teyik0/furin";
import { t } from "elysia";
import * as z from "zod/mini";

export const route = defineRoute("/tags/[tagId]")
  .config({ mode: "ssr", params: t.Object({ tagId: t.String() }), query: z.object({ page: z.optional(z.number()) }) })
  .loader(async ({ params, query, request }) => ({ data: await getTagData({ data: { tagId: params.tagId } }) }))
  .head(({ data }) => seoMeta({ title: data.title, path: `/tags/${data.id}` }) as never)
  .page(({ data, params }) => <TagDetailPage data={data} />);
```

- `params` 必须用 TypeBox（`t.Object`）；`query` 用 zod（zod v4 作为 Standard Schema 直接可用），但**多选/布尔**字段要用 TypeBox（zod 不会把 `?a=1&a=2` 聚合成数组，也不会把 `"true"` 转 boolean）。
- loader 返回值就是 page props（扁平展开）；旧代码里 `context.queryClient.setQueryData` 的语义用 `lib/query-seed.ts` 的 `useSeedQueries` 复刻。
- 组件沿用 `@web/lib/nav`（`Link`/`useNavigate`/`useRouterState`/`useSearch`/`useParams`/`getRouteApi` 等），它是 @tanstack/react-router 的兼容层，旧 route id 由 `lib/route-manifest.ts` 映射为 furin pattern。
- BFF：新增服务端逻辑写 `server/impl/<domain>.ts` 的 `defineBff`，再在 `server/<domain>.ts` 用 `bffFn<typeof impl.fn>("domain.fn")` 暴露；`server/registry.ts` 由 `bun scripts/furin/gen-registry.mjs` 生成。

## 构建与部署

```bash
bun run build           # furin build --target bun → .furin/build/bun/{server.js,client,public}
bun run build:binary    # --compile embed → 单文件 .furin/build/bun/server(.exe)
bun run start           # 运行 server.js
```

Dockerfile 使用 `build:binary` 产物；运行镜像（chainguard glibc-dynamic，非 root 65532）只放 `/app/server`。
健康检查：`/app/server --healthcheck`（请求本机 `/api/health`），同时兼容 Dokploy 的 `healthcheck` 写法。

静态资源放在 `public/`，对外 URL 前缀为 `/public/*`；历史根路径（`/dzmm.webp`、`/telegram.png`、`/robots.txt` 等，含数据库里存的素材地址）由 `src/api/public.ts` 301 到 `/public/*`，新增 public 文件时同步该文件里的别名表即可（通用扩展名规则已覆盖未列出的文件）。

## 测试与校验

```bash
bun run test            # vitest（组件层）
bunx oxlint             # lint
bun run format          # biome format
```

UI 平价回归：`scripts/parity/`（CDP 截图 + 逐路由像素/文本 diff），用法见 `.parity/README.md`。