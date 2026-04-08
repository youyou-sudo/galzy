import { createFileRoute } from "@tanstack/react-router";

const API_BASE = process.env.API_HOST;

async function proxy(request: Request) {
	const url = new URL(request.url);

	const targetUrl = `${API_BASE}${url.pathname}${url.search}`;

	const res = await fetch(targetUrl, {
		method: request.method,
		headers: request.headers,
		body:
			request.method !== "GET" && request.method !== "HEAD"
				? await request.text()
				: undefined,
	});

	return new Response(res.body, {
		status: res.status,
		headers: res.headers,
	});
}

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => proxy(request),
			POST: ({ request }) => proxy(request),
		},
	},
});
