import { furin } from "@teyik0/furin";
import { api } from "@web/api";
import { applyCdnCacheHeaders } from "@web/lib/cdn-cache";
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
 * 页面一律 SSR：源站不接页面缓存后端、不订阅缓存失效频道，每次请求都实时渲染
 * （见 `pages/root.tsx` 的注释）。公开页面由 CDN 边缘缓存，响应头在下面的
 * `.wrap()` 里按路径改写（见 `lib/cdn-cache.ts`）；评论/后台/用户中心保持 no-store。
 *
 * 请求上下文必须在这里抓，而不是 Elysia 的 `onRequest`：
 * furin 在路由之前会先剥掉 SPA 导航标记（`?_furin=data`，见
 * `src/server/router/dispatch.ts#createRequestScope`），而它的 `.wrap()`
 * 比应用级 `onRequest` 更靠外——`onRequest` 拿到的已经是剥干净的页面 URL。
 * 用 `.wrap()` 把捕获放在最外层，`@web/lib/spa-request` 才能分辨
 * 「文档请求」和「站内切页数据请求」（后台切页不重跑鉴权/首屏取数全靠它）。
 */
const app = new Elysia()
	.wrap((fetch) => async (request: Request, ...rest: any[]) => {
		// 捕获原始 Request（含 `_furin=data`）后原样转交给下游 fetch
		enterRequestContext(request);
		const response = await fetch(request, ...rest);
		// 源站实时 SSR，但公开页面允许 CDN 边缘缓存：把 furin 的 no-store
		// 改写成 s-maxage（评论/后台/用户中心等保持 no-store）。
		return applyCdnCacheHeaders(request, response);
	})
	.use(api)
	.use(
		await furin({
			pagesDir: "./src/pages",
		}),
	);

/**
 * 启动 HTTP 服务。
 *
 * 生产构建由 furin 生成的入口调用（`serverEntry` 契约：导出 `startServer` /
 * `onShutdown` / `port`）；开发模式由 `import.meta.main` 调用。不能只写在
 * `import.meta.main` 里——构建产物是被入口 import 的模块，那里它是 false。
 */
/**
 * 让「本机自取」绕过 HTTP(S)_PROXY。
 *
 * Bun 的 fetch 会读 HTTP(S)_PROXY / NO_PROXY。开发模式下 furin 用
 * `server.url.origin` 自取 `/_bun_hmr_entry` 来拼文档模板；服务默认绑定
 * `0.0.0.0`，这条自取就变成了 `http://0.0.0.0:3000/_bun_hmr_entry`。
 * 本机代理（Clash / v2ray 等）无法路由 0.0.0.0，会返回 502，页面于是变成
 * 「/_bun_hmr_entry returned 502」的开发错误页 —— 改业务代码、刷新浏览器都
 * 不会好，只有关代理或重启服务才恢复。
 *
 * 所以在 listen 之前，把绑定地址与本机回环补进 NO_PROXY（大小写两套变量都写，
 * 不同运行环境读的键名不一致）。生产容器通常没有代理变量，加这几项也无副作用。
 */
function bypassProxyForLocalOrigins(hostname: string): void {
	const locals = ["localhost", "127.0.0.1", "0.0.0.0", hostname];
	for (const key of ["NO_PROXY", "no_proxy"] as const) {
		const entries = new Set(
			(process.env[key] ?? "")
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean),
		);
		for (const local of locals) entries.add(local);
		process.env[key] = [...entries].join(",");
	}
}

export async function startServer(): Promise<void> {
	if (app.server) return;
	const hostname = process.env.HOST ?? "0.0.0.0";
	bypassProxyForLocalOrigins(hostname);
	const instance = app.listen({
		port,
		hostname,
	});
	console.log(
		"[web] furin server listening on http://localhost:" +
			String(instance.server?.port),
	);
}

/** 优雅退出：停服务（furin 入口在 SIGTERM 时调用）。 */
export async function onShutdown(): Promise<void> {
	await app.stop();
}

if (import.meta.main) {
	await startServer();
}

export type App = typeof app;
export default app;
