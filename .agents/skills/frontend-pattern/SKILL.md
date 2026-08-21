---
name: frontend-pattern
description: 项目前端组件架构、路由模式、Server Function 约定、Eden Treaty 客户端、Store/Hook/Form 用法、样式体系。应用于 apps/web-tanstack/src/ 下所有文件。
---

# 前端模式 — GalZY (Aqua)

本项目前端基于 **TanStack Start**（TanStack Router + TanStack Query + Vite），UI 使用 **shadcn/ui** (radix-nova 风格) + **Tailwind CSS v4**。每条规则均从实际代码库中提炼。

## 何时应用

- 在 `apps/web-tanstack/src/routes/` 下创建或修改路由
- 编写 Server Function（`createServerFn`）
- 调用后端 API（Eden Treaty）
- 创建或修改组件（`components/`）
- 管理状态（TanStack React Store）
- 编写表单（TanStack Form）
- 处理认证（Better Auth）

## 目录结构

```
src/
├── router.tsx                    # Router 配置
├── routeTree.gen.ts              # 自动生成
├── routes/                       # 文件路由 (TanStack Router)
│   ├── __root.tsx                # 根路由 (layout, providers)
│   ├── index.tsx                 # 首页
│   ├── auth/
│   │   └── login.tsx             # 登录页
│   ├── api/                      # API 端点
│   └── .../                      # 其他功能路由
├── components/                   # UI 组件
│   ├── ui/                       # shadcn/ui 组件 (Button, Card, Input, 等)
│   ├── auth/                     # 认证相关组件
│   ├── home/                     # 首页组件
│   ├── user/                     # 用户相关组件
│   └── .../                      # 其他功能组件
├── server/                       # Server Functions (按功能分目录)
│   ├── auth/
│   │   ├── auth-client.ts        # Browser Auth Client
│   │   ├── auth.server.ts        # Server Auth Client
│   │   ├── auth.functions.ts     # Server Functions
│   │   └── betterPlugins.ts      # 插件配置
│   ├── game/index.ts             # 游戏相关 Server Functions
│   ├── comments/index.ts         # 评论相关 Server Functions
│   └── .../
├── hooks/                        # 自定义 React Hooks
├── stores/                       # TanStack React Store
├── lib/                          # 工具函数
│   ├── utils.ts                  # cn() 工具
│   ├── elysia-error.ts           # Eden 错误处理
│   ├── cookie-pass.ts            # SSR Cookie 传递
│   └── ...
└── config/                       # 应用配置
```

## 1. 路由模式 (TanStack Router 文件路由)

每个路由文件导出 `Route` 常量，使用 `createFileRoute`。

**参考**: `apps/web-tanstack/src/routes/index.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: App,

  loader: async ({ context }) => {
    const [data1, data2] = await Promise.all([
      getGameList(),
      getCritical(),
    ])
    return { data1, data2 }
  },

  pendingComponent: () => <Skeleton />,
  staleTime: 60_000,
  gcTime: 5 * 60_000,
})

function App() {
  return <h1>Home</h1>
}
```

### 带 Search 参数校验

**参考**: `apps/web-tanstack/src/routes/auth/login.tsx`

```typescript
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

const ReturnToSchema = z.object({
  return_to: z.string().optional(),
})

export const Route = createFileRoute('/auth/login')({
  component: RouteComponent,
  validateSearch: ReturnToSchema,
  loaderDeps: ({ search: { return_to } }) => ({ return_to }),
  loader: async ({ deps: { return_to } }) => {
    const session = await getSession()
    if (session) throw redirect({ to: return_to || '/' })
  },
})
```

### 根路由 (__root.tsx)

**参考**: `apps/web-tanstack/src/routes/__root.tsx`

```typescript
import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export type MyRouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'GalZY - Galgame 资源站' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => <Errors code="404" errormessage="页面不存在" />,
  errorComponent: ({ error }) => <Errors code={status} errormessage={error.message} />,
})
```

## 2. Server Function 模式

使用 `createServerFn` + Zod 校验。

**参考**: `apps/web-tanstack/src/server/game/index.ts`, `apps/web-tanstack/src/server/auth/auth.functions.ts`

