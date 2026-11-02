import { furin } from "@teyik0/furin";
import { api } from "@web/api";
import { purgeCdnPaths } from "@web/lib/isr/cdn-purge";
import { startIsrInvalidation } from "@web/lib/isr/invalidate";
import { createPageCache } from "@web/lib/isr/page-cache";
import { enterRequestContext } from "@web/lib/request-context";
import { Elysia } from "elysia";

export const port = Number(process.env.PORT ?? 3000);

/**
 * Container healthcheck entry used by the Dockerfile (the runtime image has no
 * shell or curl). Mirrors the previous Nitro binary healthcheck contract,
 * including Dokploy existing "healthcheck" spelling.
 */
const HEALTHCHECK =
	process.argv.includes("--healthcheck") ||
	process.argv.includes("healthcheck");

if (HEALTHCHECK) {
	const response = await fetch(
		"http://127.0.0.1:" + String(port) + "/api/health",
	).catch(() => null);
	process.exit(response?.ok ? 0 : 1);
}

/**
 * Furin server entry: Elysia owns HTTP, Furin owns pages.
 *
 * 请求上下文必须在这里抓，而不是 Elysia 的 `onRequest`：
 * furin 在路由之前会先剥掉 SPA 导航标记（`?_furin=data`，见
 * `src/server/router/dispatch.ts#createRequestScope`），而它的 `.wrap()`
 * 比应用级 `onRequest` 更靠外——`onRequest` 拿到的已经是剥干净的页面 URL。
 * 用 `.wrap()` 把捕获放在最外层，`@web/lib/spa-request` 才能分辨
 * 「文档请求」和「站内切页数据请求」（后台切页不重跑鉴权/首屏取数全靠它）。
 */
const app = new Elysia()
	.wrap((fetch) => (request: Request, ...rest: any[]) => {
		// 捕获原始 Request（含 `_furin=data`）后原样转交给下游 fetch
		enterRequestContext(request);
		return fetch(request, ...rest);
	})
	.use(api)
	.use(
		await furin({
			pagesDir: "./src/pages",
			// 用户视图（ISR）的页面产物落 Redis：多副本共享、重启不丢
			pageCache: createPageCache(),
			// 页面缓存失效后，同步清理 CDN（Cloudflare）上的对应 URL
			cachePurger: purgeCdnPaths,
		}),
	);

let stopIsrInvalidation: (() => void) | undefined;

/**
 * 启动 HTTP 服务 + 缓存失效订阅。
 *
 * 生产构建由 furin 生成的入口调用（`serverEntry` 契约：导出 `startServer` /
 * `onShutdown` / `port`）；开发模式由 `import.meta.main` 调用。不能只写在
 * `import.meta.main` 里——构建产物是被入口 import 的模块，那里它是 false。
 */
export async function startServer(): Promise<void> {
	if (app.server) return;
	const instance = app.listen({
		port,
		hostname: process.env.HOST ?? "0.0.0.0",
	});
	// 订阅 API 的缓存失效消息（Redis）：删 ISR 页面产物，并把失效 URL 回传给 API 清 CDN
	stopIsrInvalidation = await startIsrInvalidation();
	console.log(
		"[web] furin server listening on http://localhost:" +
			String(instance.server?.port),
	);
}

/** 优雅退出：先退订，再停服务（furin 入口在 SIGTERM 时调用）。 */
export async function onShutdown(): Promise<void> {
	stopIsrInvalidation?.();
	stopIsrInvalidation = undefined;
	await app.stop();
}

if (import.meta.main) {
	await startServer();
}

export type App = typeof app;
export default app;
