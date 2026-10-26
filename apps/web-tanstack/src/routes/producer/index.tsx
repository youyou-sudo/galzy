import { createFileRoute, Link } from "@tanstack/react-router";
import ProducersPage from "@web/components/producer/producers-page";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import { PageHeader } from "@web/components/shared/page-header";
import { Skeleton } from "@web/components/ui/skeleton";
import { seoTemplate } from "@web/config/seoTemplate";
import { seoMeta } from "@web/lib/seo";
import { getSearchProducers } from "@web/server/producer";
import { Building2Icon } from "lucide-react";
import * as z from "zod/mini";

const producerSearchSchema = z.object({
	q: z.optional(z.string()),
	page: z.catch(z.optional(z._default(z.number(), 1)), 1),
});

const PAGE_SIZE = 24;

export const Route = createFileRoute("/producer/")({
	pendingComponent: () => <ProducerListPending />,
	component: () => {
		const { producers, q, page } = Route.useLoaderData();
		return (
			<div>
				<ProducerBreadcrumb />
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
					page={page ?? 1}
				/>
			</div>
		);
	},
	validateSearch: producerSearchSchema,
	loaderDeps: ({ search: { q, page } }) => ({ q, page }),
	loader: async ({ deps, context }) => {
		return {
			// ensureQueryData 缓存（key 与下方一致）：返回列表时直接命中 query
			// 缓存渲染，不重新请求（与 games/tags 列表页同一模式）
			producers: await context.queryClient.ensureQueryData({
				queryKey: ["searchProducers", deps.q ?? "", deps.page ?? 1],
				queryFn: () =>
					getSearchProducers({
						data: { q: deps.q, page: deps.page, hitsPerPage: PAGE_SIZE },
					}),
				staleTime: 30_000,
				gcTime: 5 * 60_000,
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
		Vary: "Accept, Accept-Encoding",
	}),
	staleTime: 1000 * 30,
});

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

/** 路由 pending：面包屑/页头是真实外壳，搜索框与卡片网格出骨架 */
function ProducerListPending() {
	return (
		<div>
			<ProducerBreadcrumb />
			<PageHeader
				icon={Building2Icon}
				title="厂商检索"
				description="按厂商 / 开发会社浏览收录的作品"
			/>
			<div className="mb-4 w-full sm:max-w-md">
				<Skeleton className="w-full h-9 rounded-xl" />
			</div>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
				{[0, 1, 2, 3, 4, 5].map((i) => (
					<Skeleton key={i} className="w-full h-24 rounded-2xl" />
				))}
			</div>
		</div>
	);
}
