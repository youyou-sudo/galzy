import { createFileRoute, Link } from "@tanstack/react-router";
import ProducersPage from "@web/components/producer/producers-page";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/ui/breadcrumb";
import { seoTemplate } from "@web/config/seoTemplate";
import { seoMeta } from "@web/lib/seo";
import { getSearchProducers } from "@web/server/producer";
import { number, object, optional, string } from "zod/schemas";

const producerSearchSchema = object({
	q: string().optional(),
	page: optional(number().default(1)).catch(1),
});

const PAGE_SIZE = 24;

export const Route = createFileRoute("/producer/")({
	component: () => {
		const { producers, q, page } = Route.useLoaderData();
		return (
			<div>
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
				<ProducersPage
					producers={
						producers as
							| {
									hits: Array<{
										id: string;
										name: string | null;
										latin: string | null;
										original: string | null;
										alias: string | null;
										type: string | null;
										lang: string | null;
										description: string | null;
									}>;
									totalHits: number;
									totalPages: number;
									page: number;
									hitsPerPage: number;
							  }
							| null
							| undefined
					}
					q={q}
					page={page}
				/>
			</div>
		);
	},
	validateSearch: producerSearchSchema,
	loaderDeps: ({ search: { q, page } }) => ({ q, page }),
	loader: async ({ deps }) => {
		return {
			producers: await getSearchProducers({
				data: { q: deps.q, page: deps.page, hitsPerPage: PAGE_SIZE },
			}),
			q: deps.q,
			page: deps.page,
		};
	},
	head: ({ loaderData }) =>
		seoMeta({
			title: `厂商检索 - ${loaderData?.q || "全部厂商"} | ${seoTemplate.title}`,
			description: `按厂商 / 开发会社浏览 GalZY 收录的 Galgame 作品，当前${
				loaderData?.q ? `搜索"${loaderData.q}"` : "查看全部厂商"
			}，共 ${loaderData?.producers?.totalHits || 0} 个厂商。`,
			path: "/producer",
		}),
	headers: () => ({
		"Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
		"Cache-Tag": "page-producers",
		"Vary": "Accept, Accept-Encoding",
	}),
	staleTime: 1000 * 30,
});
