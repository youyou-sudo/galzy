import { createFileRoute } from "@tanstack/react-router";
import { proxyFetch } from "@web/lib/proxy-fetch";

const API_BASE = process.env.API_HOST;

/**
 * 透传富文本图片上传请求到 api 项目 /media/uploadimage
 * 使用 ReadableStream 流式转发 body，前端可借此计算上传进度
 */
async function uploadImageProxy(request: Request) {
	const targetUrl = `${API_BASE}/media/uploadimage`;
	return proxyFetch(targetUrl, request, 60_000);
}

export const Route = createFileRoute("/api/upload-image/")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) =>
				uploadImageProxy(request),
		},
	},
} as unknown as Parameters<typeof createFileRoute<"/api/upload-image/">>[0]);
