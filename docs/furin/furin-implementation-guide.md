# Furin 0.8.0-alpha.0 深度调研与 Galzy 迁移实施指南

> 调研对象：`@teyik0/furin@0.8.0-alpha.0`（npm latest），peerDeps：`elysia@2.0.0-beta.32`、`react@^19.3.1`、`typebox@1.3.34`、`evlog`、`exact-mirror`
> 环境：Bun 1.4.4 / Windows 11 / bash；仓库 `D:\Users\xiaoy\Documents\Github\galzy`
> 证据来源优先级：**本机真实安装包 + 可运行 spike > 源码 > 文档**。文档：`.furin-research/llms-full.txt`；spike：`.furin-research/spike`（dev 端口 3311 / prod 3312 / 单文件 exe 3313）。
> 标注约定：✅已验证（本机实测，附命令与关键输出）｜⚠️有坑/有条件成立｜❌不支持

---

## 目录

- **0.** 一分钟结论
- [1. 路由（static / [id] / [...path] / (group) / index / _route / 数据合并 / id 规则）](#1)
- **2.** root.tsx：HeadContent / Scripts / lang / 内联主题脚本 / 静态资源 / favicon / 字体
- **3.** SSR loader：request / cookie / headers / redirect / notFound / requestLoader / defer / 错误作用域
- **4.** head()：meta / title / JSON-LD / links / scripts / SPA 更新
- **5.** 导航：<Link> / useNavigate / useRouter / useSearch / getRouteApi
- **6.** 守卫（等价 beforeLoad）：在 layout/page loader 里 throw redirect
- **7.** Elysia 2 API 路由（含与 apps/api 的差异清单）
- **8.** 类型化客户端（Eden）
- **9.** TanStack Query v5 + TanStack Store 集成
- **10.** Tailwind v4
- **11.** React Compiler
- **12.** dev：bun --hot / Windows HMR / furin-env.d.ts / 端口
- **13.** build：各 target 真实产物与运行命令
- **14.** public 静态资源 / ?url 导入 / CSS 资产
- **15.** vitest（现有 25 个 `.test.ts(x)`、jsdom + @testing-library/react）
- **16.** server-only 标记 / env（API_HOST / FURIN_PUBLIC_* / 构建期注入）
- **17.** 搜索参数：config.query 与 zod（Standard Schema）
- **18.** SPA 导航时数据获取（loader 重跑 / ?_furin=data / 预取）
- **19.** 流式 SSR（defer）与 React 19
- **20.** alpha 限制与风险
- **21.** 7 个架构问题（给 Lead 的确定性回答）
- **22.** TanStack Start → furin 概念对照表
- **23.** 目标架构建议（Galzy）
- **24.** 必须由 Lead 拍板的 10 个决策点
- **25.** 风险与备选方案
- **26.** 迁移路线图（建议）
- **27.** 附录

---


## 0. 一分钟结论

| 维度 | 结论 |
|---|---|
| 形态 | Elysia 插件式 React SSR 框架；页面=文件树，API=普通 Elysia 插件，同进程同源 |
| 与 TanStack Start | 路由模型相似（文件路由/嵌套布局/loader），但**没有** beforeLoad、pendingComponent、validateSearch、server function、Vite 工具链 |
| 迁移可行性 | 可行，但属于**重写路由层**而非替换实现：路由/loader/head/守卫/BFF 全部要按 furin 契约重写 |
| 硬门槛 | Elysia 1.4→2.0 beta（路由签名不兼容）、eden 1.x 类型不能进 Elysia 2 工程、静态资源路径改为 /public/*、`?url` 不支持 |
| 最大风险 | alpha 框架 + Elysia 2 beta + 前端零浏览器回归测试能力（本环境无法开浏览器） |
| 建议 | **BFF 分层 + 逐域灰度**：先迁 2~3 个只读页面（列表/详情/搜索）验证；不要一次性迁 46 页 |

---

## 1. 路由（static / [id] / [...path] / (group) / index / _route / 数据合并 / id 规则）

### 1.1 文件 → URL 映射 ✅

spike 实测（`bunx furin typegen` 生成的 `furin-env.d.ts` 是机器可读的事实）：

| 文件 | id（defineRoute 参数） | URL pattern |
|---|---|---|
| `src/pages/index.tsx` | `"/"` | `/` |
| `src/pages/(marketing)/about.tsx` | `"/(marketing)/about"` | `/about` |
| `src/pages/blog/index.tsx` | `"/blog"` | `/blog` |
| `src/pages/blog/[slug].tsx` | `"/blog/[slug]"` | `/blog/:slug` |
| `src/pages/docs/[...path].tsx` | `"/docs/[...path]"` | `/docs/*` |
| `src/pages/blog/_route.tsx` | `"/blog/_route"` | （布局，不产生 URL） |

```bash
$ cd .furin-research/spike && bunx furin typegen
◆ Route types written to furin-env.d.ts
$ grep '"/docs' furin-env.d.ts
    "/docs/[...path]": { kind: "page"; pattern: "/docs/*"; parent: ...; pathParams: { "*": string } };
```

关键点（**两条最容易写错的规则**）：

1. `defineRoute(id)` 的参数是**文件 id**（保留方括号与括号分组，去掉 `/index`，布局以 `/_route` 结尾）；而 `<Link to>`/`navigate()` 用的是**URL pattern**（`:slug` 形式）。
2. 写错 id 会在 dev 终端/overlay 与 `furin typegen`/`furin build` 里硬报错：

```text
$ bunx furin typegen
error: [furin] src/pages/wrong.tsx:2:34: defineRoute("/not-the-id") does not match this file. Its id is "/wrong":
```

同名 URL 冲突同样硬失败：

```text
error: [furin] Duplicate route pattern "/dup" from "(g)/dup.tsx" and "dup.tsx".
```

### 1.2 页面骨架（可直接复制）

```tsx
// src/pages/blog/[slug].tsx
import { defineRoute, notFound } from "@teyik0/furin";
import { t } from "elysia";

export const route = defineRoute("/blog/[slug]")
  .config({
    mode: "ssr",                                   // 必填；ssg / isr 见 §13
    params: t.Object({ slug: t.String({ minLength: 1 }) }), // 自己声明路径上的每个动态段
    query: t.Object({ preview: t.Optional(t.Boolean({ default: false })) }),
  })
  .loader(async ({ params, query, request, headers, cookie, set, path, log }) => {
    const post = await getPost(params.slug);
    if (!post) notFound({ message: "帖子不存在", data: { slug: params.slug } });
    return { post };
  })
  .head(({ post }) => ({ meta: [{ title: post.title }] }))
  .page(({ post, query }) => <article>{post.title}</article>);
```

链式顺序是**固定**的：`defineRoute(id) → config() → staticParams()?(SSG/ISR) → requestLoader()? → loader()? → head()? → page()|layout()`；少 `config()` 或 terminal 会直接报错。❌ 不存在文档旧版/脚手架模板里的 `.config({ layout: parentRoute })`——布局只由目录决定，脚手架模板已过时（见 §1.2、§12）。

### 1.3 路由组 / 布局 / 数据合并 ✅

```tsx
// src/pages/dashboard/_route.tsx
export const route = defineRoute("/dashboard/_route")
  .config({ mode: "ssr" })
  .loader(async ({ cookie }) => ({ user: { name: String(cookie.session?.value ?? "") } }))
  .layout(({ children, user }) => (
    <div><header>{user.name}</header>{children}</div>
  ));
```

数据合并规则（实测 + 类型推导一致）：

- **布局/页面的渲染回调**拿到的是**已 resolve 的扁平 props**（root→leaf 合并，leaf 覆盖同名 key）。
- **后代 loader** 里，祖先字段是 **Promise**：

```ts
// src/pages/dashboard/settings.tsx —— 注意 await
.loader(async ({ user }) => ({ settings: await getSettings((await user).name) }))
```

- 若在 page 的 loader 里直接 `return { user }` 覆盖父字段，类型会报 `__furinConflict`（"this loader key overwrites a parent loader key with an incompatible type"）→ **父子字段名必须错开**（这是编译期保护，不是运行时降级）。
- 每个 loader 独立并行启动，只 await 自己需要的祖先字段（`Promise.all` 示例见文档 Data Loading）。

### 1.4 特殊文件

| 文件 | 作用 | 是否产生 URL |
|---|---|---|
| `root.tsx` | 文档根（必须） | 否 |
| `_route.tsx` | 目录布局 | 否 |
| `error.tsx` | 最近段错误边界 | 否 |
| `not-found.tsx` | 最近段 404 边界 | 否 |
| `_` 开头的**文件名** | 非路由模块 | 否 |

⚠️ 只有**文件名**前缀 `_` 被忽略；`_foo/` 目录不是路由组约定（我建 `src/pages/_conflict/a.tsx` 时被当作非路由目录，未进 typegen）。

---

## 2. root.tsx：HeadContent / Scripts / lang / 内联主题脚本 / 静态资源 / favicon / 字体

✅ 全部支持。spike 的 root 布局（`.furin-research/spike/src/pages/root.tsx`）实测输出：

```tsx
import { defineRootRoute, HeadContent, Scripts } from "@teyik0/furin";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const themeScript = `(function(){try{var t=localStorage.getItem("spike-theme")||"auto";var d=t==="dark"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.dataset.theme=t;}catch(e){}})();`;

export const route = defineRootRoute()
  .config({ mode: "ssr" })          // root 也可以 ssg；ssr 表示整棵文档按请求渲染
  .layout(({ children }) => (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />                            {/* 框架资源 + 当前页 head() */}
        <link rel="icon" href="/public/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
        <Scripts />                                 {/* 序列化 __FURIN_DATA__ + 入口 module */}
      </body>
    </html>
  ));
