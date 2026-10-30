import { defineRootRoute, HeadContent, Scripts } from "@teyik0/furin";
import { TopAdSlot } from "@web/components/adverts/top-ad-slot";
import Errors from "@web/components/error";
import { RouteLoadingIndicator } from "@web/components/shared/route-loading-indicator";
import { TooltipProvider } from "@web/components/ui/tooltip";
import QueryProvider from "@web/integrations/tanstack-query/furin-provider";
import { NavPathProvider, useMatches } from "@web/lib/nav";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import Footer from "../components/Footer";
import Header from "../components/Header";
import "../styles.css";

/** Anti-flash theme bootstrap; must run before hydration paints. */
const THEME_INIT_SCRIPT =
  "(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();";

export const route = defineRootRoute()
  .config({ mode: "ssr" })
  .layout(({ children, path }: { children: ReactNode; path: string }) => (
    <html lang="zh-Hans" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="flex flex-col min-h-screen font-sans antialiased">
        <NavPathProvider initialPath={path}>
        <QueryProvider>
          <TooltipProvider>
            <AppChrome>{children}</AppChrome>
          </TooltipProvider>
          <Toaster position="top-center" />
        </QueryProvider>
        </NavPathProvider>
        <RouteLoadingIndicator />
        <Scripts />
      </body>
    </html>
  ));

/**
 * User / admin shell switch. /admin/** routes render their own AdminShell
 * layout (pages/admin/_route.tsx); everything else gets Header + ads + Footer.
 */
function AppChrome({ children }: { children: ReactNode }) {
  const matches = useMatches();
  const isAdmin = matches.some((m) => m.routeId.startsWith("/admin/"));

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-[100] px-4 py-2 text-sm font-medium bg-background rounded-xl ring-1 ring-border shadow-lg transition-transform duration-200 -translate-y-20 focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        跳到主内容
      </a>
      <DeferredBackground />
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 px-4 pt-[var(--app-header-height)] mx-auto w-full max-w-7xl outline-none sm:px-6"
      >
        <TopAdSlot />
        {children}
      </main>
      <Footer />
    </>
  );
}

/** Decorative background injected after load, off the critical path. */
function DeferredBackground() {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let idleHandle: number | undefined;
    const apply = () => {
      if (!cancelled) setSrc("/public/background.webp");
    };
    const schedule = () => {
      if (cancelled) return;
      if (typeof requestIdleCallback === "function") {
        idleHandle = requestIdleCallback(apply, { timeout: 1500 });
      } else {
        setTimeout(apply, 200);
      }
    };
    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }
    const timer = setTimeout(schedule, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("load", schedule);
      if (idleHandle !== undefined && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleHandle);
      }
    };
  }, []);

  return (
    <div
      data-app-background=""
      className="fixed inset-0 -z-10 bg-center bg-cover bg-no-repeat opacity-30 dark:opacity-10"
      style={src ? { backgroundImage: "url(" + JSON.stringify(src) + ")" } : undefined}
    />
  );
}

export { Errors };