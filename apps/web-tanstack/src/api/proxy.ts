import { proxyFetch } from "@web/lib/proxy-fetch";
import { Elysia } from "elysia";

const API_BASE = process.env.API_HOST ?? "http://localhost:3001";

/**
 * Streamed proxies to the Elysia API, ported from the former
 * src/routes/api/* request handlers.
 */
export const proxyApi = new Elysia({ prefix: "/api" })
	.get("/health", {}, () => Response.json({ ok: true }))
	.all("/auth/*", {}, async ({ request }) => {
		const url = new URL(request.url);
		const targetUrl = API_BASE + url.pathname.replace("/api", "") + url.search;
		return proxyFetch(targetUrl, request, 30_000);
	})
	.post("/upload", {}, async ({ request }) => {
		return proxyFetch(API_BASE + "/media/uploadavatar", request, 60_000);
	})
	.post("/upload-image", {}, async ({ request }) => {
		return proxyFetch(API_BASE + "/media/uploadimage", request, 60_000);
	});
