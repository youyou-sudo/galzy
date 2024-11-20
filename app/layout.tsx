import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/toaster";
import AuthProvider from "./(auth)/(components)/AuthProvider";
import { PublicEnvScript } from "next-runtime-env";

export const metadata: Metadata = {
  openGraph: {
    title: {
      default: siteConfig.name,
      template: `%s - ${siteConfig.name}`,
    },
    description: siteConfig.description,
  },
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
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
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <AuthProvider>
          <Providers
            themeProps={{ attribute: "class", defaultTheme: "system" }}
          >
            <div className="relative flex flex-col h-screen">
              <Navbar />
              <main className="container mx-auto max-w-7xl pt-3 px-6 flex-grow">
                <NuqsAdapter>{children}</NuqsAdapter>
              </main>
              <Toaster />
              <footer className="w-full flex items-center justify-center py-3"></footer>
            </div>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
