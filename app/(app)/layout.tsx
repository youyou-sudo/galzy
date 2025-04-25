import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";
import clsx from "clsx";
import { Provider } from "jotai";

import { PublicEnvScript } from "next-runtime-env";
import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import BarProviders from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="zh-CN">
      <head>
        <PublicEnvScript />
      </head>
      <body
        className={clsx(
          "min-h-screen bg-background font-sans antialiased bodybj",
          fontSans.variable
        )}
      >
        <BarProviders>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="relative flex flex-col h-screen">
              <div className="container mx-auto grow">
                <Navbar />
              </div>
              <main className="container mx-auto grow">
                <Provider>{children}</Provider>
              </main>
              <Toaster richColors expand={false} />
              <footer className="w-full flex items-center justify-center py-3"></footer>
            </div>
          </ThemeProvider>
        </BarProviders>
      </body>
    </html>
  );
}
