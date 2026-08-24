import { createFileRoute } from "@tanstack/react-router";

// `server: { handlers }` 是 TanStack Start 运行时支持的 API 路由选项，
// 但框架类型未收录（1.168.42），实测运行正常，此处显式放宽类型。
export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: () => Response.json({ ok: true }),
		},
	},
} as unknown as Parameters<typeof createFileRoute<"/api/health">>[0]);
