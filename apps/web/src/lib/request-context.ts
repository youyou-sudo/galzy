import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context for the BFF layer.
 *
 * Furin does not hand the current Request to createIsomorphicFn().server()
 * branches, but the ported BFF handlers (cookies, client IP, Better Auth
 * session) still need it. The Elysia onRequest hook stores the request here
 * with enterWith, which keeps the store for the rest of that request's async
 * chain while staying isolated between concurrent requests (verified in the
 * migration spike).
 *
 * The storage is registered on globalThis with a Symbol key because the dev
 * module graph can evaluate this module twice (route module + server entry),
 * which would otherwise create two independent stores.
 */
export type RequestContext = {
	request: Request;
	/**
	 * 请求作用域的临时 memo（同一次请求内的 single-flight 合并等）。
	 * 随 store 一起创建、随请求结束丢弃，**绝不跨请求复用**。
	 */
	scoped?: Map<symbol, unknown>;
};

const KEY = Symbol.for("galzy.request-context.v1");
const store = globalThis as unknown as Record<
	symbol,
	AsyncLocalStorage<RequestContext> | undefined
>;

export const requestStorage: AsyncLocalStorage<RequestContext> =
	store[KEY] ??
	(() => {
		const created = new AsyncLocalStorage<RequestContext>();
		store[KEY] = created;
		return created;
	})();

/** Mark the current async chain as belonging to request. */
export function enterRequestContext(request: Request): void {
	requestStorage.enterWith({ request, scoped: new Map() });
}

export function getRequest(): Request | undefined {
	return requestStorage.getStore()?.request;
}

export function getRequestHeader(name: string): string | undefined {
	return getRequest()?.headers.get(name) ?? undefined;
}

export function getClientIp(): string {
	const request = getRequest();
	if (!request) return "";
	return (
		request.headers.get("cf-connecting-ip") ??
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		""
	);
}

/**
 * 取当前请求作用域内的一个对象（没有则创建）。
 *
 * 只用于「同一次请求内复用」的临时状态（例如会话请求合并），请求结束即失效；
 * 没有请求上下文（构建期、进程外调用）时每次都新建，不做任何跨请求缓存。
 */
export function getRequestScoped<T>(key: symbol, create: () => T): T {
	const context = requestStorage.getStore();
	if (!context) return create();
	let scoped = context.scoped;
	if (!scoped) {
		scoped = new Map();
		context.scoped = scoped;
	}
	const existing = scoped.get(key) as T | undefined;
	if (existing !== undefined) return existing;
	const created = create();
	scoped.set(key, created);
	return created;
}
