import { api } from "@libs";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/search")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const { searchParams } = new URL(request.url);
				const q = searchParams.get("q");
				if (!q) {
					return new Response("喵喵什么都不知道喵，请提供搜索关键词喵～", {
						status: 400,
					});
				}
				const { data, error } = await api.search.get({
					query: { q, limit: 100 },
				});
				if (error) {
					// Eden 不 throw：API 故障/网络错误都落在 error 上，必须显式处理，
					// 否则 200+null 会被 CDN 缓存成"空结果"。
					return new Response(JSON.stringify({ message: "搜索服务出错喵~" }), {
						status: 502,
						headers: { "content-type": "application/json" },
					});
				}
				return Response.json(data, {
					headers: {
						"Cache-Control": "public, max-age=300, stale-while-revalidate=600",
						"CDN-Cache-Control": "max-age=3600", // Cloudflare-specific
					},
				});
			},
		},
	},
} as unknown as Parameters<typeof createFileRoute<"/api/search">>[0]);
