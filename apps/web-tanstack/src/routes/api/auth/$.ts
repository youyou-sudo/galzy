import { createFileRoute } from "@tanstack/react-router";
import { proxyFetch } from "@web/lib/proxy-fetch";

const API_BASE = process.env.API_HOST;

async function proxy(request: Request) {
	const url = new URL(request.url);

	// 纯透传：把前端 `/api/auth/*` 映射到后端 `/auth/*`。
	// OAuth 回调（成功 → Set-Cookie + 302 callbackURL；失败 → 302 errorURL）
	// 都以 `redirect: "manual"` 原样返回给浏览器，由浏览器跟随跳转，避免
	// 在服务端层面对 302 做任何改写，否则会把错误重定向拆成前后端循环。
	const targetUrl = `${API_BASE}${url.pathname.replace("/api", "")}${url.search}`;
	return proxyFetch(targetUrl, request, 30_000);
}

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => proxy(request),
			POST: async ({ request }: { request: Request }) => proxy(request),
		},
	},
});
