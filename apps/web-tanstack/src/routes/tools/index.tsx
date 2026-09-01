import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/ui/breadcrumb";
import ToolsPage from "@web/components/tools/tools-page";
import { seoTemplate } from "@web/config/seoTemplate";

export const Route = createFileRoute("/tools/")({
	component: () => (
		<div>
			<Breadcrumb className="mb-4">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>工具箱</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<ToolsPage />
		</div>
	),
	head: () => ({
		meta: [
			{ title: `工具箱 | ${seoTemplate.title}` },
			{
				name: "description",
				content: "实用工具合集 — 车牌号跳转、相关站点导航等 Galgame 常用工具",
			},
		],
	}),
});