```

SSR 输出（`curl -s http://127.0.0.1:3311/ | head -c 400`）：

```html
<!DOCTYPE html><html lang="zh-CN"><head><meta charSet="utf-8" data-furin-head=""/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/><title>Spike Home</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>...
<script>(function(){try{var t=localStorage.getItem("spike-theme")...})();</script></head>
```

要点：

- `<HeadContent/>` 已自带 `<meta charset>` + viewport（+ buildId meta、样式表 link、route modulepreload）；重复写 charset 没必要。
- 自定义 `<head>` 子节点、字体 preconnect、内联主题脚本都按原样进 HTML ✅（深色模式防闪白可原样搬）。
- ⚠️ **静态资源 URL 是 `/public/*`**：`public/favicon.svg` → `/public/favicon.svg`；只有 `/favicon.ico` 被特判到根路径。现有站点把 `/favicon.ico`、`/robots.txt`、图片挂根地址，迁移时要改 URL 或加 Elysia 路由（§14）。
- `<Scripts/>` 必须在 body 内（它输出 `__FURIN_DATA__` JSON、`__FURIN_HEAD__`、entry module）；漏掉会没有 hydration。

---

## 3. SSR loader：request / cookie / headers / redirect / notFound / requestLoader / defer / 错误作用域

### 3.1 loader ctx 实测字段

| 字段 | 类型/说明 | 实测 |
|---|---|---|
| `params` | 合并后的路径参数（已校验） | ✅ |
| `query` | 合并后的 query（默认值已应用） | ✅ |
| `request` | Web `Request`（`request.headers.get("cookie")`） | ✅ |
| `headers` | **Elysia 的 Record**，不是 Headers 实例：`headers["user-agent"]` | ✅（用 `headers.get()` 会 TS 报错） |
| `cookie` | Elysia cookie jar：`cookie.session?.value` | ✅ |
| `set` | Elysia set：`set.headers["x-xxx"]=...` | ✅（Cache-Control 例外，见 §3.5） |
| `redirect` / `path` / `log` | Elysia redirect helper / 逻辑 path / evlog | ✅ |
| 祖先 loader 字段 | `Promise<T>` | ✅ |

### 3.2 redirect（守卫）✅

```ts
import { redirect } from "elysia";
throw redirect(`/login?redirect=${encodeURIComponent(path)}`, 302);
```

实测（dev 3311 与 prod 3312 一致）：

```text
$ curl -s -o /dev/null -D - http://127.0.0.1:3311/dashboard | head -4
HTTP/1.1 302 Found
Location: /login?redirect=%2Fdashboard
Cache-Control: private, no-store
```

⚠️ SPA 导航时的重定向处理：导航控制器有 `#followRedirects`（源码 `src/client/router/navigation-controller.ts`），会把 3xx 当导航目标继续取数据；**浏览器实测未做**（本环境无法开浏览器），标记为源码验证。

### 3.3 notFound ✅

```ts
notFound({ data: { slug }, message: "This post does not exist." });
```

```text
$ curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3311/blog/missing
404
$ grep -o 'data-boundary="blog-not-found"' /tmp/p_nf.html
data-boundary="blog-not-found"
```

→ 渲染 **最近的 `not-found.tsx`（blog 目录下）**，状态码 404，且外层布局保留。

### 3.4 defer + <Await> + <Suspense> ✅ / requestLoader 与 loader 的区别 ✅

```tsx
import { Await, defer, defineRoute } from "@teyik0/furin";
import { Suspense } from "react";

export const route = defineRoute("/dashboard")
  .config({ mode: "ssr" })
  .loader(async () => defer({
    ready: "shell rendered before analytics",
    analytics: fetchAnalytics(),              // Promise 字段才会流式
  }))
  .page(({ ready, analytics }) => (
    <>
      <p>{ready}</p>
      <Suspense fallback={<p>loading analytics…</p>}>
        <Await resolve={analytics}>{(data) => <pre>{JSON.stringify(data)}</pre>}</Await>
      </Suspense>
    </>
  ));
```

```text
$ curl -s -H 'cookie: session=alice' http://127.0.0.1:3311/dashboard | grep -o 'loading analytics…\|visits=<!-- -->[0-9]*'
loading analytics…
visits=<!-- -->42
```

- `defer()` **只对 ssr 页面**生效；ssg/isr 里返回 promise 字段会 fail fast。
- `requestLoader()`：只用于 **SSG/ISR 页面或共享布局**的「请求私有数据」，每个字段以 Promise 下发给 page/layout；SSR 页面自己声明 `requestLoader()` 会编译期报错：`TS2345 ... FurinTypeError<"SSR pages cannot declare requestLoader(); use loader() and defer()">` ✅（已用 @ts-expect-error 反证）。
- `head()` 只能读同步 loader 字段（defer/requestLoader 字段不可用）。

### 3.5 错误作用域 ✅（prod）

| 失败点 | 渲染 |
|---|---|
| page loader / head / notFound | 最近 `error.tsx`/`not-found.tsx`（在它上面的所有布局内部） |
| layout loader | **父目录**的边界（同级 error.tsx 不管自己） |
| root loader / 文档壳 | root `error.tsx` + 框架最小文档 |

实测：dev 下 loader 抛错显示 **Bun dev error overlay（500）**，不渲染 error.tsx；**生产构建**才渲染边界：

```text
$ curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3312/boom
500
$ grep -o 'data-boundary="root-error"\|data-testid="error-message">[^<]*' /tmp/q_boom.html
data-boundary="root-error"
data-testid="error-message">Something went wrong
```

⚠️ 错误信息被安全归一化：普通 `Error` 一律变成 `Something went wrong`（+ 10 位 digest），**原始 message 不上屏**。现有 `elysiaErrorF` 映射的 `{status,message}` 要改成 `throw new Response(message,{status})` 或抛 Eden problem 才能保留状态码与文案。

⚠️ layout loader 失败落到父边界的结论来自文档 + 源码，**未单独做失败注入实测**。

---

## 4. head()：meta / title / JSON-LD / links / scripts / SPA 更新

✅ 全量支持，实测 `/head-demo`：

```tsx
.head(({ title, price }) => ({
  meta: [
    { title },
    { name: "description", content: "head() descriptor demo" },
    { property: "og:type", content: "article" },
    { "script:ld+json": { "@context": "https://schema.org", "@type": "Product", name: title, offers: { "@type": "Offer", price } } },
  ],
  links: [{ rel: "alternate", type: "application/rss+xml", href: "/feed.xml" }],
  scripts: [{ type: "module", children: 'console.log("head inline script ran")' }],
  styles: [{ children: ".head-demo-badge{color:tomato}" }],
}))
```

输出同时出现 `<title>Head demo</title>`、`application/ld+json`、`rel="alternate"`、内联 style、内联 script ✅。

现有 `head()`（TanStack 的 `{ meta:[...], links:[...], scripts:[...] }`）映射：

| 现有写法 | furin | 说明 |
|---|---|---|
| `meta: [{title}]` | 同 | 直接用 |
| `meta: [{name,content}]` / `{property,content}` | 同 | 直接用 |
| `links: [{rel,href,...}]` | 同 | 直接用 |
| `scripts: [{src, async}]` | 同（`children` 为 raw HTML） | ⚠️ 只接受字符串 children |
| JSON-LD 手写 `<script type="application/ld+json">` | `{"script:ld+json": object}` | 由框架转义 |
| `head({ loaderData })` | `head({ ...同步 loader 字段 })` | promise/defer 字段不可用 |

SPA 导航后 head 是否更新：✅ 会。源码 `#commit()` 里 `document.title = state.title`，且 `<HeadContent/>` 从 `DocumentContext.state.head` 渲染，状态变更即重渲染 meta/links/scripts/styles（`src/client/document.tsx`）。⚠️ 浏览器未实测，属源码级验证。

---

## 5. 导航：<Link> / useNavigate / useRouter / useSearch / getRouteApi

### 5.1 <Link> 支持面 ✅

`Link` 最终 `createElement("a", { "data-furin-link": true, href, onClick, onFocus, onMouseEnter, onMouseLeave, ref, ...anchorProps, ...extraProps })`（源码 `src/client/link.tsx`），因此 `className`/`target`/`rel`/`data-*`/`onClick`/`ref`/`aria-*` **全部透传**；`onClick` 先执行，`preventDefault()` 可拦截 SPA 导航。SSR 输出：

