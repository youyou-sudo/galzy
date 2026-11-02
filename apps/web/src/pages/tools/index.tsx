import { defineRoute } from "@teyik0/furin";
import { Link } from "@web/lib/nav";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import ToolsPage from "@web/components/tools/tools-page";
import { seoTemplate } from "@web/config/seoTemplate";

export const route = defineRoute("/tools")
	.config({ mode: "isr", revalidate: 3600 })
	.head(() => ({
		meta: [
			{ title: `工具箱 | ${seoTemplate.title}` },
			{
				name: "description",
				content: "实用工具合集 — 车牌号跳转、相关站点导航等 Galgame 常用工具",
			},
		],
	}))
	.page(() => (
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
	));
