import Providers from '@web/components/provider/providers'
import '@web/app/globals.css'
import QueryProvider from '@web/components/provider/QueryProvider'
import { ThemeProvider } from '@web/components/provider/theme-provider'
import { PublicEnvScript } from 'next-runtime-env'
import { ViewTransitions } from 'next-view-transitions'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL("https://galzy.eu.org"),
}

export default function RootLayout({
  children,
  auth,
}: {
  children: React.ReactNode
  auth: React.ReactNode
}) {

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "relatedLink": {
      "@type": "WebPageElement",
      "name": "广告",
      "cssSelector": "#sidebar-ad",
      "webPageElementType": "Advertisement"
    }
  };
  return (
    <ViewTransitions>
      <html lang="zh-CN" suppressHydrationWarning>
        <head>
          <PublicEnvScript />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        </head>
        <body className={`antialiased flex flex-col min-h-screen`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Providers>
              <QueryProvider>
                <NuqsAdapter>
                  {auth}
                  {children}
                </NuqsAdapter>
              </QueryProvider>
            </Providers>
          </ThemeProvider>
        </body>
      </html>
    </ViewTransitions>
  )
}
