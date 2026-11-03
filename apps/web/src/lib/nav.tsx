"use no memo";
import {
	Link as FurinLink,
	useNavigate as useFurinNavigate,
	useRouter as useFurinRouter,
} from "@teyik0/furin/link";
import { getRouteApi as furinGetRouteApi } from "@teyik0/furin/client";
import * as React from "react";

/**
 * 站内导航门面（furin 适配层）。
 *
 * 历史背景：这套代码从 TanStack Router 迁到 furin，`lib/nav.tsx` 曾是
 * 「TanStack 语义 → furin」的兼容层（`$id` 路由 id、`useRouter().invalidate`、
 * `<Outlet/>`、`useMatches()` 等）。现在按 furin 官方文档收敛成三层：
 *
 * 1. **公开 API 再导出**：`Link` / `useNavigate` / `useRouter` / `getRouteApi`
 *    都来自 `@teyik0/furin`，路由 id 一律用 furin 的 pattern（`/:id`）。
 * 2. **本应用的 UX 约定**：站内导航统一包一层 View Transition（页面有
 *    `view-transition-name` 配对），顶部进度条/右上角 spinner 读 `isNavigating`。
 * 3. **框架缺陷绕行**：`useSearch` 见下方注释（furin 0.8.0-alpha 的
 *    SearchStore 提交晚于渲染，官方用法在切页首帧会抛断言）。
 *
 * 文档：https://teyik0.github.io/furin/llms-full.txt
 * - Link & Navigation / Search State / Router Controls / Reading Data In Descendant Components
 */

/* ---------------------------- location store ---------------------------- */

type Loc = { pathname: string; searchStr: string; hash: string; href: string };

/** SSR 首屏的 path + search，由根布局 loader 下发（见 pages/root.tsx）。 */
export type NavPathValue = { pathname: string; searchStr: string };

export const NavPathContext = React.createContext<NavPathValue | null>(null);

export function NavPathProvider({
	initialPath,
	initialSearch = "",
	children,
}: {
	initialPath: string;
	initialSearch?: string;
	children: React.ReactNode;
}) {
	const value = React.useMemo(
		() => ({ pathname: initialPath, searchStr: initialSearch }),
		[initialPath, initialSearch],
	);
	return <NavPathContext.Provider value={value}>{children}</NavPathContext.Provider>;
}

function readLocation(): Loc {
	if (typeof window === "undefined") {
		return { pathname: "/", searchStr: "", hash: "", href: "/" };
	}
	return {
		pathname: window.location.pathname,
		searchStr: window.location.search,
		hash: window.location.hash,
		href: window.location.href,
	};
}

const locationListeners = new Set<() => void>();
let snapshot: Loc = readLocation();
let serverSnapshot: { pathname: string; searchStr: string; loc: Loc } | null =
	null;

function getServerSnapshot(initial: NavPathValue | null): Loc {
	const pathname = initial?.pathname ?? "/";
	const searchStr = initial?.searchStr ?? "";
	if (
		serverSnapshot &&
		serverSnapshot.pathname === pathname &&
		serverSnapshot.searchStr === searchStr
	) {
		return serverSnapshot.loc;
	}
	const loc = { pathname, searchStr, hash: "", href: pathname + searchStr };
	serverSnapshot = { pathname, searchStr, loc };
	return loc;
}

function notifyLocation() {
	snapshot = readLocation();
	for (const listener of locationListeners) listener();
}

function ensureHistoryPatched() {
	if (typeof window === "undefined") return;
	const history = window.history as History & {
		__furinishPatched?: boolean;
	};
	if (history.__furinishPatched) return;
	history.__furinishPatched = true;
	for (const name of ["pushState", "replaceState"] as const) {
		const original = history[name].bind(history);
		history[name] = ((...args: unknown[]) => {
			const result = (original as (...a: unknown[]) => void)(...args);
			notifyLocation();
			return result;
		}) as History[typeof name];
	}
	window.addEventListener("popstate", notifyLocation);
}

function subscribeLocation(listener: () => void) {
	ensureHistoryPatched();
	locationListeners.add(listener);
	return () => locationListeners.delete(listener);
}

