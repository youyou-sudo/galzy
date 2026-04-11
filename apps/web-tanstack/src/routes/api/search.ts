import { api } from "@libs";
import { createFileRoute } from "@tanstack/react-router";
import { tryit } from "radash";

const getSearch = async ({ q, limit }: { q: string; limit: number }) => {
	const { data } = await api.search.get({
		query: { q: q, limit: limit || 100 },
	});
	return data;
};
export const Route = createFileRoute("/api/search")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const { searchParams } = new URL(request.url);
				const q = searchParams.get("q");
				if (!q) {
					return new Response("喵喵什么都不知道喵，请提供搜索关键词喵～", {
						status: 400,
					});
				}
				const [error, datas] = await tryit(getSearch)({ q, limit: 100 });
				if (error) {
					return new Response("服务出错了喵~", { status: 500 });
				}
				return Response.json(datas, {
					headers: {
						"Cache-Control": "public, max-age=300, stale-while-revalidate=600",
						"CDN-Cache-Control": "max-age=3600", // Cloudflare-specific
					},
				});
			},
		},
	},
});