```html
<a data-furin-link="true" href="https://bun.sh" target="_blank" rel="noreferrer">
```

支持 props：`to` `params` `search` `hash` `replace` `resetScroll` `preload(false|intent|viewport|render)` `preloadDelay` `preloadStaleTime` `disabled` `activeProps`/`inactiveProps`；active 时加 `data-status="active"`。

⚠️ **最大陷阱：`to` 必须写 URL pattern，不能写文件 id**：

```text
<Link to="/blog/[slug]" params={{slug:"x"}}>   → href="/blog/[slug]"        ❌ 参数不替换
<Link to="/docs/[...path]" params={{"*":"a/b"}}> → href="/docs/[...path]"    ❌
<Link to="/blog/:slug" params={{slug:"x"}}>      → href="/blog/x"            ✅
<Link to="/docs/*" params={{"*":"a/b"}}>         → href="/docs/a/b"          ✅
```

同时 `to` 字面量会被类型检查（未知内部路径直接编译错误：`[furin] Unknown route "/(marketing)/about"`）；外链/绝对 URL/mailto 允许，外链走整页导航。

### 5.2 程序化 API

| 需求 | furin |
|---|---|
| `useNavigate()` | ✅ `navigate({to,params,search,hash,replace,resetScroll})`，返回 Promise |
| `useRouter()` | ✅ `currentHref` / `currentPattern` / `search` / `isNavigating` / `navigate` / `prefetch` / `refresh()` / `invalidatePrefetch(path,"page"|"layout")` |
| `router.prefetch()` | ✅（LRU，默认容量 50、staleTime 30s） |
| `useSearch()` | ✅ `[search, setSearch]`，按 pattern 取当前路由 search |
| `useParams()` | ⚠️ 无独立导出；用 `getRouteApi("/blog/:slug").useParams()` |
| `useLocation/useMatches/useRouterState` | ❌ 不存在（自建方案见 §21 Q5） |
| 外链/新标签 | ✅ 原生 `target`/`rel` 透传 |
| 滚动恢复 | ✅ 前进后退恢复位置；`resetScroll` 控制；hash 优先于置顶 |
| hash 锚点 | ✅ 支持 `hash`（不含 #），实测 `navigate({to:"/docs/*",params:{...},hash:"x"})` |

### 5.3 getRouteApi（跨组件读数据）

```tsx
import { getRouteApi } from "@teyik0/furin/client";
const blog = getRouteApi("/blog/:slug");     // 必须是当前激活路由的 pattern，否则 throw
const { slug } = blog.useParams();
const { post } = blog.useLoaderData();
```

⚠️ pattern 不匹配直接抛错（防止读错数据）；不支持 `route.useLoaderData()`。



---

## 6. 守卫（等价 beforeLoad）：在 layout/page loader 里 throw redirect

✅ 推荐做法：**受保护目录的 `_route.tsx` loader 做守卫**（目录即权限边界，等价 TanStack 的 pathless `_authL` 布局路由）。

```tsx
// src/pages/dashboard/_route.tsx
import { defineRoute } from "@teyik0/furin";
import { redirect } from "elysia";

export const route = defineRoute("/dashboard/_route")
  .config({ mode: "ssr" })
  .loader(async ({ cookie, path }) => {
    const session = cookie.session?.value;
    if (!session) {                                  // 或 await sessionClient(request)
      throw redirect(`/login?redirect=${encodeURIComponent(path)}`, 302);
    }
    return { user: { name: String(session) } };
  })
  .layout(({ children, user }) => (<div><header>{user.name}</header>{children}</div>));
```

- 实测：`/dashboard` 无 cookie → `302 Location: /login?redirect=%2Fdashboard`（dev 3311 + prod 3312 都一样）✅
- admin 组：把 `(admin)/_route.tsx` 的 loader 换成角色判断即可；组**本身不提供访问控制**（文档明确）。
- ⚠️ 只保护「已注册的 SSR 页面」。文档明确：SSG/ISR 可能命中缓存不经过 Elysia；root catch-all 与 dev 热加页面可能绕过父级 guard。**敏感 loader / API 必须自己再判一次**。
- ⚠️ 也可以学 furin 官方推荐用 Elysia `beforeHandle` + `isFurinPageRequest(request, prefix)` 在 Elysia 层统一守卫（文档 `API Routes`）；但 `isFurinPageRequest` 未在本 spike 实测。
- 现有 `beforeLoad` 的 `redirect({ to: "/auth/login", search: { redirect: location.href } })` → 改成上面的 `redirect(url, 302)`，search 参数手工拼进 URL（兼容）。

---

## 7. Elysia 2 API 路由（含与 apps/api 的差异清单）

### 7.1 同实例挂路由 ✅

```ts
// src/api/todos.ts —— 注意：hook 在前、handler 在后
import { Elysia, t } from "elysia";

export const todoApi = new Elysia()
  .get("/todos", () => todos)
  .post("/todos", { body: t.Object({ title: t.String({ minLength: 1 }) }) }, ({ body }) => {
    const todo = { id: ++seq, title: body.title, done: false };
    todos.push(todo);
    return todo;
  });
```

```ts
// src/api/app.ts —— 只做组合，不调用 furin()
import { Elysia } from "elysia";
export const apiApp = new Elysia({ prefix: "/api" }).use(todoApi);
export type ApiApp = typeof apiApp;
```

### 7.2 cookie / body 校验 / CORS 实测 ✅

```ts
.post("/login", { body: t.Object({ name: t.String({ minLength: 1 }) }) }, ({ cookie, body }) => {
  cookie.session?.set({ value: body.name, httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600 });
  return { ok: true };
})
```

```text
$ curl -s -D - -X POST -H 'content-type: application/json' -d '{"title":""}' http://127.0.0.1:3311/api/todos
HTTP/1.1 422
{"type":"validation","code":"validation","title":"Validation Error","status":422,
 "detail":"must not have fewer than 1 characters","on":"body","property":"/title", ...}

$ curl -s -D - -X POST -H 'content-type: application/json' -d '{"name":"bob"}' http://127.0.0.1:3311/api/login
set-cookie: session=bob; Max-Age=3600; Path=/; HttpOnly; SameSite=Lax
```

CORS：**Elysia 2 内核没有 cors**（`import { cors } from "elysia"` 不存在；`@elysia/cors` 有 `2.0.0-beta.2`，未安装验证）。spike 用手写 hook 实测通过：

```ts
new Elysia()
  .onAfterHandle(({ set, request }) => {
    const origin = request.headers.get("origin");
    if (origin) { set.headers["access-control-allow-origin"] = origin; set.headers.vary = "Origin"; }
  })
  .options("/*", ({ set }) => {
    set.headers["access-control-allow-methods"] = "GET,POST,PATCH,DELETE,OPTIONS";
    set.headers["access-control-allow-headers"] = "content-type";
    set.headers["access-control-allow-credentials"] = "true";
    return new Response(null, { status: 204 });
  })
```

```text
$ curl -s -i -X OPTIONS -H 'Origin: http://example.com' http://127.0.0.1:3311/api/todos
HTTP/1.1 204 No Content
Access-Control-Allow-Methods: GET,POST,PATCH,DELETE,OPTIONS
Access-Control-Allow-Origin: http://example.com
Vary: Origin
```

### 7.3 与 apps/api（Elysia 1.4.30）差异清单（只列影响迁移的）

| # | Elysia 1.4（现状） | Elysia 2.0.0-beta.32 | 影响 |
|---|---|---|---|
| 1 | `.get(path, handler, schema)` handler 在前 | **只允许 `(path, hook, handler)`**，反序直接 throw：`".post(...) is the 1.x order; Elysia 2 takes (path, hook, handler)"` | apps/api 50 个路由文件全部要改参数顺序，或整体不迁（推荐） |
| 2 | `error(code, ...)`/`status()` | `problem()` + RFC 9457 `application/problem+json`；`.onError(ErrorClass, handler)` 类式错误 | 前端错误处理要按 problem 结构解析 |
| 3 | `@elysiajs/cors` | 无内核 cors；`@elysia/cors@2.0.0-beta.x` | BFF 手写 CORS 或装新包 |
| 4 | `@elysia/openapi` / jwt / opentelemetry（1.x 插件） | 生态为 `@elysia/*@2.0.0-beta.*`，混用风险高 | 不建议在同一进程混 1.x/2.x 插件 |
| 5 | TypeBox `t`（0.34） | 独立 `typebox@1.3.34` + `t` 仍是 elysia 导出 | 校验错误体变了（detail/property/expected/found） |
| 6 | 校验失败默认 422（spike 实测） | 同左，但 **AOT 下 coercion 细节会变粗**：构建日志提示 `[elysia-aot]: 2 sealed validator slots carry a coercion/codec schema; 422 error details will be coarse` | 依赖精确校验文案的地方要注意 |
| 7 | `cookie.x.value` / `.set()` / `.remove()` | 一致（实测 `.set({value,httpOnly,...})` 生效） | 无 |

