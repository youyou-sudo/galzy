import { MarkdownAsync } from "@web/components/markdownAync";
import { Card, CardContent } from "@web/components/ui/card";
import openapiDoc from "@web/markdown/openapi.md?raw";

export default function RouteComponent() {
	return (
		<Card>
			<CardContent className="space-y-6 px-3">
				<MarkdownAsync readmedata={openapiDoc} />
			</CardContent>
		</Card>
	);
}
