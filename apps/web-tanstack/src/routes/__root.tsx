import { BUILD_ID } from 'virtual:build-id'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  ScriptOnce,
  Scripts,
  useMatches,
} from '@tanstack/react-router'
import { TopAdSlot } from '@web/components/adverts/top-ad-slot'
import Errors from '@web/components/error'
import { RouteLoadingIndicator } from '@web/components/shared/route-loading-indicator'
import { TooltipProvider } from '@web/components/ui/tooltip'
import { TOP_AD_SLOT_KEY } from '@web/lib/adverts'
import { adSlotQueryOptions } from '@web/server/adverts'
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
  /**
   * 顶部广告位数据在根布局预取：SSR 首帧直接出广告（避免客户端补数据导致布局跳动），
   * 客户端导航命中同一份 query 缓存（60s 内不重复请求）。
   * 数据按广告位 key 取（home_top），设备定向 / 条数上限 / 权重轮换由 API 完成。
   * - 后台路由 /admin/** 不渲染广告位，直接跳过；
   * - prefetchQuery 自身吞掉错误：广告接口异常时静默降级为「不展示」，
   *   导航不会因此中断；命中缓存零成本，过期后为拿到首帧数据会等这一次请求。
   */
  beforeLoad: async ({ location, context }) => {
    if (location.pathname.startsWith('/admin')) return
    await context.queryClient.prefetchQuery(adSlotQueryOptions(TOP_AD_SLOT_KEY))
  },
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
      <body className="flex flex-col min-h-screen font-sans antialiased">
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
        {/* 路由切换加载指示器：右上角一个小图标，不遮挡页面内容 */}
        <RouteLoadingIndicator />
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
      {/* 键盘用户跳过导航：与顶栏药丸同样用「默认隐藏、聚焦时浮出」的玻璃面板 */}
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-[100] px-4 py-2 text-sm font-medium bg-background rounded-xl ring-1 ring-border shadow-lg transition-transform duration-200 -translate-y-20 focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        跳到主内容
      </a>
      {/* 背景层 */}
      <DeferredBackground />
      <Header />
      {/* 顶栏是 fixed（滚动后收缩成悬浮药丸），首屏在文档流里让出顶栏高度，
          否则广告位与页面标题会钻到透明顶栏底下。高度由令牌派生，与 scroll-padding 同源。 */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 px-4 pt-[var(--app-header-height)] mx-auto w-full max-w-7xl outline-none sm:px-6"
      >
        {/* 广告：与正文同容器居中。数据由后台「广告位 + 广告素材」管理，
            桌面 1 条整宽 / 多条两列，手机端按广告位配置轮播或堆叠（见 components/adverts/top-ad-slot.tsx） */}
        <TopAdSlot />
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
      data-app-background=""
      className="fixed inset-0 -z-10 bg-center bg-cover bg-no-repeat opacity-30 dark:opacity-10"
      style={src ? { backgroundImage: `url("${src}")` } : undefined}
    />
  )
}