function parseSearch(searchStr: string): Record<string, unknown> {
	const out: Record<string, string | string[]> = {};
	const params = new URLSearchParams(searchStr);
	for (const key of params.keys()) {
		const values = params.getAll(key);
		out[key] = values.length > 1 ? values : values[0];
	}
	return out;
}

export function useLocationSnapshot(): Loc {
	ensureHistoryPatched();
	const initial = React.useContext(NavPathContext);
	return React.useSyncExternalStore(
		subscribeLocation,
		() => snapshot,
		() => getServerSnapshot(initial),
	);
}

/** 只订阅 pathname 字符串（`useSyncExternalStore` 用 Object.is 比较，search 变化不触发重渲染）。 */
export function usePathname(): string {
	ensureHistoryPatched();
	const initial = React.useContext(NavPathContext);
	return React.useSyncExternalStore(
		subscribeLocation,
		() => snapshot.pathname,
		() => getServerSnapshot(initial).pathname,
	);
}

/** 当前地址（pathname / search / hash），等价 TanStack 的 `useLocation()`。 */
export function useLocation() {
	const location = useLocationSnapshot();
	return {
		pathname: location.pathname,
		search: parseSearch(location.searchStr),
		searchStr: location.searchStr,
		hash: location.hash,
		href: location.href,
	};
}

/* ------------------------------- view transition ------------------------------- */

export function runViewTransition(run: () => unknown): unknown {
	if (
		typeof document === "undefined" ||
		typeof (document as Document & { startViewTransition?: unknown })
			.startViewTransition !== "function"
	) {
		return run();
	}
	try {
		const vt = (
			document as Document & {
				startViewTransition: (cb: () => unknown) => {
					finished: Promise<void>;
				};
			}
		).startViewTransition(run);
		return vt.finished.catch(() => undefined);
	} catch {
		return run();
	}
}

/* ------------------------------- destinations ------------------------------- */

type Destination = {
	to?: string;
	params?: Record<string, unknown>;
	search?: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>);
	hash?: string | number;
	replace?: boolean;
	resetScroll?: boolean;
	viewTransition?: boolean;
	[extra: string]: unknown;
};

function isExternal(to: string): boolean {
	return /^(https?:|mailto:|tel:|\/\/)/.test(to) || to.startsWith("#");
}

function buildHref(destination: Destination): string {
	const to = destination.to ?? snapshot.pathname;
	if (isExternal(to)) return to;
	const params = destination.params ?? {};
	const path = to.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
		const value = params[key];
		return value === undefined || value === null ? "" : encodeURIComponent(String(value));
	});
	const search =
		typeof destination.search === "function"
			? destination.search(parseSearch(snapshot.searchStr))
			: destination.search;
	const query = new URLSearchParams();
	if (search) {
		for (const [key, value] of Object.entries(search)) {
			if (value === undefined || value === null || value === "") continue;
			if (Array.isArray(value)) {
				for (const item of value) query.append(key, String(item));
			} else if (typeof value === "object") {
				query.set(key, JSON.stringify(value));
			} else {
				query.set(key, String(value));
			}
		}
	}
	const qs = query.toString();
	const hash =
		destination.hash === undefined || destination.hash === null
			? ""
			: "#" + String(destination.hash).replace(/^#/, "");
	return path + (qs ? "?" + qs : "") + hash;
}

/**
 * 文档约定的重定向：loader 里抛一个带 Location 的 Response，furin 会把它当作导航处理。
 * 见官方文档 Error Handling → Redirects And Responses。
 */
export function redirect(destination: Destination): never {
	throw new Response(null, {
		status: 302,
		headers: { location: buildHref(destination) },
	});
}

/* ------------------------------- Link ------------------------------- */

export type LinkProps = Destination & {
	activeProps?: Record<string, unknown> | ((opts: { isActive: boolean }) => Record<string, unknown>);
	inactiveProps?: Record<string, unknown> | ((opts: { isActive: boolean }) => Record<string, unknown>);
	preload?: false | "intent" | "viewport" | "render";
	preloadDelay?: number;
	preloadStaleTime?: number;
	disabled?: boolean;
	onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
	children?: React.ReactNode;
	[key: string]: unknown;
};

const FurinLinkAny = FurinLink as unknown as React.ComponentType<Record<string, unknown>>;

