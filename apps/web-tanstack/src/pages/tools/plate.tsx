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
import PlatePage from "@web/components/tools/plate-page";
import { seoTemplate } from "@web/config/seoTemplate";

export const route = defineRoute("/tools/plate")
	.config({ mode: "ssr" })
	.head(() => ({
		meta: [
			{ title: `车牌号跳转工具 | ${seoTemplate.title}` },
			{
				name: "description",
				content:
					"输入车牌号，快速跳转到 nhentai、禁漫天堂、Hitomi.la、Pixiv 等网站喵～",
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
	));