### 7.4 代理到 3001 的推荐写法（cookie 透传）

不要做「通用反向代理」。BFF 用**服务端直连 apps/api**：

```ts
// src/lib/backend.ts（server-only）
import "@teyik0/furin/server-only";

const API = process.env.API_HOST ?? "http://127.0.0.1:3001";

export async function backendFetch(path: string, init: RequestInit & { cookie?: string | null } = {}) {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);      // 原样透传 better-auth cookie
  const response = await fetch(new URL(path, API), { ...init, headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Response(await response.text(), { status: response.status }); // 让最近 error.tsx 接管
  }
  return response.json();
}
```

```ts
// 页面 loader
.loader(async ({ request }) => {
  const cookie = request.headers.get("cookie");
  const games = await backendFetch("/games?pageIndex=0&pageSize=20", { cookie });
  return { games };
})
```

⚠️ 如果确实需要浏览器直连 3001（跨域），则要用 `apps/api` 的 `@elysiajs/cors` + `credentials: true`，并且 cookie 域/SameSite 要匹配；不推荐（现有架构本来就不这么做）。

---

## 8. 类型化客户端（Eden）

### 8.1 furin 内部：Eden v2 ✅

```ts
// src/lib/api.ts
import { treaty } from "@elysia/eden";
import { createIsomorphicFn } from "@teyik0/furin";
import { apiApp, type ApiApp } from "../api/app";

export const getApi = createIsomorphicFn()
  .server(() => treaty(apiApp))                          // 进程内直调，不走 HTTP
  .client(() => treaty<ApiApp>(window.location.origin)); // 浏览器走 HTTP
```

实测：loader 里 `await getApi().api.slow.get()` 在 SSR 拿到数据（页面 defer 里 `visits=42`）；tsc 0 错误；生产 client bundle 中 grep 不到 `Elysia`/`treaty`/`async_hooks` → `.server` 分支连同其独占 import 被整体剔除 ✅。

### 8.2 用 @elysiajs/eden@1.4.9 消费 apps/api 的 Elysia1.4 type —— ❌ 不行

实测（`.furin-research/spike/experiments/eden-v1-consume-elysia1-app.incompatible.ts`）：

```text
src/lib/backend-api.ts(5,31): error TS2740: Type 'Elysia<"", {...}, ...>' is missing the following
properties from type 'Elysia<any, any, any, any, any, any, any, DefaultEphemeral>':
#private, history, ['~routes'], ['~addRoute'], and 9 more.
```

原因：在 furin 工程里，`elysia` 解析到 2.0.0-beta.32；eden 1.4.9 的 `treaty<App>` 期望 1.x 的 `ElysiaApp` 形状，而 `apps/api` 导出的 `app` 是 1.4 类型 → 两个版本类型不兼容。加 tsconfig `paths` 也救不了（是结构不匹配，不是解析失败）。

**替代方案（按推荐度）**：

1. **手写泛型 fetch 客户端**（最稳，零版本耦合）：

```ts
// src/lib/backend.ts（server-only）
export interface GameListResult { list: Game[]; total: number }

export const backendApi = {
  games: {
    list: (query: { pageIndex: number; pageSize: number }, cookie?: string | null) =>
      backendFetch(`/games?pageIndex=${query.pageIndex}&pageSize=${query.pageSize}`, { cookie }) as Promise<GameListResult>,
  },
};
```

2. 把「apps/api 契约类型」下沉到 `packages/contracts`（纯 type，不 import elysia），BFF 与前端都用它；长期最干净。
3. 等 apps/api 升 Elysia 2 后再用 eden v2 直连（迁移成本大，见 `7.3）。
4. 浏览器侧调 BFF：用 `treaty<ApiApp>(location.origin)`（Elysia 2 同版本，类型可用）或手写 fetch；spike 用前者。

### 8.3 浏览器侧调用 BFF

```tsx
const api = getApi();
const { data, error } = await api.api.todos.get();     // /api/todos
```

✅ 类型编译通过；✅ build 无服务端泄漏。⚠️ **真实浏览器调用未验证**（本环境浏览器 daemon 拒绝访问，无法开窗口）。

---

## 9. TanStack Query v5 + TanStack Store 集成

- Provider 位置：root layout ✅（`AppProviders` 包 `children` + `<Scripts/>` 前）。spike 实测 SSR 正常渲染、client bundle 含 TanStack Query。
- SSR 首屏：**用 loader**（不要用 Query 的 `ensureQueryData` 做 SSR 数据）；loader 数据经 `__FURIN_DATA__` 序列化进水合，客户端无需 refetch。
- 客户端交互：`useQuery`/`useMutation` 正常（TodoPanel 实测：`/api/todos` GET/POST + `invalidateQueries`）。
- dehydrate 是否需要：**不需要也能跑**（spike 就是 `useState(() => new QueryClient())`，SSR 不预填，客户端 mount 后 fetch）。若想避免二次请求，可在页面 loader 里 `prefetchQuery` + 返回 `dehydrate(queryClient)`，再在 root 用 `getRouteApi`/读取 `__FURIN_DATA__` 预填 —— **spike 未实现，标记待验证**。
- ⚠️ QueryClient 必须**每请求一个**（`useState` 即可；不要在模块级 new，否则多请求串数据/内存涨）。
- TanStack Store：与框架无关的纯 React 状态库，可原样使用（`createStore`+`useSelector`），无 SSR 集成需求。

```tsx
// src/components/app-providers.tsx（root layout 用）
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

---

## 10. Tailwind v4

✅ 可原样用（含 `@theme inline` / oklch / `@custom-variant` / `@utility` / `tw-animate-css`）。

```toml
# bunfig.toml
[serve.static]
plugins = ["bun-plugin-tailwind", "@teyik0/furin/strip-plugin"]
env = "FURIN_PUBLIC_*"

[install]
peer = false
```

```ts
// furin.config.ts
import { defineConfig } from "@teyik0/furin/config";
import tailwind from "bun-plugin-tailwind";

export default defineConfig({
  plugins: [{ ...tailwind, buildOnly: true }],
});
```

spike `globals.css`（`@import "tailwindcss"; @import "tw-animate-css"; @theme inline {...} @custom-variant dark ... @utility container-page {...}`）→ 生产构建产出 `_hydrate-*.css (14.1 KB)` + 每页 CSS chunk ✅；`container-page`、`oklch`、dark variant 都生效。

⚠️ 现有 `apps/web-tanstack/src/styles.css` 里的 `@plugin "@tailwindcss/typography"`、`@source not "..."`、`@import "shadcn/tailwind.css"`、`@import "react-photo-view/..."` 都是 Tailwind v4 CSS 语法，理论上无痛；但 `@source` 的相对路径要按新目录重写，且需要把 `@tailwindcss/typography` 装进新工程（现有依赖里已有）。**未逐行迁移验证**（只验证了同语法子集）。
⚠️ 生产环境 **不再有 `@tailwindcss/vite`**，靠 `bun-plugin-tailwind`；若某插件只支持 PostCSS/Vite 管线，要改写。

---

## 11. React Compiler

✅ 默认开启（`furin.config.ts` 的 `reactCompiler` 默认 `true`，构建时传给 `Bun.build({ reactCompiler, reactCompilerOutputMode: "client" })`）。

实测：client 产物出现 memo cache 调用（`_c(` / `useMemoCache` 形态），说明编译器已生效。

现有仓库用 `babel-plugin-react-compiler@1.0.0` + `@rolldown/plugin-babel`；迁移后**删掉 babel 插件**，只保留 `reactCompiler: true`（可用 `reactCompiler: false` 做兼容性排查）。

⚠️ 它作用于 **生产 client bundle**；dev 下由 Bun 的 HMR 管线处理，不保证与 build 一致 → 视觉/状态 bug 必须用 `furin build` 产物复验。

---

## 12. dev：bun --hot / Windows HMR / furin-env.d.ts / 端口

```json
{ "scripts": { "dev": "bun --hot src/server.ts" } }
```

✅ Windows 11 实测可用（Bun 1.4.4）：启动 3~5s，`listen({ port, hostname: "127.0.0.1" })` 正常；HMR/Error overlay/DevTools 由 `furin()` 自动接管（没有 `furin dev` 命令）。日志会打印：

```text
[furin] Dev files written (.furin/_hydrate.tsx + .furin/index.html + furin-env.d.ts)
[Elysia] GET /_bun_hmr_entry/index.html is an HTML bundle served natively, hooks do not run for it
```

