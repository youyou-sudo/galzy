import Providers from '@web/components/provider/providers'
import '@web/app/globals.css'
import QueryProvider from '@web/components/provider/QueryProvider'
import { ThemeProvider } from '@web/components/provider/theme-provider'
import type { Metadata } from 'next'
import { PublicEnvScript } from 'next-runtime-env'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

export const metadata: Metadata = {
  metadataBase: new URL('https://galzy.eu.org'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    relatedLink: {
      '@type': 'WebPageElement',
      name: '广告',
      cssSelector: '#sidebar-ad',
      webPageElementType: 'Advertisement',
    },
  }
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <PublicEnvScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </head>
      <body className={`antialiased flex flex-col min-h-screen`}>
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              <NuqsAdapter>{children}</NuqsAdapter>
            </QueryProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
