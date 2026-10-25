import { BUILD_ID } from 'virtual:build-id'
import geistWoff2Url from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  ScriptOnce,
  Scripts,
  useMatches,
} from '@tanstack/react-router'
import { Image } from '@unpic/react'
import Errors from '@web/components/error'
import { TooltipProvider } from '@web/components/ui/tooltip'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import Footer from '../components/Footer'
import Header from '../components/Header'
import TanStackQueryProvider from '../integrations/tanstack-query/root-provider'
import appCss from '../styles.css?url'

// Dev-only 能力探针（WebView 真机调试）：延迟 3 秒自动跑一次，并挂载 window.__galzyProbe
// 供手动触发。`import.meta.env.DEV` 是静态条件，prod 构建时该分支连同动态 import 一起被
// tree-shake，探针模块不会进入产物。SSR 侧用 typeof window 排除。
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.setTimeout(() => {
    import('../lib/capability-probe')
      .then((probe) => {
        window.__galzyProbe = {
          run: probe.runCapabilityProbe,
          stop: probe.stopCapabilityProbe,
        }
        return probe.runCapabilityProbe()
      })
      .catch(() => {})
  }, 3000)
}

// Dev-only 开发者工具：`import.meta.env.DEV` 是构建期静态常量，生产构建会把这个
// 三元表达式折叠为 null，React.lazy 里的动态 import 连同三个 devtools 包一起被
// tree-shake（与上方 capability-probe 同一套路）。dev 下仍按原样渲染面板。
const Devtools = import.meta.env.DEV
  ? lazy(() => import('@web/components/devtools/devtools'))
  : null

