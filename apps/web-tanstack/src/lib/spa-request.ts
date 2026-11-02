/**
 * 判断一次请求是不是 Furin 的「SPA 导航数据请求」。
 *
 * 客户端切页时 Furin 不会请求整页 HTML，而是请求 `<页面 URL>?_furin=data`
 * （静态导出是 `<页面>/__furin_data.ndjson`），服务端为这一条请求**重跑整条
 * loader 链**（root → 目录 `_route` → 页面），把结果序列化成 NDJSON 回客户端。
 *
 * 关键差异：
 * - **文档请求**（首屏 / 刷新 / 直接访问 / 前进后退）：必须走完整 SSR，
 *   loader 里的鉴权与首屏数据都有意义；
 * - **数据请求**（站内切页）：只要把「页面壳」交给客户端即可，任何
 *   `web → API → DB` 的取数都会变成切页的等待时间。后台的会话校验、广告位、
 *   列表首屏数据都属于这一类，应当只在文档请求时执行。
 *
 * ⚠️ 不能直接看 loader 拿到的 `request.url`：Furin 在路由前会先剥掉
 * `_furin=data`（`@teyik0/furin` 的 `stripNavigationDataRequest`），loader 里
 * 看到的是「干净」的页面 URL。原始请求只存在于 `server.ts` 的 Elysia
 * `onRequest` 写进 AsyncLocalStorage 的那一份里（见 `@web/lib/request-context`）。
 * 这里用同一个 `Symbol.for` 键去读那个实例，避免把 `node:async_hooks`
 * 拖进浏览器包（页面模块也会被客户端打包）。
 *
 * 参考：`@teyik0/furin` 的 `src/shared/navigation-data.ts`、
 * `src/server/router/dispatch.ts#createRequestScope`。
 */
const SPA_DATA_MARKER = "_furin";
const STATIC_DATA_SUFFIX = "__furin_data.ndjson";

/** 与 `lib/request-context.ts` 共用同一把 globalThis 键（dev 双模块图也只有一个实例）。 */
const REQUEST_CONTEXT_KEY = Symbol.for("galzy.request-context.v1");

type RequestStore = { request?: Request };
type RequestStorage = { getStore: () => RequestStore | undefined };

function rawRequest(): Request | undefined {
	const storage = (globalThis as Record<symbol, unknown>)[
		REQUEST_CONTEXT_KEY
	] as RequestStorage | undefined;
	try {
		return storage?.getStore()?.request;
	} catch {
		// 没在请求上下文里（构建期 / 单元测试）时按文档请求处理
		return undefined;
	}
}

function hasDataMarker(url: URL): boolean {
	if (url.searchParams.has(SPA_DATA_MARKER)) return true;
	return url.pathname.endsWith(STATIC_DATA_SUFFIX);
}

/**
 * @param request loader 里的 `request`（已被 furin 剥掉标记，仅作兜底）
 */
export function isSpaDataRequest(request?: Request): boolean {
	const raw = rawRequest();
	if (raw) {
		try {
			return hasDataMarker(new URL(raw.url));
		} catch {
			// fallthrough to the request argument
		}
	}
	if (!request) return false;
	try {
		return hasDataMarker(new URL(request.url));
	} catch {
		return false;
	}
}

/**
 * 只在文档请求上执行的 loader 取数。
 *
 * 页面 loader 用它包住「首屏数据」：SSR 首屏照旧带着数据进水合，
 * 站内切页则返回 `null`，由页面组件里的 TanStack Query 在客户端按需加载
 * （命中缓存就直接渲染），从而把「切页」和「等数据」解耦。
 *
 * 页面侧写法：
 * ```ts
 * .loader(async ({ request }) => ({
 *   items: await documentOnly(request, () => listQuery.queryFn()),
 * }))
 * ```
 * 组件里 `items` 为 `null` 时不要 seed 缓存，让 `useQuery` 自己取即可。
 */
export async function documentOnly<T>(
	request: Request | undefined,
	load: () => Promise<T>,
): Promise<T | null> {
	if (isSpaDataRequest(request)) return null;
	return load();
}
