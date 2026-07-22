import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { seoTemplate } from "@web/config/seoTemplate";

const OpenapiPage = lazy(() => import("@web/components/openapi-page"));

export const Route = createFileRoute("/openapi")({
	component: () => (
		<Suspense fallback={<div>加载中...</div>}>
			<OpenapiPage />
		</Suspense>
	),
	head: () => ({
		meta: [
			{
				title: `API 文档 | ${seoTemplate.title}`,
			},
		],
	}),
	headers: () => ({
		// Cache at CDN for 1 hour, allow stale content for up to 1 day
		"Cache-Control":
			"public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
	}),
});
