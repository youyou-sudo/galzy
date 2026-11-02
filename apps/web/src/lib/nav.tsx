"use no memo";
import {
	Link as FurinLink,
	useNavigate as useFurinNavigate,
	useRouter as useFurinRouter,
} from "@teyik0/furin/link";
import { Await as FurinAwait, getRouteApi as furinGetRouteApi } from "@teyik0/furin/client";
import { useSearch as useFurinSearch } from "@teyik0/furin/search";
import * as React from "react";
import { legacyToPattern, matchPattern, matchedRouteIds, toFurinPattern } from "./route-manifest";

/* -------------------------------------------------------------------------
 * TanStack-compatible navigation surface for Furin.
 *
 * The components in this app were written against @tanstack/react-router.
 * This module is a drop-in replacement for the subset they use: Link,
 * useNavigate, useRouter, useRouterState, useSearch, useParams, useMatches,
 * useLocation, Outlet, getRouteApi and redirect. Legacy route ids
 * ("/$id/_layout/comment") are translated to Furin patterns ("/:id/comment")
 * through the generated route manifest, so call sites keep their strings.
 * ---------------------------------------------------------------------- */

type LegacyTarget = {
	to?: string;
	params?: Record<string, unknown>;
	search?: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>);
	hash?: string | number;
	replace?: boolean;
	resetScroll?: boolean;
	state?: unknown;
	mask?: unknown;
	viewTransition?: boolean;
	[extra: string]: unknown;
};

/* ---------------------------- location store --------------------------- */

type Loc = { pathname: string; searchStr: string; hash: string; href: string };

/** SSR path supplied by the root layout loader (see pages/root.tsx). */
export const NavPathContext = React.createContext<string | null>(null);