```typescript
import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import z from 'zod'

// GET — 无参数
export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { data: session } = await authServerClient.getSession()
  return session
})

// GET — 带参数校验
export const getGameDetail = createServerFn()
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { data: result, error } = await api.games.get({ query: { id: data.id } })
    elysiaErrorF(error)
    return result
  })

// 带默认值的可选参数
export const getGameList = createServerFn()
  .validator(
    z.object({ pageSize: z.number(), pageIndex: z.number() }).partial().default({}),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await api.games.gamelist.get({
      query: { pageIndex: data.pageIndex || 0, pageSize: data.pageSize || 24 },
    })
    elysiaErrorF(error)
    return { gamelist: res }
  })
```

规则：
- 所有 Server Function 用 `createServerFn()` **无参数**或 `{ method: 'GET' }`
- 输入校验始终使用 `.validator(z.object({...}))`
- 默认值用 `.partial().default({})` 或 `||` 操作符
- handler 中 Eden 调用后立刻 `elysiaErrorF(error)`
- Server Function 按功能放在 `server/<feature>/index.ts`

## 3. Eden Treaty 客户端模式

类型安全地调用后端 API。

### 客户端初始化 (`packages/libs/src/api/index.ts`)

```typescript
import type { app } from '@api'
import { treaty } from '@elysiajs/eden'

const apiHost = process.env.API_HOST || 'http://localhost:3001'

export const api = treaty<app>(apiHost, {
  fetch: { credentials: 'include' },
})
```

### 使用模式

```typescript
import { api } from '@libs'

// GET 请求
const { data, error } = await api.games.get({ query: { id: '123' } })

// POST 请求 (带 cookie)
const { data, error } = await api.comments.post({ content: 'hi' }, cookiePass())

// 多级路径
const { data, error } = await api.games.gamelist.get({
  query: { pageIndex: 0, pageSize: 24 },
})
```

### 在 Server Function 中传递 Cookie

**参考**: `apps/web-tanstack/src/lib/cookie-pass.ts`

```typescript
import { getRequestHeader } from '@tanstack/react-start/server'

export const cookiePass = () => ({
  fetch: {
    headers: {
      cookie: getRequestHeader('Cookie') || '',
    },
  },
})
```

使用：`api.comments.post({...}, cookiePass())`

### 在 Server Function 中处理 Eden 错误

**参考**: `apps/web-tanstack/src/lib/elysia-error.ts`

```typescript
import { redirect } from '@tanstack/react-router'

export const elysiaErrorF = (error: any) => {
  if (error) {
    switch (error.status) {
      case 400:
      case 401:
        throw redirect({ to: '/auth/login' })
      case 403:
      case 429:
      case 500:
      case 502:
        throw { status: error.status, message: error.value }
      default:
        throw { status: error.status ?? 500, message: error.value ?? 'Unknown error' }
    }
  }
}
```

## 4. 组件模式

### 4.1 shadcn/ui 组件

所有 shadcn/ui 组件在 `src/components/ui/` 下。

**参考**: shadcn 技能 + `components.json`

```json
{
  "style": "radix-nova",
  "iconLibrary": "lucide",
  "aliases": {
    "ui": "@web/components/ui",
    "utils": "@web/lib/utils",
    "hooks": "@web/hooks"
  }
}
```

导入方式：
```typescript
import { Button } from '@web/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card'
import { Input } from '@web/components/ui/input'
import {
  Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldTitle,
} from '@web/components/ui/field'
import { InputGroup, InputGroupInput } from '@web/components/ui/input-group'
```

### 4.2 功能组件 (Feature Components)

功能组件按功能放在 `components/<feature>/` 下：
```
components/
├── auth/OauthButton.tsx       # OAuth 登录按钮
├── home/Count.tsx             # 条目计数
├── home/home-game-list.tsx    # 游戏列表
├── home/search/Search.tsx     # 搜索组件
├── user/UserMenu.tsx          # 用户菜单
```

大型组件可以拆分子目录：
```
components/home/
├── card.tsx
├── Count.tsx
├── game/
├── producer/
├── search/
└── tag/
```

### 4.3 组件内 Server Function 调用

