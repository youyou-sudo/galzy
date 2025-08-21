import Providers from "@/components/provider/providers";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/provider/theme-provider";
import { ViewTransitions } from "next-view-transitions";
import { PublicEnvScript } from "next-runtime-env";
import QueryProvider from "@/components/provider/QueryProvider";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function RootLayout({
  children,
  auth,
}: {
  children: React.ReactNode;
  auth: React.ReactNode;
}) {
  return (
    <ViewTransitions>
      <html lang="zh-CN" suppressHydrationWarning>
        <head>
          <PublicEnvScript />
        </head>
        <body className={`antialiased`}>
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
  );
}
