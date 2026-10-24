Welcome to your new TanStack Start app! 

# Getting Started

To run this application:

```bash
bun install
bun --bun run dev
```

# Building For Production

To build this application for production:

```bash
bun --bun run build
```

# React 运行时（@tanstack/redact）

本应用不跑真实 React：[`@tanstack/redact`](https://github.com/TanStack/redact) 提供 React 19 API 兼容的同步运行时，没有并发调度器。源码不变，仍然 `import` `react` / `react-dom`。

**接入方式**：`vite.config.ts` 里的 `redact()` 插件，排在 `tanstackStart()` 与 `react()` 之后。它通过 Vite `resolve.alias` 把 `react`、`react-dom`、`jsx-runtime`、`compiler-runtime`、`scheduler`、`use-sync-external-store` 指向 redact 实现。

**特性开关**：不用 `full` 预设，而是 `preset: "nano"` 后只开本应用实际用到的 8 项——`hydration`、`suspense`、`context`、`portal`、`memo`、`lazy`、`forwardRef`、`classComponents`；`activity`、`fragmentRefs`、`viewTransitions` 关闭（全仓库与依赖均无使用，页面过渡走原生 `document.startViewTransition`）。逐项依据见根目录 [AGENTS.md](../../AGENTS.md) 的「React 运行时注意事项（Redact）」一节。

关掉的特性**不会报错，只会静默降级**（portal 变原地渲染、Suspense 无 fallback UI、lazy 异步解析直接抛错）。新增依赖或新写法引入表外能力时，必须同步开启对应 flag 并重跑测试 + 浏览器冒烟。

**两条硬约束**：

- 构建期 `ssr.noExternal` 必须是 `[/.*/]`（全量内联）。被 externalize 的依赖由 Node 原生解析，会拿到 `node_modules` 里的真实 react，SSR 首屏直接抛 `ReactSharedInternals.H is null`。
- 测试同理：`vitest.config.ts` 把依赖 inline，让 Vitest 跑在 redact 而非真实 react 上。

**本地验证**：

```bash
cd apps/web-tanstack
bun run build
bun run preview   # http://localhost:4173
```

首屏正常渲染、控制台无 `ReactSharedInternals` / dispatcher 相关报错即为通过。

**已知差异**：`useTransition` / `startTransition` 同步执行且 `pending` 恒为 `false`；`useDeferredValue` 返回入参；`useActionState` / `useOptimistic` / `useFormStatus` 是空实现；无 React DevTools 支持；RSC / Flight 仍走上游 React。完整清单见上游 [compatibility.md](https://github.com/TanStack/redact/blob/main/docs/compatibility.md)。

**升级注意**：`@tanstack/redact` 的 peer 依赖要求 `vite >= 5`（当前 `vite ^8.3.5` 满足，锁定 `^0.1.4`）。升级后重跑上面的 build + preview。

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
bun --bun run test
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Uninstall the packages: `bun install @tailwindcss/vite tailwindcss -D`

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting. The following scripts are available:


```bash
bun --bun run lint
bun --bun run format
bun --bun run check
```


## Setting up Better Auth

1. Generate and set the `BETTER_AUTH_SECRET` environment variable in your `.env.local`:

   ```bash
   bunx --bun @better-auth/cli secret
   ```

2. Visit the [Better Auth documentation](https://www.better-auth.com) to unlock the full potential of authentication in your app.

### Adding a Database (Optional)

Better Auth can work in stateless mode, but to persist user data, add a database:

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  // ... rest of config
});
```

Then run migrations:

```bash
bunx --bun @better-auth/cli migrate
```



## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
