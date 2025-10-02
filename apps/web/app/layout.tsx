import Providers from '@web/components/provider/providers'
import '@web/app/globals.css'
import QueryProvider from '@web/components/provider/QueryProvider'
import { ThemeProvider } from '@web/components/provider/theme-provider'
import { PublicEnvScript } from 'next-runtime-env'
import { ViewTransitions } from 'next-view-transitions'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import type { Metadata } from 'next'
import 'lib/env'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL!),
}

export default function RootLayout({
  children,
  auth,
}: {
  children: React.ReactNode
  auth: React.ReactNode
}) {
  return (
    <ViewTransitions>
      <html lang="zh-CN" suppressHydrationWarning>
        <head>
          <PublicEnvScript />
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