⚠️ 坑 1：**新增模块后 dev 不一定能解析**。实测给 root layout 加 `@/components/spa-probe`（新文件）后 HMR 反复报 `Cannot find module '@/components/spa-probe'`，**必须重启 dev**。
⚠️ 坑 2：`furin-env.d.ts` 每次 dev 启动/路由变更重写；加进 tsconfig `include`，并从 Biome/Prettier 排除。
⚠️ 坑 3：页面模块 import 链里**不能 import 会执行 `await furin()` 的 server 入口**，否则死锁（见 `21.1）。
⚠️ 坑 4：dev 的 HMR 会把页面模块放进第二个模块图（`?furin-server`），**模块级单例（AsyncLocalStorage/Map/counter）会被求值两次**；跨模块图共享必须挂 `globalThis[Symbol.for(...)]`（实测：不挂则 loader 读不到 ALS，挂了就能读到）。

---

## 13. build：各 target 真实产物与运行命令

```bash
$ cd .furin-research/spike
$ bunx furin build --target bun            # 默认
$ bunx furin build --target bun --compile server
$ bunx furin build --target bun --compile embed
$ bunx furin build --target static
```

### 13.1 `--target bun` ✅

```text
.furin/build/bun/
├── server.js            # Bun 运行入口（bun server.js）
├── client/              # 浏览器资源（_hydrate-*.js/css、每页 chunk、字体/图片）
├── public/              # 你的 public/ 副本（URL 前缀 /public）
├── chunk-*.js           # 服务端共享 chunk
├── server.css / server-codec.js
├── _furin-*.ts          # 生成的类型/入口（调试用）
└── furin-prerender.json
```
合计 3.2 MB；`bun .furin/build/bun/server.js` 实测启动 **~322ms** 到 `/health` 200。

### 13.2 `--compile embed` ✅（单文件，适合无 shell 镜像）

```text
$ ls -la .furin/build/bun/server.exe
-rwxr-xr-x 122049536  server.exe        # 122 MB（内含 Bun runtime + client/public）
$ PORT=3313 ./.furin/build/bun/server.exe
[furin] Server running at http://localhost:3313
$ curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3313/public/favicon.svg → 200
```

⚠️ embed 构建会**清理同一输出目录**（`server.js`/`client/` 消失），不要和 bun 目标混用同一目录（混合时会报 build 失败，需 `rm -rf .furin/build`）。

### 13.3 `--target static` ⚠️ / ❌（条件成立）

```text
$ bunx furin build --target static
error: [furin] Cannot produce a static export: the following routes are not SSG and cannot be pre-rendered.
Either change their mode to "ssg", remove them, or set onSSR: "skip" in your static config.
  • /blog-error-demo (mode: ssr)
```

→ 静态导出只接受 ssg（+ `staticParams` 的动态页），且**拒绝任何 `requestLoader()`**。Galzy 是 cookie 个性化站点，静态导出不适用。

### 13.4 Docker（无 shell 镜像）方案 ✅ 设计可行

现有 `apps/web-tanstack/Dockerfile` 是「Nitro 产物 + `bun build --compile` + `cgr.dev/chainguard/glibc-dynamic`」。迁移后：

```dockerfile
# build 阶段（linux/amd64，必须与运行镜像同架构；Windows 上不能交叉产出 linux 二进制，未验证交叉编译）
FROM oven/bun:1.4.4 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bunx furin build --target bun --compile embed

FROM cgr.dev/chainguard/glibc-dynamic AS run
WORKDIR /app
COPY --from=build /app/.furin/build/bun/server /app/server
ENV PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000
ENTRYPOINT ["/app/server"]
```

- 单文件二进制无外部资源，chainguard/distroless 都能跑（glibc，需要 `glibc-dynamic` 而不是 static/musl）✅（Windows exe 行为已验证；linux 二进制未在本机产出）。
- `HEALTHCHECK`：chainguard 无 shell/curl，所以**在自己 server 入口加 argv 分支**，spike 已实现并实测：

```ts
// src/server.ts 顶部（必须在 furin() 之前）
if (process.argv.includes("--healthcheck")) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) });
    process.exit(r.ok ? 0 : 1);
  } catch { process.exit(1); }
}
```

```text
$ PORT=3314 bun .furin/build/bun/server.js --healthcheck ; echo exit=$?   → exit=0
$ PORT=3999 bun .furin/build/bun/server.js --healthcheck ; echo exit=$?   → exit=1
```

```dockerfile
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 CMD ["/app/server", "--healthcheck"]
```

- ⚠️ 预压缩 `.gz/.br`：现有 Vite 插件产物没有对应物。要么放弃（交给前置 CDN/反向代理），要么在 `furin build` 后自写脚本对 `client/**` 做 gzip/brotli 并配 Nitro/nginx 式静态服务——但 furin 自带的 Bun 静态处理不会按 `Accept-Encoding` 选预压缩文件，**默认建议放弃**。
- ⚠️ 静态资源仍由 server 进程提供（`/_client/*`、`/public/*`），无法像现在那样交给 CDN 直出（除非把 `client/` 单独同步到 CDN，且 `publicPath` 改成 CDN 前缀——`furin build` 目前没有该配置项暴露，未验证）。

---

## 14. public 静态资源 / ?url 导入 / CSS 资产

| 能力 | 结论 | 证据 |
|---|---|---|
| `public/*` | ✅ 但 URL 是 `/public/*`；`/favicon.ico` 特判到根 | `/public/favicon.svg → 200`，`/favicon.svg → 404`（dev 与 prod 一致） |
| `/robots.txt` 挂根 | ❌ | `404`；需要 Elysia 路由或改 URL |
| `import logo from "./logo.svg"` | ✅ 编译为资源 URL | 构建产出 `client/logo-*.svg`，SSR 里被 preload |
| `import x from "./x.svg?url"` | ❌ | dev bundle 直接 500：`Could not resolve: "@/assets/logo.svg?url"` |
| `import "./x.css"` | ✅ 打进 client CSS（每页 chunk） | 产出 `assets-*.css` |
| CSS `?url` | ❌ | 同上（`card.css?url` 解析失败） |
| 环境类型 | ⚠️ `@teyik0/furin/env` 只声明 `*.css/*.svg/...`，**没有 `*?url`** → 需自己加 `declare module "*.svg?url"` | tsc TS2307 |

⚠️ dev 下资源 preload 会输出**绝对文件系统路径**（Windows 上 `D:\...\src\assets\logo.svg`），生产构建才是正常 `/_client/logo-*.svg`。属于 dev-only 噪声，但会误导排查。

---

## 15. vitest（现有 25 个 `.test.ts(x)`、jsdom + @testing-library/react）

✅ 可以跑，条件是**把 UI 从页面文件里拆出来**。

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "jsdom", globals: true, include: ["tests/**/*.test.{ts,tsx}"] },
});
```

```text
$ cd .furin-research/spike && bunx vitest run
 ✓ tests/components.test.tsx (2 tests) 101ms
 Test Files  1 passed (1)   Tests  2 passed (2)
