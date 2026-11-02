import { defineRoute } from "@teyik0/furin";
import ProducersPage from "@web/components/producer/producers-page";
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
import { getSearchProducers } from "@web/server/producer";
import * as z from "zod/mini";

const producerSearchSchema = z.object({
	q: z.optional(z.string()),
	// TanStack 默认把 URL 值 JSON.parse 成数字；furin 保留字符串，用 coerce 对齐
	page: z._default(z.optional(z.catch(z.coerce.number(), 1)), 1),
});

const PAGE_SIZE = 24;

/** getSearchProducers 的返回形状（BFF 侧类型收敛为 unknown，这里显式定型） */
type ProducerHit = {
	id: string;
	name: string | null;
	latin: string | null;
	original: string | null;
	alias: string | null;
	type: string | null;
	lang: string | null;
	description: string | null;
};

type ProducersResult = {
	hits: ProducerHit[];
	totalHits: number;
	totalPages: number;
	page: number;
	hitsPerPage: number;
};

export const route = defineRoute("/producer")
	.config({ mode: "isr", revalidate: 300, query: producerSearchSchema, tags: ["page-producers"] })
	.loader(async ({ query }) => {
		const producers = (await getSearchProducers({
			data: { q: query.q, page: query.page, hitsPerPage: PAGE_SIZE },
		})) as ProducersResult | null;
		return { producers, q: query.q, page: query.page };
	})
	.head(
		({ producers, q }) =>
			seoMeta({
				title: `厂商检索 - ${q || "全部厂商"} | ${seoTemplate.title}`,
				description: `按厂商 / 开发会社浏览 GalZY 收录的 Galgame 作品，当前${q ? `搜索"${q}"` : "查看全部厂商"}，共 ${producers?.totalHits || 0} 个厂商。`,
				path: "/producer",
			}) as unknown as never,
	)
	.page(({ producers, q, page }) => (
		<div>
			<ProducerBreadcrumb />
			<ProducersPage producers={producers} q={q} page={page} />
		</div>
	));

function ProducerBreadcrumb() {
	return (
		<Breadcrumb className="mb-4">
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					<BreadcrumbPage>厂商</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}
