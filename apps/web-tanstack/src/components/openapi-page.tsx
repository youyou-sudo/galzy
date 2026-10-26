import { MarkdownAsync } from "@web/components/markdownAync";
import { PageHeader } from "@web/components/shared/page-header";
import { Card, CardContent } from "@web/components/ui/card";
import openapiDoc from "@web/markdown/openapi.md?raw";
import { Code2 } from "lucide-react";

export default function RouteComponent() {
	return (
		<section className="py-6 mx-auto w-full max-w-4xl">
			<PageHeader
				icon={Code2}
				title="Open API"
				description="公开数据接口与调用说明，欢迎接入 GalZY 的数据"
			/>
			<Card>
				<CardContent className="px-4 py-2 space-y-6 sm:px-6">
					<MarkdownAsync readmedata={openapiDoc} />
				</CardContent>
			</Card>
		</section>
	);
}
