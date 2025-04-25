import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";
import clsx from "clsx";
import { Provider } from "jotai";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

import BreadcrumbNav from "@/components/BreadcrumbNav";
import SidebarAssembly from "@/components/dashboardUi";
import SidePanelSwitch from "@/components/sidePanelSwitch";
import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Toaster } from "@/components/ui/sonner";
import BarProviders from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return (
    <html suppressHydrationWarning lang="zh-CN">
      <head>
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
              <div className="container mx-auto grow"></div>
              <Provider>
                {session?.user.role !== "admin" ? (
                  <div className="flex flex-col gap-4 justify-center items-center h-2/6">
                    <h2>
                      当前 {session?.user?.email} 没有管理员权限，请联系管理员
                    </h2>
                    <Button variant="outline" asChild>
                      <Link href={"/"}>返回主页</Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    <SidebarAssembly />
                    <main className="container mx-auto grow">
                      <SidePanelSwitch />
                      <BreadcrumbNav className="mb-4" />
                      {children}
                    </main>
                  </>
                )}
                <Toaster richColors expand={false} />
                <footer className="w-full flex items-center justify-center py-3"></footer>
              </Provider>
            </div>
          </ThemeProvider>
        </BarProviders>
      </body>
    </html>
  );
}