/**
 * 站内链接。直接复用 furin 的 `<Link>`（真实 `<a href>` + 同源拦截 + 预取），
 * 只把 TanStack 时代的 `hash` 数字形态归一成字符串。
 */
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
	function Link({ hash, children, ...rest }, ref) {
		return (
			<FurinLinkAny ref={ref} hash={hash === undefined ? undefined : String(hash)} {...rest}>
				{children}
			</FurinLinkAny>
		);
	},
);

/* ------------------------------- navigation ------------------------------- */

export function useNavigate(_options?: { from?: string } | string) {
	const navigate = useFurinNavigate();
	return React.useCallback(
		(destination?: Destination | string) => {
			const target: Destination =
				typeof destination === "string" ? { to: destination } : { ...destination };
			// TanStack 允许只改 search：furin 需要一个目标，缺省用当前路径
			if (!target.to) {
				if (target.search === undefined && target.hash === undefined) return Promise.resolve();
				target.to = snapshot.pathname;
			}
			if (isExternal(target.to as string)) {
				if (typeof window !== "undefined") window.location.assign(target.to as string);
				return Promise.resolve();
			}
			const { viewTransition, ...options } = target;
			const run = () => navigate(options as never);
			if (viewTransition === false) return Promise.resolve(run()) as Promise<void>;
			return runViewTransition(run) as Promise<void>;
		},
		[navigate],
	);
}

/**
 * furin 的路由句柄（文档：Router Controls）。`isNavigating` 驱动顶部进度条与 spinner。
 *
 * 唯一适配：furin 的 `prefetch()` 返回 `void`，而站内的「空闲/视口预取」队列按
 * `() => Promise<unknown>` 编排（便于统一 catch/取消）。这里把它归一成 Promise，
 * 调用方不用到处写 `Promise.resolve(...)`。
 */
export function useRouter() {
	const router = useFurinRouter();
	return React.useMemo(() => {
		const prefetch = router.prefetch.bind(router);
		return {
			...router,
			prefetch: (destination: unknown, options?: unknown) =>
				Promise.resolve(prefetch(destination as never, options as never)),
		};
	}, [router]);
}

export type RegisteredRouter = ReturnType<typeof useRouter>;

/** 站内是否正在切换（文档：`router.isNavigating`）。 */
export function useNavigationPending(): boolean {
	const router = useFurinRouter();
	return Boolean(router?.isNavigating);
}

/* ------------------------------- search ------------------------------- */

/**
 * 读取地址栏的 query（TanStack `useSearch()` 的等价物）。
 *
 * ⚠️ 为什么不直接用 `@teyik0/furin/search` 的 `useSearch(pattern)`：
 * furin 的 SearchStore 在 `useLayoutEffect` 里提交（渲染之后），而
 * `assertSearchRoute` 在渲染期用「上一帧快照」校验 `from`；站内切页时
 * 地址栏先变、store 后提交，于是首帧必然抛
 * `[furin] useSearch("…") does not match the current route.`，整页被打成 500。
 *
 * 2026-11-04 复核：npm `latest` 与 GitHub `main`（0.8.0-alpha.0 之后 10 天）的代码仍与
 * 已发布版本一致，实测切回框架实现会在 `/admin` → 「查看站点」重新打回 500 错误页。
 * 在上游把 store 提交挪到渲染之前（或让断言容忍切页首帧）之前，保持只读地址栏。
 * 复验方法与切换清单：`docs/furin-navigation-alignment.md#切换到框架的-usesearch待上游修复`
 */
export function useSearch<T = any>(_options?: { from?: string; strict?: boolean }): T {
	const location = useLocationSnapshot();
	return React.useMemo(
		() => parseSearch(location.searchStr) as T,
		[location.searchStr],
	);
}

/* ------------------------------- route api ------------------------------- */

/**
 * 读取当前页面 loader 数据 / 校验后的 params（文档：Reading Data In Descendant Components）。
 * 参数是 furin 的 route pattern（如 `"/:id/comment"`）。
 */
export function getRouteApi(pattern: string) {
	return furinGetRouteApi(pattern as never) as unknown as {
		// 返回类型由调用方显式标注（各页面 loader 的数据结构不同，这里不做约束）
		useLoaderData: <T = any>() => T;
		useParams: () => Record<string, string>;
	};
}
