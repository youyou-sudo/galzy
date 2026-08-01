import { createFileRoute } from "@tanstack/react-router";
import { proxyFetch } from "@web/lib/proxy-fetch";

const API_BASE = process.env.API_HOST;

async function proxy(request: Request) {
	const url = new URL(request.url);

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