```typescript
import { useSuspenseQuery } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'

const getTotalCount = createServerFn().handler(async () => {
  const { data, error } = await api.games.count.get()
  elysiaErrorF(error)
  return { totalCountResult: data }
})

const Count = () => {
  const { data } = useSuspenseQuery({
    queryKey: ['totalCount'],
    queryFn: () => getTotalCount({}),
  })
  return <>{data.totalCountResult}</>
}
```

## 5. Store 模式 (TanStack React Store)

**参考**: `apps/web-tanstack/src/stores/downCardData.ts`

```typescript
import { createStore } from '@tanstack/react-store'

type ModalState<T = any> = {
  open: boolean
  data: T | null
}

export const downCardStore = createStore<ModalState>({
  open: false,
  data: null,
})

export const downmodalActions = {
  open(data: any) {
    downCardStore.setState((s) => ({ ...s, open: true, data }))
  },
  setOpen(open: boolean) {
    downCardStore.setState((s) => ({ ...s, open, data: open ? s.data : null }))
  },
  close() {
    downCardStore.setState((s) => ({ ...s, open: false, data: null }))
  },
  updateData(partial: Partial<{ id: string; name?: string }>) {
    downCardStore.setState((s) => ({
      ...s,
      data: s.data ? { ...s.data, ...partial } : null,
    }))
  },
}
```

规则：
- Store 用 `createStore` from `@tanstack/react-store`
- 类型定义用 `type`（非 interface）
- 操作通过 actions 对象导出（非直接 setState）
- 状态更新用 `setState((s) => ({ ...s, ... }))`

## 6. Hook 模式

**参考**: `apps/web-tanstack/src/hooks/`

```typescript
// src/hooks/use-mobile.ts — 简单 hook
export function useMobile() { /* ... */ }

// src/hooks/use-pagination.ts — 带类型参数
type UsePaginationProps = {
  currentPage: number
  totalPages: number
  paginationItemsToDisplay: number
}

type UsePaginationReturn = {
  pages: number[]
  showLeftEllipsis: boolean
  showRightEllipsis: boolean
}

export function usePagination({
  currentPage,
  totalPages,
  paginationItemsToDisplay,
}: UsePaginationProps): UsePaginationReturn {
  // ...
  return { pages, showLeftEllipsis, showRightEllipsis }
}
```

规则：
- Hook 函数导出用 `export function useX()`，非 `export const useX = () =>`
- 参数和返回值都用 `type` 定义，放在文件顶部
- Hook 文件 `use-<name>.ts` 或 `use<Name>.tsx`（命名不统一，但功能清晰）

## 7. 表单模式 (TanStack Form)

**参考**: `apps/web-tanstack/src/routes/auth/login.tsx`

```typescript
import { useForm } from '@tanstack/react-form'
import { Button } from '@web/components/ui/button'
import { Input } from '@web/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldError } from '@web/components/ui/field'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱地址').email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
})

function LoginForm() {
  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onChange: loginSchema },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email({ email: value.email, password: value.password })
    },
  })

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void form.handleSubmit() }}
      className="flex flex-col gap-4"
    >
      <form.Field name="email">
        {(field) => (
          <Field orientation="vertical">
            <FieldLabel><FieldTitle>邮箱</FieldTitle></FieldLabel>
            <FieldContent>
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
              />
              <FieldDescription>请输入您的注册邮箱</FieldDescription>
              <FieldError errors={field.state.meta.errors} />
            </FieldContent>
          </Field>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '登录中...' : '登录'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
```

## 8. 认证模式 (Better Auth)

### 客户端 (Browser)

**文件**: `apps/web-tanstack/src/server/auth/auth-client.ts`

```typescript
import { createAuthClient } from 'better-auth/react'
import { betterPlugins } from './betterPlugins'

export const authClient = createAuthClient({
  plugins: betterPlugins,
})
```

### 服务端 (SSR)

**文件**: `apps/web-tanstack/src/server/auth/auth.server.ts`

```typescript
import { getRequestHeader } from '@tanstack/react-start/server'
import { createAuthClient } from 'better-auth/client'
import { betterPlugins } from './betterPlugins'

export const authServerClient = createAuthClient({
  plugins: betterPlugins,
  baseURL: BETTER_AUTH_URL,
  basePath: BETTER_AUTH_BASE_PATH,
  fetchOptions: {
    onRequest: async (context) => {
      const cookie = await getRequestHeader('Cookie')
      if (cookie) context.headers.set('Cookie', cookie)
    },
  },
})
```

