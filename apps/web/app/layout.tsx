import Providers from '@web/components/provider/providers'
import '@web/app/globals.css'
import QueryProvider from '@web/components/provider/QueryProvider'
import { ThemeProvider } from '@web/components/provider/theme-provider'
import { PublicEnvScript } from 'next-runtime-env'
import { ViewTransitions } from 'next-view-transitions'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import AuthYjvg from '@web/components/auth/authYjvg'

export default function RootLayout({
  children,
  auth,
}: {
  children: React.ReactNode
  auth: React.ReactNode
}) {
  return (
    <ViewTransitions>
      <AuthYjvg>
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
      </AuthYjvg>
    </ViewTransitions>
  )
}
