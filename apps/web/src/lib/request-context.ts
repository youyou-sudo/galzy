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
export type RequestContext = { request: Request };

const KEY = Symbol.for("galzy.request-context.v1");
const store = globalThis as unknown as Record<symbol, AsyncLocalStorage<RequestContext> | undefined>;

export const requestStorage: AsyncLocalStorage<RequestContext> =
	store[KEY] ??
	(() => {
		const created = new AsyncLocalStorage<RequestContext>();
		store[KEY] = created;
		return created;
	})();

/** Mark the current async chain as belonging to request. */
export function enterRequestContext(request: Request): void {
	requestStorage.enterWith({ request });
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
