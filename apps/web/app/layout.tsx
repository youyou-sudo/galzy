import Providers from '@web/components/provider/providers'
import '@web/app/globals.css'
import QueryProvider from '@web/components/provider/QueryProvider'
import { ThemeProvider } from '@web/components/provider/theme-provider'
import type { Metadata } from 'next'
import { PublicEnvScript } from 'next-runtime-env'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Cinzel, Noto_Sans, Noto_Sans_JP, Noto_Sans_Mono, Noto_Sans_SC } from 'next/font/google'

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-cinzel',
})
const notoSans_Latin = Noto_Sans({
  display: 'swap',
  variable: '--font-latin',
  subsets: ['latin'],
})
const notoSans_SC = Noto_Sans_SC({
  display: 'swap',
  variable: '--font-sc',
  subsets: ['latin'],
})
const notoSans_JP = Noto_Sans_JP({
  display: 'swap',
  variable: '--font-jp',
  subsets: ['latin'],
})
const notoSans_Mono = Noto_Sans_Mono({
  display: 'swap',
  variable: '--font-mono',
  subsets: ['latin'],
})

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
    <html
      lang="zh-CN"
      className={`${notoSans_Latin.variable} ${notoSans_SC.variable} ${notoSans_JP.variable} ${notoSans_Mono.variable} ${cinzel.variable}`}
      suppressHydrationWarning
    >
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