export function NavPathProvider({ initialPath, children }: { initialPath: string; children: React.ReactNode }) {
	return <NavPathContext.Provider value={initialPath}>{children}</NavPathContext.Provider>;
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
const pendingListeners = new Set<() => void>();
let snapshot: Loc = readLocation();
let serverSnapshot: { path: string | null; loc: Loc } | null = null;

function getServerSnapshot(initialPath: string | null): Loc {
	if (serverSnapshot && serverSnapshot.path === initialPath) return serverSnapshot.loc;
	const path = initialPath ?? "/";
	const loc = { pathname: path, searchStr: "", hash: "", href: path };
	serverSnapshot = { path: initialPath, loc };
	return loc;
}
let pendingDepth = 0;
let patchedHistory = false;

function notifyLocation() {
	snapshot = readLocation();
	setPending(false);
	for (const listener of locationListeners) listener();
}

function setPending(next: boolean) {
	pendingDepth = next ? pendingDepth + 1 : 0;
	for (const listener of pendingListeners) listener();
}

export function runViewTransition(run: () => unknown): unknown {
	if (typeof document === "undefined" || typeof (document as Document & { startViewTransition?: unknown }).startViewTransition !== "function") {
		return run();
	}
	try {
		const vt = (document as Document & { startViewTransition: (cb: () => unknown) => { finished: Promise<void> } }).startViewTransition(run);
		return vt.finished.catch(() => undefined);
	} catch {
		return run();
	}
}

export function markNavigationPending() {
	pendingDepth += 1;
	for (const listener of pendingListeners) listener();
}

function ensureHistoryPatched() {
	if (patchedHistory || typeof window === "undefined") return;
	patchedHistory = true;
	for (const name of ["pushState", "replaceState"] as const) {
		const original = window.history[name].bind(window.history);
		window.history[name] = ((...args: unknown[]) => {
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

function subscribePending(listener: () => void) {
	pendingListeners.add(listener);
	return () => pendingListeners.delete(listener);
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

/* ------------------------------- helpers ------------------------------- */

function resolvePattern(from?: string): string {
	if (from) return legacyToPattern(from) ?? toFurinPattern(from);
	if (typeof window !== "undefined") {
		const hit = matchPattern(window.location.pathname);
		if (hit) return hit.pattern;
	}
	return "/";
}

function normalizeSearch(
	search: LegacyTarget["search"],
	current?: Record<string, unknown>,
): Record<string, unknown> | undefined {
	if (search === undefined) return undefined;
	if (typeof search === "function") {
		return search(current ?? parseSearch(snapshot.searchStr));
	}
	return search;
}

function buildHref(target: LegacyTarget): string {
	if (!target.to) return snapshot.href;
	if (/^(https?:|mailto:|tel:|\/\/)/.test(target.to) || target.to.startsWith("#")) {
		return target.to;
	}
	const pattern = toFurinPattern(target.to);
	const params = target.params ?? {};
	const path = pattern.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
		const value = params[key];
		return value === undefined || value === null ? "" : encodeURIComponent(String(value));
	});
	const search = normalizeSearch(target.search);
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
	const hash = target.hash !== undefined && target.hash !== null ? "#" + String(target.hash).replace(/^#/, "") : "";
	return path + (qs ? "?" + qs : "") + hash;
}

/** 路由匹配缓存：matchPattern 是 46 条路由的线性扫描，按 pathname 缓存；
 * 用 Map 而不是单槽，避免并发 SSR 请求互相顶掉（命中率≈0）。 */
const MATCH_CACHE_MAX = 8;
const matchCache = new Map<
	string,
	{ ids: string[]; hit: ReturnType<typeof matchPattern> }
>();

function buildMatches(pathname: string) {
	let entry = matchCache.get(pathname);
	if (!entry) {
		entry = { ids: matchedRouteIds(pathname), hit: matchPattern(pathname) };
		if (matchCache.size >= MATCH_CACHE_MAX) {
			const oldest = matchCache.keys().next().value;
			if (oldest !== undefined) matchCache.delete(oldest);
		}
		matchCache.set(pathname, entry);
	}
	const search = parseSearch(snapshot.searchStr);
	return entry.ids.map((routeId) => ({
		routeId,
		pathname,
		pattern: entry.hit?.pattern,
		status: "success" as const,
		params: {},
		// 每项一个副本：保持「各 match 各自持有 search 对象」的原有可观察语义
		search: { ...search },
	}));
}

export type RouterState = {
	status: "idle" | "pending";
	isLoading: boolean;
	location: { pathname: string; search: Record<string, unknown>; searchStr: string; hash: string; href: string };
	matches: Array<{ routeId: string; pathname: string; pattern?: string; status: "success"; params: Record<string, unknown>; search: Record<string, unknown> }>;
};

/* -------------------------------- hooks -------------------------------- */

export function useLocationSnapshot(): Loc {
	ensureHistoryPatched();
	const initialPath = React.useContext(NavPathContext);
	return React.useSyncExternalStore(
		subscribeLocation,
		() => snapshot,
		() => getServerSnapshot(initialPath),
	);
}

export function useNavigationPending(): boolean {
	return React.useSyncExternalStore(
		subscribePending,
		() => pendingDepth > 0,
		() => false,
	);
}

/**
 * 只订阅 pathname 字符串：useSyncExternalStore 用 Object.is 比较，
 * 路由其它状态（pending / search）变化时不会让调用方重渲染。
 * 供只需要 pathname 的组件替代 useRouterState({ select: s => s.location.pathname })。
 */
export function usePathname(): string {
	ensureHistoryPatched();
	const initialPath = React.useContext(NavPathContext);
	return React.useSyncExternalStore(
		subscribeLocation,
		() => snapshot.pathname,
		() => getServerSnapshot(initialPath).pathname,
	);
}

export function useRouterState<T = RouterState>(options?: { select?: (state: RouterState) => T }): T {
	const location = useLocationSnapshot();
	const isNavigating = useNavigationPending();
	const state: RouterState = {
		status: isNavigating ? "pending" : "idle",
		isLoading: isNavigating,
		location: {
			pathname: location.pathname,
			search: parseSearch(location.searchStr),
			searchStr: location.searchStr,
			hash: location.hash,
			href: location.href,
		},
		matches: buildMatches(location.pathname),
	};
	return options?.select ? options.select(state) : (state as unknown as T);
}

export function useMatches() {
	const location = useLocationSnapshot();
	return buildMatches(location.pathname);
}

export function useLocation() {
	const location = useLocationSnapshot();
	return {
		pathname: location.pathname,
		search: parseSearch(location.searchStr),
		searchStr: location.searchStr,
		hash: location.hash,
		href: location.href,
		state: undefined as unknown,
		key: "",
	};
}

export function useNavigate(_options?: { from?: string } | string) {
	const navigateFurin = useFurinNavigate();
	return React.useCallback(
		(target?: LegacyTarget | string) => {
			const options: LegacyTarget = typeof target === "string" ? { to: target } : { ...(target ?? {}) };
			// TanStack allows navigate({ search }) on the current route; Furin needs a target.
			if (!options.to) {
				if (options.search === undefined && options.hash === undefined) return Promise.resolve();
				options.to = snapshot.pathname;
			}
			if (/^(https?:|mailto:|tel:|\/\/)/.test(options.to)) {
				if (typeof window !== "undefined") window.location.assign(options.to);
				return Promise.resolve();
			}
			markNavigationPending();
			const run = () =>
				navigateFurin({
					to: toFurinPattern(options.to as string),
					params: options.params,
					search: normalizeSearch(options.search),
					hash: options.hash === undefined ? undefined : String(options.hash),
					replace: options.replace,
					resetScroll: options.resetScroll,
				} as never);
			// 同页筛选/排序等高频交互显式要求不要整页快照（viewTransition: false）
			if (options.viewTransition === false) {
				return Promise.resolve(run()).catch(() => undefined) as unknown as Promise<void>;
			}
			return runViewTransition(run) as unknown as Promise<void>;
		},
		[navigateFurin],
	);
}

export function useRouter() {
	const navigate = useNavigate();
	const router = useFurinRouter() as unknown as {
		refresh?: (options?: unknown) => Promise<void>;
		prefetch?: (options: unknown) => Promise<void> | void;
	};
	const prefetch = React.useCallback(
		(target: LegacyTarget) => {
			if (!target?.to || !router?.prefetch) return Promise.resolve();
			return Promise.resolve(
				router.prefetch({
					to: toFurinPattern(target.to),
					params: target.params,
					search: normalizeSearch(target.search),
				}),
			);
		},
		[router],
	);
	return React.useMemo(
		() => ({
			navigate,
			invalidate: (_options?: unknown) => {
				markNavigationPending();
				return router?.refresh?.() ?? Promise.resolve();
			},
			preloadRoute: prefetch,
			buildLocation: (target: LegacyTarget) => ({ href: buildHref(target), publicHref: buildHref(target) }),
			history: {
				back: () => window.history.back(),
				forward: () => window.history.forward(),
				go: (delta: number) => window.history.go(delta),
				push: (href: string) => window.history.pushState({}, "", href),
				replace: (href: string) => window.history.replaceState({}, "", href),
				location: snapshot,
			},
			options: { context: { queryClient: undefined } },
			state: {
				location: { pathname: snapshot.pathname, search: parseSearch(snapshot.searchStr), href: snapshot.href },
				matches: buildMatches(snapshot.pathname),
			},
			subscribe: () => () => undefined,
		}),
		[navigate, prefetch, router],
	);
}

export function useSearch<T = any>(options?: { from?: string; strict?: boolean }): T {
	const pattern = resolvePattern(options?.from);
	const [search] = useFurinSearch(pattern as never);
	return search as T;
}

export function useParams(options?: { from?: string; select?: (params: any) => any; [extra: string]: unknown }): any {
	const pattern = resolvePattern(options?.from);
	const api = furinGetRouteApi(pattern as never) as { useParams: () => Record<string, string> };
	const params = api.useParams();
	return options?.select ? options.select(params) : params;
}

export function getRouteApi(legacyId: string) {
	const pattern = resolvePattern(legacyId);
	const api = furinGetRouteApi(pattern as never) as {
		useLoaderData: <T = Record<string, unknown>>() => T;
		useParams: () => Record<string, string>;
	};
	return {
		useLoaderData: <T = any>() => api.useLoaderData<T>(),
		useParams: () => api.useParams(),
		useSearch: <T = any>() => useSearch<T>({ from: legacyId }),
		useRouteContext: () => ({} as Record<string, unknown>),
		useNavigate: () => useNavigate(),
	};
}

export const Outlet = () => null;

export function redirect(target: LegacyTarget): never {
	throw new Response(null, { status: 302, headers: { location: buildHref(target) } });
}

export function isRedirect(error: unknown): error is Response {
	return (
		error instanceof Response &&
		(error.status === 302 || error.status === 303 || error.status === 307 || error.status === 308)
	);
}

export type LinkProps = LegacyTarget & {
	className?: string;
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

const FurinLinkAny = FurinLink as any;

export const Link = React.forwardRef<HTMLAnchorElement, any>(function Link(props: any, ref) {
	const { to, params, search, hash, replace, resetScroll, activeProps, inactiveProps, onClick, preload, ...rest } = props;
	const navigate = useNavigate();
	const navigateRef = React.useRef(navigate);
	navigateRef.current = navigate;
	const pattern = toFurinPattern(String(to ?? "/"));
	const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
		onClick?.(event);
		if (event.defaultPrevented) return;
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		markNavigationPending();
	};
	return (
		<FurinLinkAny
			ref={ref}
			to={pattern as never}
			params={params as never}
			search={normalizeSearch(search) as never}
			hash={hash === undefined ? undefined : String(hash)}
			replace={replace}
			resetScroll={resetScroll}
			preload={preload}
			activeProps={activeProps as never}
			inactiveProps={inactiveProps as never}
			onClick={handleClick}
			{...(rest as Record<string, unknown>)}
		>
			{props.children as React.ReactNode}
		</FurinLinkAny>
	);
});

export type RegisteredRouter = ReturnType<typeof useRouter>;

export function Await({
	promise,
	resolve,
	fallback = null,
	errorElement,
	children,
}: {
	promise?: unknown;
	resolve?: unknown;
	fallback?: React.ReactNode;
	errorElement?: React.ReactNode;
	children: (value: any) => React.ReactNode;
}) {
	const target = (resolve ?? promise) as never;
	return (
		<React.Suspense fallback={fallback}>
			<FurinAwait resolve={target} errorElement={errorElement as never}>
				{(value: any) => children(value)}
			</FurinAwait>
		</React.Suspense>
	);
}