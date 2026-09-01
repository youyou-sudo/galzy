import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/ui/breadcrumb";
import PlatePage from "@web/components/tools/plate-page";
import { seoTemplate } from "@web/config/seoTemplate";

export const Route = createFileRoute("/tools/plate")({
	component: () => (
		<div>
			<Breadcrumb className="mb-4">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/tools" />}>工具箱</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>车牌号跳转工具</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<PlatePage />
		</div>
	),
	head: () => ({
		meta: [
			{ title: `车牌号跳转工具 | ${seoTemplate.title}` },
			{
				name: "description",
				content:
					"输入车牌号，快速跳转到 nhentai、禁漫天堂、Hitomi.la、Pixiv 等网站喵～",
			},
		],
	}),
});