```

需要的 alias：至少 `@` → `src`；若沿用 `@web`/`@libs` 就照旧映射。⚠️ 必须安装 `vite`（vitest 5 的 peer，spike 里一开始没装直接 `ERR_MODULE_NOT_FOUND: vite`）。

⚠️ 结构性限制：页面文件导出的是 `route`（builder 对象），**不是组件**，不能 `render(<Page/>)`。所以：
- 把页面 UI 抽到 `src/components/**`，测试组件（现有 25 个测试大多测组件/hook，可行）；
- loader 是**不可直接调用**的（绑定在路由链上），要测业务逻辑就把逻辑抽成 `src/lib/**` 纯函数/服务，再单测；
- 需要路由上下文的组件（`Link`/`useSearch`/`getRouteApi`）在 vitest 里会落到 fallback 行为（`Link` 渲染普通 `<a>`），断言 `href` 即可。

---

## 16. server-only 标记 / env（API_HOST / FURIN_PUBLIC_* / 构建期注入）

### 16.1 server-only ✅

```ts
// src/lib/db.server.ts
import "@teyik0/furin/server-only";
export const SERVER_SECRET_MARKER = "TOP_SECRET_VALUE_123";
```

- 只在 loader 中使用 → 构建成功，client bundle **grep 不到** `TOP_SECRET_VALUE_123`、`server-only` ✅
- 若被页面组件（浏览器可见代码）引用 → 构建应失败（文档行为；spike 未单独做失败注入，标记 ⚠️ 文档依据）。

### 16.2 env ✅

| 用途 | 写法 | 实测 |
|---|---|---|
| 浏览器可见 | `process.env.FURIN_PUBLIC_*`（**不是 `import.meta.env.*`**） | `FURIN_PUBLIC_LABEL=hello-public bunx furin build` → client 产物里出现 `hello-public` ✅ |
| 服务端私有 | `process.env.API_HOST` | 生产 server bundle 保留 `process.env.API_HOST` 运行时读取；client 无泄漏（`secret-host` 不在 client）✅ |
| `import.meta.env.X` | ❌ 不被替换 | 产物里原样保留 `import.meta.env.FURIN_PUBLIC_LABEL`，浏览器会 undefined ⚠️ |

构建期注入（现有 `BUILD_ID` 虚拟模块 + `UMAMI` 常量）的迁移做法：

1. 把构建期常量改成 `FURIN_PUBLIC_*`：`FURIN_PUBLIC_BUILD_ID=$BUILD_ID bunx furin build` → 页面/组件里 `process.env.FURIN_PUBLIC_BUILD_ID`（客户端可见）。
2. SSR 才能用的常量（如服务端埋点 token）：`process.env.X` 运行时注入即可（Docker env）。
3. 若需要「同一份代码 SSR 用运行时值、浏览器用构建期值」：用 `createIsomorphicFn()` 分别读。

---

## 17. 搜索参数：config.query 与 zod（Standard Schema）

✅ `config.query` 接受 **TypeBox 或 Standard Schema（zod 4 实测）**。

```tsx
// zod（现有 validateSearch(zod) 可直接搬）
export const route = defineRoute("/search-zod")
  .config({ mode: "ssr", query: z.object({
    q: z.string().default("hello"),
    page: z.coerce.number().int().min(1).default(1),
  }) })
  .loader(({ query }) => ({ echo: query }))
```

```text
$ curl -s 'http://127.0.0.1:3311/search-zod?q=x&page=3' | grep -o 'zod-query">[^<]*'
{"q":"x","page":3}
$ curl -s 'http://127.0.0.1:3311/search-zod' | grep -o 'zod-query">[^<]*'
{"q":"hello","page":1}
```

- 导航输入类型（`search`）用 schema 的 **input** 类型：zod `.default()` 字段在输入侧可省略；TypeBox 不记录 default，必须 `t.Optional(t.Numeric({default:1}))`，此时输出类型仍是 `number | undefined`（spike 里 `query.page + 1` 就报了 TS18048）⚠️。
- 默认值省略：导航时等于默认值的字段**不会写进 URL**（`stripSearchDefaults` 用 deepEqual）。`setSearch({page:1})` → `/products`。
- 序列化（源码 `src/shared/search-params.ts`）：
  - 数组 → 重复 key：`tags=a&tags=b`（实测 `/search?tags=a&tags=b` → `["a","b"]` ✅）
  - 对象 → `JSON.stringify` 单值
  - `null/undefined` → 丢弃
- 非法 query → **422**（不是 404/400）：

```text
$ curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3311/search?page=0'
422   # body: {"type":"about:blank","detail":"Invalid query","errors":[...]}
```

⚠️ 与 `validateSearch` 的差异：TanStack 的搜索参数解析失败是「route 内 ValueError → errorComponent」，furin 是 **HTTP 422 + 无页面**；而且 `useSearch()` 返回的 route 参数必须是「当前激活路由的 pattern」，写错会 throw。

---

## 18. SPA 导航时数据获取（loader 重跑 / ?_furin=data / 预取）

✅ 机制（源码验证 + 端点实测）：

- SPA 导航 `fetch` 目标页 URL + `?_furin=data`，服务端返回 **NDJSON RouteFrame**（含 loader 数据、`__furinHead`、`__furinMatches`；defer 字段在 `deferredKeys` 里）：

```text
$ curl -s -D - 'http://127.0.0.1:3311/blog/hello?_furin=data'
HTTP/1.1 200 OK
Content-Type: application/x-ndjson
Cache-Control: private, no-store

["__furin_json_v1__",{"blogNav":["hello","second"],"post":{...},"params":{"slug":"hello"},
"path":"/blog/hello","query":{},"__furinMatches":[...],"__furinHead":{...}}]
```

- loader **每次导航都会重跑**（除非命中 prefetch 且未过期：默认 `preloadStaleTime=30s`，LRU 容量 50）。`router.refresh()` 会强制重跑。
- 预取：`<Link preload="intent|viewport|render">`、`router.prefetch()`；重复请求共享 in-flight。
- 失效：服务端响应带 `X-Furin-Revalidate` 时，浏览器 fetch 拦截器自动 evict + 刷新当前页（`furinInvalidate()`/sync 才有）。
- 取消：导航中断有 AbortController（`src/client/router/abort.ts`）。

---

## 19. 流式 SSR（defer）与 React 19

✅ 已实测：SSR 先返回 shell（含 `loading analytics…` fallback，`Transfer-Encoding: chunked`），随后 chunk 内补上真实内容（`visits=<!-- -->42`）。`<Await>` 内部用 React `use()`，所以必须在 `<Suspense>` 内；`useAsyncError()` 做局部错误 UI；`useAsyncValue<T>()` 读最近的值。

⚠️ 限制：
- defer 仅 SSR；SSG/ISR 里返回 deferred value 会 fail fast。
- `head()` 拿不到 defer 字段（标题必须同步）。
- 流式失败若已 flush headers，HTTP 状态码无法再改（文档明确）。

---

## 20. alpha 限制与风险

文档明确（`.furin-research/llms-full.txt`）：

- ❌ 只支持 Bun（无 Node/Deno）；Bun ≥ 1.4。
- ❌ SSR 页面不能声明 `requestLoader()`（编译期报错，已实测）。
- ❌ 静态导出拒绝 SSR/ISR 与 `requestLoader()`。
- ❌ `config()` 没有 `layout` 选项（脚手架模板过时，见 `1.2）。
- ❌ 没有 pending / Transition 机制（对比 `pendingComponent`）。
- ❌ 没有 beforeLoad / validateSearch / server function / middleware —— 用 loader + throw redirect + config.query + Elysia 插件替代。
- ⚠️ 路由组不提供访问控制；SSG/ISR 缓存页可能绕过 Elysia 守卫。
- ⚠️ 生产 Cache-Control / Cache-Tag 由框架按 mode 决定，不能自由覆盖。
- ⚠️ 无 CSRF 内建（cookie 鉴权的写接口要自己加 Elysia 兼容 CSRF 插件）。
- ⚠️ `furin-env.d.ts` 是单项目级声明；`RouteMap` 只包含根挂载实例的 pattern（多实例场景 `<Link>` 不类型化子应用 URL）。
- ⚠️ 生态处于 beta 期：Elysia 2 beta.32、eden 2 beta.5、依赖（`@elysia/static`、`evlog`、`seroval`、`yuku-parser`）都较新。
- 版本/仓库动态（2026-10-30 查询 GitHub API）：`Teyik0/furin` 近 30 条里绝大多数是 dependabot PR；有 `refactor(core)!: apply the core architecture and security audit` 这类 breaking 级合并 → **alpha 阶段 API 仍可能变**。
- Windows/大小写/路径坑（实测）：
  - dev 下资源 preload 输出绝对路径（`D:\...`）⚠️
  - 新增模块要重启 dev ⚠️
  - 跨平台编译未验证（Windows 上只产出 `.exe`）


---

## 21. 7 个架构问题（给 Lead 的确定性回答）

### Q1 createIsomorphicFn 的 `.server` 分支能否拿请求上下文？

**不能（无参数、无隐式 ctx）**。实测 loader 内 `getRequestContext()` → undefined。两条方案（都实测）：

```ts
// 方案 A（推荐，显式传参）
export const getApi = createIsomorphicFn()
  .server((cookie?: string | null) => treaty(apiApp, { fetch: { headers: cookie ? { cookie } : {} } }))
  .client(() => treaty<ApiApp>(window.location.origin));

// loader: getApi(request.headers.get("cookie"))
```

```ts
// 方案 B（Elysia onRequest + ALS，必须挂 globalThis 单例）
import { AsyncLocalStorage } from "node:async_hooks";
const KEY = Symbol.for("galzy.request-context.v1");
const g = globalThis as typeof globalThis & { [KEY]?: AsyncLocalStorage<Ctx> };
export const als: AsyncLocalStorage<Ctx> = (g[KEY] ??= new AsyncLocalStorage<Ctx>());

// server.ts
new Elysia().onRequest(({ request }) => {
  als.enterWith({ url: request.url, cookie: request.headers.get("cookie"), headers: request.headers });
}).use(await furin({ pagesDir: "./src/pages" }))

// loader
const ctx = als.getStore();  // ✅ 实测拿到 url + cookie
```

- 剥离保证：生产 client bundle grep 不到 `Elysia` / `async_hooks` / `treaty` / `requestContextStorage` / server secret → **不只是 stub，是整体移除** ✅。
- 并发隔离：ALS 是 per-request async context；API 路由里 `await Bun.sleep(50)` 后仍取到正确值 ✅。⚠️ 前提是模块单例挂 globalThis（否则 dev 双模块图会拿到两个 ALS 实例，表现为偶发 undefined）。

### Q2 导航中状态 / pending

- `useRouter().isNavigating` ✅ 存在（导航控制器 `#setNavigating` 驱动），`refresh()` 也有。
- ❌ 没有 pendingComponent：导航是「取 `?_furin=data` → 成功后才 commit」，**旧页面在数据就绪前保持原样**（白屏/骨架屏都不会出现）。慢 loader = 点了没反应，只有 `isNavigating` 能给出反馈。
- 复刻骨架屏的可行做法：
  1. root layout 下挂一个订阅 `useRouter().isNavigating` 的顶栏进度条（最简单，推荐）；
  2. 页面内部把慢数据放 `defer()` + `<Suspense fallback={Skeleton}>`（真正流式骨架，已验证）；
  3. 自建 store：`useNavigate` 前后置 `isPending`（粒度粗，不如 1+2）。
- ⚠️ root layout 里 `useRouter()` 能否拿到真实 provider 未实测（root 在 RouterProvider 之外的可能）；稳妥做法是放在 root layout 的子组件里再读。

### Q3 loader 能否设置响应头 / 状态码

- 自定义头：✅ `set.headers["x-spike-loader"]="dashboard"` 出现在生产响应里。
- `Cache-Control`：❌ 被框架覆盖。SSR 页面固定 `no-store, no-cache, must-revalidate`；SSG 页面固定 `public, max-age=0, must-revalidate, s-maxage=31536000` + `cache-tag: /about`。
- 状态码：页面 route 只处理 GET；`set.status` 未实测（不建议依赖）。需要自定义状态/头 → 走 Elysia API 路由。
- 现有 `headers(): { "Cache-Control": ..., "Cache-Tag": ... }` 的迁移：**不能 1:1**。用 `config({ mode: "isr", revalidate: N, tags: [...] })` 表达缓存意图，让框架生成 `s-maxage`/`cache-tag`；真正的边缘缓存交给 CDN 规则。

### Q4 守卫推荐做法

- 受保护目录的 `_route.tsx` loader 里读 cookie/session → `throw redirect(url, 302)`（等价 beforeLoad）✅ 实测 302 + query 保留。
- SPA 导航：控制器有 `#followRedirects`，会把 302 当导航继续（源码验证；浏览器未实测）。
- 复杂鉴权（角色/资源级）放在 **loader 内 + API 内双重判断**，不要只依赖布局守卫（缓存页/根 catch-all 会绕过）。
- 现有 4 个 beforeLoad：3 个简单登录判定可直接搬；有 `?redirect=` 的那种用 `encodeURIComponent(location.href)` 拼。

### Q5 SPA 导航可观测性

- 有：`useRouter()` → `currentHref`（pathname+search）、`currentPattern`、`search`、`isNavigating`、`refresh`。
- 无：`useMatches` / 路由树 / location 对象。
- 自建：`currentHref` 已经够用（`new URL(href, origin)` 拆 pathname/search/hash）；**不要**自己监听 popstate + 劫持 history（会与 `#commitPop`/`saveScrollPosition` 打架）。需要「离开确认」之类的钩子没有内建能力（无 blocker API）。

### Q6 useSearch 与 zod

见 `17：✅ zod 4 通过；输入/输出类型分离；默认值省略；数组=重复 key，对象=JSON。⚠️ TypeBox 的 default 不进静态类型 → 必写 `t.Optional`。

### Q7 构建产物与部署

见 `13：`bun` 目标 = server.js + client/ + public/（3.2MB，启动 322ms）；`--compile embed` = 122MB 单文件（实测可独立跑）；Docker 用 chainguard glibc-dynamic + 单文件；HEALTHCHECK 用 `server --healthcheck`（已实现验证）；预压缩 `.gz/.br` 建议放弃；跨平台编译未验证。dev 在 Windows 正常（`12）。

---

## 22. TanStack Start → furin 概念对照表

| 现有（TanStack Start/Router） | furin 对应物 | 1:1？ | 迁移做法 |
|---|---|---|---|
| `createFileRoute("/x")` | `defineRoute("/x")` | ✅ | id 规则不同：文件 id 带方括号/括号，见 `1 |
| `__root.tsx` + `shellComponent` | `pages/root.tsx` + `defineRootRoute()` | ⚠️ | `HeadContent`/`Scripts` 位置固定，见 `2 |
| `_layout.tsx` / pathless layout | 目录 `_route.tsx` / `(group)/_route.tsx` | ✅ | 布局只由目录决定 |
| `beforeLoad` | layout/page loader + `throw redirect()` | ⚠️ | 无 context 合并；见 `6 |
| `loader({ params, deps })` | `.loader({ params, query, request, cookie, ... })` | ⚠️ | 无 `loaderDeps`：用 `config.query` 替代；祖先数据是 Promise |
| `loaderDeps` | `config.query` + loader 内读 query | ✅ | 搜索参数变化 → 导航 → loader 重跑 |
| `validateSearch` | `config.query`（TypeBox/zod） | ✅ | 非 zod 也可；失败=422，见 `17 |
| `pendingComponent` | ❌ | ❌ | `isNavigating` 顶栏 + `defer/Suspense`，见 Q2 |
| `errorComponent` | 最近 `error.tsx`（`{error,reset}`） | ⚠️ | 错误信息被归一化（message 不透明） |
| `notFoundComponent` | 最近 `not-found.tsx` + `notFound()` | ✅ | 同 |
| `head({ loaderData })` | `.head({ ...同步字段 })` | ✅ | 仅同步字段；defer 不可用 |
| `<Link to params search hash>` | 同 | ✅ | ⚠️ `to` 必须 pattern（`:slug`/`*`） |
| `activeProps`/`inactiveProps` | 同 + `data-status="active"` | ✅ | |
| `useNavigate/useRouter/useSearch` | 同名（`@teyik0/furin/link`、`/search`） | ⚠️ | 无 `useParams/useLocation/useMatches` |
| `createServerFn`（BFF） | Elysia 插件路由（同进程）或 loader 内直调 | ❌ | **最大结构变化**：没有 RPC 函数层，改成 `/api/*` Elysia 路由 + 服务端直调 |
| `serverFunctions` + `useServerFn` | `treaty<ApiApp>` 或手写 fetch | ⚠️ | 见 `8 |
| TanStack Query Provider（`integrations`） | 同，放 root layout | ✅ | 见 `9 |
| `dehydrate/hydrate` | 无内建 | ⚠️ | loader 数据代替；Query 预填需自建（未验证） |
| Vite 插件链（React Compiler/Nitro/Tailwind/压缩） | Bun 插件（bun-plugin-tailwind / strip-plugin）+ `furin.config.ts` | ❌ | 全部重写；React Compiler 内建 ✅ |
| `routeTree.gen.ts` | `furin-env.d.ts` | ✅ | 自动生成，勿手改 |
| `createStartHandler` / Nitro | `new Elysia().use(await furin())` | ❌ | 运行入口改写，见 `13 |
| `getRequestHeader('Cookie')` / `cookiePass()` | loader ctx 的 `request.headers`/`cookie` | ✅ | |
| `getRequest()` | loader ctx `request` | ✅ | |
| `redirect({to,search})` | `throw redirect(url, 302)`（elysia 导出） | ⚠️ | 需手拼 search |
| `headers()` 路由头 | ❌ 不可写 Cache-Control/Cache-Tag | ❌ | 用 mode+tags，见 Q3 |
| `private/` 资源 | `public/`（URL=`/public/*`） | ⚠️ | 路径要改 |
| `?url` 资源导入 | ❌ | ❌ | 改普通 import 或 public/ |
| `.test.tsx` + vitest | 同（要装 vite、加 alias） | ✅ | 页面组件要抽出，见 `15 |

---

## 23. 目标架构建议（Galzy）

### 23.1 目录结构

```text
apps/web-furin/                       # 新前端（与 apps/web-tanstack 并存，灰度切换）
├── public/                           # favicon.ico 特判根；其余 /public/*
├── src/
│   ├── server.ts                     # new Elysia().onRequest(ALS).use(await furin()).use(apiApp)
│   ├── api/                          # BFF（Elysia 2），薄 BFF，不写业务
│   │   ├── app.ts                    # export const apiApp（禁止 import furin 的 server）
│   │   ├── games.ts  search.ts  auth.ts  comments.ts ...
│   │   └── shared/ (cors.ts, error.ts, session.ts)
│   ├── lib/
│   │   ├── backend.ts                # server-only：调 apps/api（cookie 透传/超时/错误映射）
│   │   ├── session.ts                # cookie → better-auth session（带缓存）
│   │   ├── request-context.ts        # globalThis ALS 单例
│   │   └── api-client.ts             # createIsomorphicFn().server(treaty(apiApp)).client(treaty<ApiApp>)
│   ├── components/                   # 原 shadcn/base-ui 组件（只依赖 React，可平移）
│   ├── stores/                       # TanStack Store（原样）
│   └── pages/
│       ├── root.tsx                  # HeadContent/Scripts/主题脚本/Providers
│       ├── error.tsx  not-found.tsx
│       ├── index.tsx                 # 首页
│       ├── (auth)/_route.tsx         # 登录态守卫
│       ├── games/_route.tsx          # 列表/详情共享布局 + 站点导航
│       ├── games/index.tsx  games/[id].tsx
│       ├── search.tsx                # query zod
│       ├── admin/_route.tsx          # isAdmin 守卫
│       └── ...
└── furin.config.ts / bunfig.toml / vitest.config.ts
```

### 23.2 页面 / 布局 / loader 分工

- **root.tsx**：只放 HTML 壳 + Providers + 主题脚本；不放业务 loader。
- **布局 loader**：站点级公共数据（导航分类、当前用户、站点配置）——每请求一次，子页面直接拿。
- **页面 loader**：页面主数据；`head()` 需要的字段必须同步返回；慢的次要数据用 `defer`。
- **不要再造 server function**：浏览器写数据 → 走 `/api/*` Elysia 路由；SSR 读数据 → loader 直调 `backend.ts`（服务端直连 3001）。

### 23.3 BFF 分层

```text
浏览器 ──► furin server (Elysia 2)
             ├─ 页面 SSR：loader → lib/backend.ts ──► apps/api (3001)  [cookie 透传]
             └─ /api/*  ：BFF 路由 → lib/backend.ts ──► apps/api          [cookie 透传]
```

- BFF 只做：入参校验（TypeBox）、cookie 转发、错误映射（problem → Response）、限流/缓存标记。
- 不要在 BFF 里复刻业务（现有 22 个 server-fn 模块 146 个 createServerFn 大多可退化成「loader 直调 + 少量 POST 路由」）。

### 23.4 鉴权

- `(auth)/_route.tsx`：session 判定 + redirect（保留 `?redirect=`）。
- `admin/_route.tsx`：session.role === "admin" 判定，403 用 `throw new Response("Forbidden",{status:403})`。
- 每个敏感 loader 内再断言一次（缓存/直连风险）。
- 写操作：Elysia API 内用 better-auth session 校验 + CSRF token（自建或 @elysia/csrf 兼容版）。

### 23.5 错误边界

```text
pages/error.tsx           # 全站兜底（含 digest 上报）
pages/games/error.tsx     # 列表/详情的局部重试
pages/admin/error.tsx
pages/not-found.tsx + 各域 not-found.tsx
```

现有 `elysiaErrorF` 的 401→跳登录要在 BFF 层改成 `throw redirect(...)`（loader 内）或返回 problem（API 内）。

### 23.6 head

- 每页 `.head()` 输出 title/description/og/canonical/JSON-LD；站点常量（og:site_name 等）放在 root 的固定 `<head>` 里（注意 furin 不 dedupe，别重复）。
- SPA 导航自动更新（源码级验证）。

### 23.7 构建部署

- `bunx furin build --target bun --compile embed` → 单文件 `server` → chainguard glibc-dynamic。
- 保留现有 CI：GHCR + webhook；只替换 Dockerfile build 步骤。
- 健康检查：`/health`（Elysia 路由）+ `server --healthcheck`。
- 观测：生产 server 日志已带 requestId/JSON（evlog）；UMAMI 改 `FURIN_PUBLIC_UMAMI_*` 构建期注入。

---

## 24. 必须由 Lead 拍板的 10 个决策点

1. **是否迁移到 furin，还是留在 TanStack Start**（alpha + Elysia 2 beta；迁移是重写路由层，不是换壳）。
2. **BFF 归属**：新建 `apps/web-furin` 独立应用，还是原地改造（建议独立，可灰度、可回滚）。
3. **apps/api 是否升级 Elysia 2**（不升 → 只能手写 fetch 客户端；升级 → 50 个路由文件参数顺序 + 错误模型全改）。
4. **类型契约方案**：手写 `packages/contracts`（推荐）还是维持 Eden v1（不可行）还是等 Elysia 2。
5. **鉴权边界**：只用页面守卫（简单但缓存页可能绕过）还是 loader+API 双检（推荐）。
6. **缓存策略**：接受框架自带 SSR no-store / ISR s-maxage，还是必须保留现有 `Cache-Tag` 语义（则需 CDN 规则改造）。
7. **pending UX**：顶栏进度条（`isNavigating`）还是页面内 defer+Suspense 骨架（推荐组合）。
8. **Docker 形态**：单文件 embed（122MB 镜像层，简单）还是 server.js+client（小但需拷贝目录）。
9. **静态资源路径**：接受 `/public/*` 新 URL（要改所有硬编码 `/images/...`），还是加 Elysia 兼容路由。
10. **测试策略**：接受「页面不可 render、只测抽出的组件/lib」还是要求 E2E（playwright）补齐。

---

## 25. 风险与备选方案

| 风险 | 概率/影响 | 备选 |
|---|---|---|
| furin alpha 破坏性变更 | 中/高 | 锁死 0.8.0-alpha.0 + 锁 bun/elysia 版本；关注仓库 breaking PR |
| Elysia 2 beta 行为变化 | 中/高 | BFF 与页面解耦（BFF 只依赖 fetch），必要时替换 BFF 框架 |
| 无浏览器回归能力（本环境） | 高/中 | 迁移前先补 playwright/E2E 基线；本报告 SPA 结论标为源码级 |
| 迁移期双前端并存成本 | 中/中 | 按域灰度（先只读页），Nginx/Dokploy 路由切流 |
| 缓存语义丢失 | 中/中 | 用 ISR + CDN 规则重写；关键接口走 API 直连 |
| 依赖 beta 生态（evlog/seroval/yuku） | 低/中 | 不引入额外插件，保持最小依赖面 |
| Windows 开发体验（新模块重启、路径输出） | 高/低 | dev 容器化（bun docker）或接受重启 |

---

## 26. 迁移路线图（建议）

1. **P0 可行性**（本周）：用 spike 方式把「首页/游戏列表/游戏详情/搜索」各一页 + 登录守卫 + BFF 读接口跑通，量一下真实页面迁移工时。
2. **P1 基建**：`apps/web-furin` 骨架、`packages/contracts`、`lib/backend.ts`、root/error/not-found、Query Provider、CI/Dockerfile。
3. **P2 只读域**：games/tags/producer/search 的 8~10 页（loader + head + query），补 vitest（组件/lib）。
4. **P3 交互域**：comments/topics/collections（`/api/*` 写路由 + CSRF + invalidate）。
5. **P4 管理端**：admin 组 + Better Auth 管理页。
6. **P5 切流/回滚**：双前端并存，按路径灰度；保留 TanStack 版本一个季度。

---

## 27. 附录

### 27.1 spike 索引（`.furin-research/spike`）

| 文件 | 证明什么 |
|---|---|
| `src/server.ts` | Elysia+furin 组合、ALS、`--healthcheck` |
| `src/api/app.ts`+`todos.ts`+`als.ts` | Elysia 2 路由/校验/cookie/CORS、无 furin 循环依赖 |
| `src/pages/index.tsx` | SSR loader、head、Link 各种 to、public env |
| `src/pages/blog/*` | 嵌套布局、layout 数据、params、notFound、error、404 边界 |
| `src/pages/docs/[...path].tsx` | catch-all（`to="/docs/*"`） |
| `src/pages/dashboard/*` | cookie 守卫 redirect、defer+Suspense、TanStack Query、loader set.headers |
| `src/pages/search.tsx` / `search-zod.tsx` | TypeBox & zod query、数组序列化、默认值省略 |
| `src/pages/head-demo.tsx` | meta/links/JSON-LD/scripts/styles |
| `src/pages/assets.tsx` | public 资源、普通资源 import、`?url` 失败现场 |
| `src/lib/request-context.ts` | globalThis ALS 单例 |
| `src/lib/api.ts` | createIsomorphicFn 双向客户端 |
| `tests/components.test.tsx` | vitest jsdom + alias |
| `experiments/eden-v1-consume-elysia1-app.incompatible.ts` | eden1 × Elysia2 类型不兼容证据 |

### 27.2 复现命令

```bash
cd .furin-research/spike
bun install
bunx furin typegen
bunx tsc --noEmit
PORT=3311 bun --hot src/server.ts          # dev
curl -s http://127.0.0.1:3311/ | head -c 400
curl -s -o /dev/null -D - http://127.0.0.1:3311/dashboard   # 302 → /login?redirect=%2Fdashboard
curl -s -H 'cookie: session=alice' http://127.0.0.1:3311/dashboard | grep -o 'visits=<!-- -->[0-9]*'
FURIN_PUBLIC_LABEL=hello-public bunx furin build --target bun
PORT=3312 bun .furin/build/bun/server.js
bunx furin build --target bun --compile embed && PORT=3313 ./.furin/build/bun/server.exe
bunx vitest run
```

### 27.3 未验证清单（诚实边界）

- 浏览器端：SPA 导航不刷新文档、head 实际 DOM 更新、`isNavigating` 时序、prefetch 命中、滚动/hash 恢复、treaty 浏览器真实请求（本环境 bsk 浏览器 daemon 拒绝访问）。
- layout loader 失败落到父 `error.tsx` 的失败注入。
- `--compile server`（assets on disk）产物运行。
- Linux 交叉编译 / Docker 实跑。
- `@elysia/cors@2.0.0-beta.2`、CSRF 插件、`isFurinPageRequest` 守卫。
- `requestLoader` 的 SSG/ISR 运行时行为（只做了 SSR 拒绝的类型验证）。
- TanStack Query dehydrate 预填方案。
