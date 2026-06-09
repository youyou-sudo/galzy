import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  ScriptOnce,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { Image } from '@unpic/react'
import Errors from '@web/components/error'
import { RouterProgress } from '@web/components/ProgressProvider'
import { Toaster } from 'sonner'
import Footer from '../components/Footer'
import Header from '../components/Header'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import TanStackQueryProvider from '../integrations/tanstack-query/root-provider'
import appCss from '../styles.css?url'

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
      typeof (error as any).status === 'number'
        ? (error as any).status
        : 500
    return <Errors code={status} errormessage={error.message} />
  },
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans" suppressHydrationWarning>
      <head>
        <ScriptOnce>{THEME_INIT_SCRIPT}</ScriptOnce>
        <HeadContent />
      </head>
      <body className="font-sans antialiased flex flex-col min-h-screen">
        {/* 背景层 */}
        <div
          className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-30 dark:opacity-10"
          style={{ backgroundImage: 'url("/background.webp")' }}
        />
        <TanStackQueryProvider>
          <RouterProgress />
          <Header />
          <main className="mx-auto w-full max-w-7xl p-4 space-y-4">
            {/* 广告 */}
            <aside
              id="sidebar-ad"
              className="flex flex-col mx-auto lg:px-24 max-w-7xl px-4 py-0 mt-2 opacity-70 relative"
            >
              <a
                data-umami-event="广告点击"
                data-umami-event-name="dzmm"
                data-umami-event-position="Banner-dzmm"
                target="_blank"
                href="https://www.ainexa.top?rf=876926e5"
              >
                <div
                  id="sidebar-ad"
                  className="sm:hidden overflow-hidden rounded-lg"
                >
                  <Image
                    width={1425}
                    height={120}
                    src="/dzmmgif.webp"
                    alt="dzmm 广告图片"
                    className="object-cover scale-[1.03]"
                  />
                </div>
                <div id="sidebar-ad" className="hidden sm:block">
                  <Image
                    width={1425}
                    height={113}
                    src="/dzmmgif.webp"
                    alt="dzmm 广告图片"
                    className="object-cover rounded-lg"
                  />
                </div>
              </a>
            </aside>
            {children}
          </main>
          <Footer />
          <Toaster position="top-center" />
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        </TanStackQueryProvider>
        <Scripts />
      </body>
    </html>
  )
}