### 插件统一配置

**文件**: `apps/web-tanstack/src/server/auth/betterPlugins.ts`

```typescript
import { adminClient } from 'better-auth/client/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

export const betterPlugins = [
  adminClient(),
  tanstackStartCookies(),
] as const satisfies BetterAuthPlugin[]
```

## 9. 图标模式

使用 `lucide-react`（项目 `components.json` 中 `iconLibrary: "lucide"`）。

```typescript
import { Gamepad2, Tags, Mail, LogIn, Eye, EyeOff, Loader2 } from 'lucide-react'
```

图标在 button 中使用时加 `data-icon` 属性（shadcn 新约定）：
```tsx
<Button>
  <SearchIcon data-icon="inline-start" />
  搜索
</Button>
```

## 10. 样式体系

### Tailwind CSS v4

**文件**: `apps/web-tanstack/src/styles.css`

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";
@import '@bprogress/core/css';

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: 'Geist Variable', sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... */
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-lg: var(--radius);
}
```

CSS 变量使用 OKLCH 色值。Geist Variable 字体。`@theme inline` 定义 Tailwind 主题令牌。

### 常用 CSS 类名

```tsx
// 布局
className="mx-auto w-full max-w-7xl"
className="flex flex-col min-h-screen"
className="flex items-center justify-between"
className="grid grid-cols-2 md:grid-cols-2 gap-2"

// 间距
className="gap-4"      // 使用 gap，不用 space-y-*
className="px-4 py-2"
className="my-4"

// 文字
className="text-4xl font-semibold text-center"
className="text-sm text-muted-foreground"

// 背景/边框
className="border-b bg-background"
className="border-t border-border"
className="rounded-full"
```

## 11. 工具函数

### `cn()` — 条件 class 合并

**文件**: `apps/web-tanstack/src/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 其他工具

- `formatLooseDate(raw?: string)` — 格式化 `YYYYMMDD` 字符串
- `getImageUrl({ imageId, width, height })` — VNDB 图片 URL 生成
- `getStrictContext<T>(name?)` — 类型安全 Context 工厂

## 12. 路径别名

**文件**: `apps/web-tanstack/tsconfig.json`

```json
{
  "paths": {
    "@web": ["./src/"],
    "@web/*": ["./src/*"],
    "@api/*": ["../api/src/*"],
    "@libs": ["../../packages/libs/src/index.ts"],
    "@libs/*": ["../../packages/libs/src/*"]
  }
}
```

| 别名 | 指向 | 使用场景 |
|------|------|----------|
| `@web/*` | `src/*` | 组件、路由、hook、lib |
| `@web/components/ui/button` | `src/components/ui/button.tsx` | UI 组件 |
| `@web/lib/utils` | `src/lib/utils.ts` | 工具函数 |
| `@web/hooks/use-mobile` | `src/hooks/use-mobile.ts` | Hooks |
| `@web/server/game` | `src/server/game/index.ts` | Server Functions |
| `@libs` | `packages/libs/src/index.ts` | Eden Treaty Client |
| `@api` | `apps/api/src/index.ts` | 类型 (type-only) |

## 反模式 (禁止)

```typescript
// ❌ Route 文件不导出 Route 常量
export default function Page() {}  // 禁止

// ❌ Server Function 不用 Zod 校验
createServerFn().handler(async ({ data }) => { ... })  // 禁止无 validator

// ❌ 直接 fetch API 而非使用 Eden
fetch('http://localhost:3001/games')  // 禁止 — 用 api.games.get()

// ❌ 忽略 Eden 错误
const { data } = await api.games.get({...})  // 禁止 — 必须 elysiaErrorF(error)

// ❌ 使用 space-y-* 而非 gap-*
<div className="space-y-4">  // 禁止 — 用 flex-col gap-4

// ❌ raw div 代替 shadcn 组件
<div className="border rounded p-4">  // 禁止 — 用 Card

// ❌ 直接在组件中 fetch（非 Server Function）
useEffect(() => { fetch('/api/...') }, [])  // 禁止 — 用 createServerFn
```
