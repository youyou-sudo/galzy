import { createFileRoute } from "@tanstack/react-router";
import { MarkdownAsync } from "#/components/markdownAync";
import { Card, CardContent } from "#/components/ui/card";
import { seoTemplate } from "#/config/seoTemplate";
import openapiDoc from "#/markdown/openapi.md?raw";

export const Route = createFileRoute("/openapi")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: `API 文档 | ${seoTemplate.title}`,
			},
		],
	}),
});

function RouteComponent() {
	return (
		<Card>
			<CardContent className="space-y-6 px-3">
				<MarkdownAsync readmedata={openapiDoc} />
			</CardContent>
		</Card>
	);
}