export type MyRouterContext = {
  queryClient: QueryClient
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`
export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'description',
        content: 'Galgame 资源站, 这里收录了大部分电脑端与手机端的汉化 Galgame',
      },
      {
        property: 'og:site_name',
        content: 'GalZY',
      },
      {
        property: 'og:locale',
        content: 'zh_CN',
      },
      {
        name: 'twitter:card',
        content: 'summary',
      },
      {
        title: 'GalZY - Galgame 资源站',
      },
    ],
    links: [
      {
        // latin 子集可变字体 preload：省去 CSS @import 的额外 RTT，缓解 FOUT。
        // href 经 Vite 处理带 hash，不可硬编码 node_modules 相对路径。
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
        href: geistWoff2Url,
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
    scripts: [
      {
        src: process.env.UMAMI_SCRIPT_URL,
        defer: true,
        'data-website-id': process.env.UMAMI_DATA_WEBSITE_ID,
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          relatedLink: {
            '@type': 'WebPageElement',
            name: '广告',
            cssSelector: '#sidebar-ad',
            webPageElementType: 'Advertisement',
          },
        }),
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => {
    return <Errors code="404" errormessage={'页面不存在'} />
  },
  errorComponent: ({ error }) => {
    const status =
      typeof error === 'object' &&
      error &&
      'status' in error &&
      typeof (error as { status: unknown }).status === 'number'
        ? (error as { status: number }).status
        : 500
    // 路由升级后 error 为 unknown：安全地取 message，避免 stringify 出无意义内容
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '页面加载出错喵～'
    return <Errors code={status} errormessage={message} />
  },
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans" suppressHydrationWarning>
      <head>
        <ScriptOnce>{THEME_INIT_SCRIPT}</ScriptOnce>
        <ScriptOnce>{`window.__BUILD_ID__=${JSON.stringify(BUILD_ID)}`}</ScriptOnce>
        <ScriptOnce>{`(function(){var b=window.__BUILD_ID__;if(!b)return;var c=!1;document.addEventListener('visibilitychange',function(){if(document.visibilityState!=='visible'||c)return;c=!0;fetch('/_build').then(function(r){return r.ok?r.json():Promise.reject(r)}).then(function(d){if(d.buildId&&d.buildId!==b)window.location.reload()}).catch(function(){}).finally(function(){c=!1})});window.addEventListener('unhandledrejection',function(e){var r=e.reason;if(!r)return;var m=r.message||String(r);if(m.indexOf('Server function info not found')!==-1||m.indexOf('STALE_CLIENT')!==-1)window.location.reload()})})()`}</ScriptOnce>
        <HeadContent />
      </head>
      <body className="font-sans antialiased flex flex-col min-h-screen">
        <TanStackQueryProvider>
          {/* 后台路由使用独立的管理端布局（AdminShell），与用户端 Header/Footer/广告完全隔离 */}
          <TooltipProvider>
            <AppChrome>{children}</AppChrome>
          </TooltipProvider>
          <Toaster position="top-center" />
          {Devtools ? (
            <Suspense fallback={null}>
              <Devtools />
            </Suspense>
          ) : null}
        </TanStackQueryProvider>
        <Scripts />
      </body>
    </html>
  )
}

/**
 * 用户端 / 管理端双壳切换。
 * 依据当前匹配的路由树判断：`/admin/**`（pathless 布局 `_authL` 之下）走管理端独立布局，
 * 其余路由渲染用户端 Header / 广告 / Footer。用 useMatches（而非 useRouterState）
 * 只订阅 matches 部分，内置记忆化、SSR 首帧与 URL 一致（见文档推荐）。
 */
function AppChrome({ children }: { children: React.ReactNode }) {
  const matches = useMatches()
  const isAdmin = matches.some((m) => m.routeId.startsWith('/admin/'))

  if (isAdmin) {
    return <>{children}</>
  }

  return (
    <>
      {/* 背景层 */}
      <DeferredBackground />
      <Header />
      {/* 顶栏是 fixed（滚动后收缩成悬浮药丸），首屏在文档流里让出 56px 高度，
          否则广告位与页面标题会钻到透明顶栏底下。 */}
      <main className="mx-auto w-full max-w-7xl px-4 pt-14 sm:px-6">
        {/* 广告 */}
        <aside
          id="sidebar-ad"
          className="flex flex-col mx-auto lg:px-24 max-w-7xl px-4 py-0 opacity-70 relative mb-2"
        >
          <a
            data-umami-event="广告点击"
            data-umami-event-name="dzmm"
            data-umami-event-position="Banner-dzmm"
            target="_blank"
            rel="noopener noreferrer"
            href="https://umami.galzy.moe/q/KrhnTk4vg"
          >
            <div className="sm:hidden overflow-hidden rounded-lg">
              <Image
                width={1425}
                height={120}
                src="/dzmm.webp"
                alt="dzmm 广告图片"
                className="object-cover scale-[1.03]"
                loading="lazy"
                fetchPriority="low"
                decoding="async"
              />
            </div>
            <div className="hidden sm:block">
              <Image
                width={1425}
                height={113}
                src="/dzmm.webp"
                alt="dzmm 广告图片"
                className="object-cover rounded-lg"
                loading="lazy"
                fetchPriority="low"
                decoding="async"
              />
            </div>
          </a>
        </aside>
        {children}
      </main>
      <Footer />
    </>
  )
}

/**
 * 背景层：/background.webp 约 104KB，是纯装饰资源。
 *
 * 之前用内联 style 直接挂背景图，浏览器解析完样式立刻发起请求，会和首屏
 * CSS/JS（entry + 路由 chunk）抢带宽，慢网下表现为「背景图先到、页面迟迟不能交互」。
 * 现在 SSR/首帧只保留纯色底，等 window load 后的空闲帧（rIC，兜底 2.5s）才注入
 * background-image，把这条 104KB 请求完全挪出关键路径；宽度/高度由 fixed inset-0
 * 决定，不存在布局偏移。
 */
function DeferredBackground() {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let idleHandle: number | undefined
    const apply = () => {
      if (!cancelled) setSrc('/background.webp')
    }
    const schedule = () => {
      if (cancelled) return
      if (typeof requestIdleCallback === 'function') {
        idleHandle = requestIdleCallback(apply, { timeout: 1500 })
      } else {
        setTimeout(apply, 200)
      }
    }

    if (document.readyState === 'complete') {
      schedule()
    } else {
      window.addEventListener('load', schedule, { once: true })
    }
    // 兜底：load 事件可能被慢资源拖很久，最多等 2.5s 后照常注入。
    const timer = setTimeout(schedule, 2500)

    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('load', schedule)
      if (
        idleHandle !== undefined &&
        typeof cancelIdleCallback === 'function'
      ) {
        cancelIdleCallback(idleHandle)
      }
    }
  }, [])

  return (
    <div
      className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-30 dark:opacity-10"
      style={src ? { backgroundImage: `url("${src}")` } : undefined}
    />
  )
}
