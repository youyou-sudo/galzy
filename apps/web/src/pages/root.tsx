import { defineRootRoute, HeadContent, Scripts } from "@teyik0/furin";
import { TopAdSlot } from "@web/components/adverts/top-ad-slot";
import Errors from "@web/components/error";
import { RouteLoadingIndicator } from "@web/components/shared/route-loading-indicator";
import { TopProgressBar } from "@web/components/shared/top-progress-bar";
import { TooltipProvider } from "@web/components/ui/tooltip";
import { setPrefetchDevMode } from "@web/hooks/use-viewport-preload";
import QueryProvider from "@web/integrations/tanstack-query/furin-provider";
import {
	type AdSlotPayload,
	adSlotQueryKey,
	TOP_AD_SLOT_KEY,
} from "@web/lib/adverts";
import { loadTopAdSlot } from "@web/lib/adverts-data";
import { AUTH_QUERY_KEY } from "@web/lib/auth-session-key";
import { isPersonalizedPath } from "@web/lib/is-personalized-path";
import { NavPathProvider, usePathname } from "@web/lib/nav";
import { useSeedQueries } from "@web/lib/query-seed";
import { isSpaDataRequest } from "@web/lib/spa-request";
import { getSession } from "@web/server/auth/auth.functions";
import { type ReactNode, useEffect, useState } from "react";
import { Toaster } from "sonner";
import Footer from "../components/Footer";
import Header from "../components/Header";
import "../styles.css";

/** 会话类型：根布局 loader 下发的会话（等价于用户菜单里 `['auth']` 的数据）。 */
type AuthSession = Awaited<ReturnType<typeof getSession>>;

/** Anti-flash theme bootstrap; must run before hydration paints. */
const THEME_INIT_SCRIPT =
	"(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();";

type RootLayoutProps = {
	children: ReactNode;
	path: string;
	/** 本次请求的 query 串（含前导 ?），交给 NavPathProvider 供 SSR 期 useSearch 读取 */
	search: string;
	adSlot: AdSlotPayload | null;
	authSession: AuthSession;
	/** 本次渲染的会话是否可信（仅登录态相关页面为 true；用户视图走客户端查询） */
	authKnown: boolean;
	/** 是否开发模式（`bun --hot` 下空闲预取会阻塞调试，见 use-viewport-preload） */
	dev: boolean;
};

export const route = defineRootRoute()
	/**
	 * 根布局一律 SSR：源站不做任何服务端缓存，每次请求实时渲染；公开页允许
	 * CDN 边缘缓存（见 lib/cdn-cache.ts），个性化/评论页保持 no-store。
	 * 公开页不读会话，因此不存在「登录态被共享缓存复用」的问题。
	 *
	 * 广告位是公共数据，随页面一起渲染；登录态仍然只在
	 * `isPersonalizedPath()` 命中的页面于服务端取（见下方 loader）——
	 * 公开页面交给客户端查询，省掉每个访客一次会话往返。
	 */
	.config({ mode: "ssr" })
	/**
	 * 顶部广告位在根布局取数（等价于重构前 `__root.tsx` 的 `beforeLoad` 预取）：
	 * SSR 首帧的 HTML 里就带广告，客户端 hydration 复用同一份数据，
	 * 不会出现「先没有广告、JS 执行后才补上」的空位与布局跳动。
	 *
	 * 登录态只在个性化页面随文档下发（用户菜单/后台守卫 hydration 命中，
	 * 不必等客户端 get-session）；用户视图交给客户端查询，首屏少一次阻塞。
	 */
	.loader(async ({ path, request }) => {
		const personalized = isPersonalizedPath(path);
		// 站内切页（?_furin=data）不重取会话：客户端缓存里已经有了
		const fetchAuth = personalized && !isSpaDataRequest();
		return {
			adSlot: await loadTopAdSlot(undefined, path),
			authSession: fetchAuth ? await getSession() : null,
			authKnown: fetchAuth,
			dev: process.env.NODE_ENV !== "production",
			search: requestSearch(request),
		};
	})
	.layout(
		({
			children,
			path,
			search,
			adSlot,
			authSession,
			authKnown,
			dev,
		}: RootLayoutProps) => (
			<html lang="zh-Hans" suppressHydrationWarning>
				<head>
					<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
					{/* 封面来自图片子域：提前建连省一个 RTT（host 需与 API 的 GAME_IMAGE_BASE_URL 保持一致） */}
					<link rel="preconnect" href="https://vndb-t.galzy.moe" />
					<HeadContent />
				</head>
				<body className="flex flex-col min-h-screen font-sans antialiased">
					<NavPathProvider initialPath={path} initialSearch={search}>
						<QueryProvider>
							<TooltipProvider>
								<AppChrome
									adSlot={adSlot}
									authSession={authSession}
									authKnown={authKnown}
									dev={dev}
								>
									{children}
								</AppChrome>
							</TooltipProvider>
							<Toaster position="top-center" />
						</QueryProvider>
					</NavPathProvider>
					<TopProgressBar />
					<RouteLoadingIndicator />
					<Scripts />
				</body>
			</html>
		),
	);

/** 本次请求的 query 串（含前导 ?；取不到时返回空串）。 */
function requestSearch(request: Request | undefined): string {
	if (!request) return "";
	try {
		return new URL(request.url).search;
	} catch {
		return "";
	}
}

/**
 * User / admin shell switch. /admin/** routes render their own AdminShell
 * layout (pages/admin/_route.tsx); everything else gets Header + ads + Footer.
 */
function AppChrome({
	children,
	adSlot,
	authSession,
	authKnown,
	dev,
}: {
	children: ReactNode;
	adSlot: AdSlotPayload | null;
	authSession: AuthSession;
	authKnown: boolean;
	dev: boolean;
}) {
	// 开发模式（bun --hot 按需编译）下关掉空闲预取：一次预取要 1~8s，
	// 会把浏览器同源连接占满，本地调试时页面反而更卡；生产构建没有这个开销。
	setPrefetchDevMode(dev);
	// 把根布局 loader 拿到的广告位数据灌回与 TopAdSlot 同 key 的 query 缓存：
	// SSR 与 hydration 的首次渲染就能命中，组件内的 useQuery 不会再补一次请求。
	// 登录态只在「个性化页面」seed：用户视图的登录态由客户端查询取得，
	// 不能把 null 也 seed 进去（否则会误判未登录）。
	// 必须放在下面的 /admin 提前 return 之前，保持 hooks 调用顺序稳定。
	const seeds: Array<[readonly unknown[], unknown]> = [];
	if (adSlot !== null) seeds.push([adSlotQueryKey(TOP_AD_SLOT_KEY), adSlot]);
	if (authKnown) seeds.push([AUTH_QUERY_KEY, authSession ?? null]);
	useSeedQueries(seeds);

	const pathname = usePathname();
	const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

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
			if (
				idleHandle !== undefined &&
				typeof cancelIdleCallback === "function"
			) {
				cancelIdleCallback(idleHandle);
			}
		};
	}, []);

	return (
		<div
			data-app-background=""
			className="fixed inset-0 -z-10 bg-center bg-cover bg-no-repeat opacity-30 dark:opacity-10"
			style={
				src
					? { backgroundImage: "url(" + JSON.stringify(src) + ")" }
					: undefined
			}
		/>
	);
}

export { Errors };
