import { createFileRoute } from "@tanstack/react-router";
import OpenapiPage from "@web/components/openapi-page";
import { seoTemplate } from "@web/config/seoTemplate";

export const Route = createFileRoute("/openapi")({
	component: OpenapiPage,
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
