import { defineRoute } from "@teyik0/furin";
import ProducerDetailPage from "@web/components/producer/producer-detail-page";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import { seoTemplate } from "@web/config/seoTemplate";
import { Link } from "@web/lib/nav";
import { seoMeta } from "@web/lib/seo";
import {
	type ProducerInfo,
	producerGameList,
	producerInfo,
} from "@web/server/producer";
import { t } from "elysia";

const paramsSchema = t.Object({ pid: t.String() });

export const route = defineRoute("/producer/[pid]")
	.config({ mode: "ssr", params: paramsSchema })
	.loader(async ({ params }) => {
		const { pid } = params;
		const [producer, gameList] = await Promise.all([
			producerInfo({ data: { pid } }),
			producerGameList({ data: { pid } }),
		]);
		// BFF 返回类型被收敛为 unknown，这里按页面实际消费的形状显式定型
		return {
			pid,
			producer: producer as ProducerInfo | null,
			gameList: gameList as unknown[] | null,
		};
	})
	.head(
		({ producer, params }) =>
			seoMeta({
				title: `${producer?.name || "厂商"} | ${seoTemplate.title}`,
				description: producer?.name
					? `${producer.name} 出品的全部 Galgame 作品与下载资源，尽在 GalZY。`
					: undefined,
				path: `/producer/${params.pid}`,
			}) as unknown as never,
	)
	.page(({ producer, pid }) => (
		<div>
			<Breadcrumb className="mb-4">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/producer" />}>
							厂商
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>{producer?.name || "厂商"}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<ProducerDetailPage producer={producer} pid={pid} />
		</div>
	));
