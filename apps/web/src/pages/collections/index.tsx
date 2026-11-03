import { defineRoute } from "@teyik0/furin";
import { CollectionItem } from "@web/components/home/collection-card";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import { EmptyState } from "@web/components/shared/empty-state";
import { PageHeader } from "@web/components/shared/page-header";
import { Pagination } from "@web/components/shared/pagination";
import { Button } from "@web/components/ui/button";
import { seoTemplate } from "@web/config/seoTemplate";
import { Link } from "@web/lib/nav";
import { seoMeta } from "@web/lib/seo";
import { getCollectionsWithPreview } from "@web/server/collections";
import { Library } from "lucide-react";
import * as z from "zod/mini";

const PAGE_SIZE = 30;

/** getCollectionsWithPreview 的返回形状（BFF 侧类型收敛为 unknown，这里显式定型） */
type CollectionsResult = {
	items: any[];
	total: number;
	limit: number;
};

const searchSchema = z.object({
	// TanStack 默认把 URL 值 JSON.parse 成数字；furin 保留字符串，用 coerce 对齐
	page: z.catch(z.coerce.number(), 1),
});

export const route = defineRoute("/collections")
	.config({ mode: "ssr", query: searchSchema })
	.loader(async ({ query }) => {
		const collections = (await getCollectionsWithPreview({
			data: { page: query.page, limit: PAGE_SIZE, previewLimit: 4 },
		})) as CollectionsResult | null;
		return { collections, page: query.page };
	})
	.head(() =>
		seoMeta({
			title: `游戏合集 | ${seoTemplate.title}`,
			description:
				"GalZY 精选游戏合集：官方中文、经典名作、会社作品集等主题合集，一次发现更多好游戏。",
			path: "/collections",
		}),
	)
	.page(({ collections, page }) => (
		<CollectionsPage collections={collections} page={page} />
	));

function CollectionsBreadcrumb() {
	return (
		<Breadcrumb className="mb-4">
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					<BreadcrumbPage>合集</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}

function CollectionsPage({
	collections: result,
	page,
}: {
	collections: CollectionsResult | null;
	page: number;
}) {
	const items = result?.items ?? [];
	const total = Number(result?.total ?? 0);
	const totalPages = Math.max(1, Math.ceil(total / (result?.limit ?? PAGE_SIZE)));

	return (
		<div>
			<CollectionsBreadcrumb />

			<PageHeader
				icon={Library}
				title="精选合集"
				description="编辑精选的主题合集，一次发现更多好游戏"
				meta={`共 ${total} 个合集`}
			/>

			{items.length > 0 ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
					{items.map((col) => (
						<CollectionItem key={col.id} collection={col} />
					))}
				</div>
			) : (
				<EmptyState
					icon={Library}
					title="暂无合集"
					description="还没有创建任何合集，先去逛逛全部游戏吧"
					action={
						<Button variant="outline" size="sm" render={<Link to="/games" />}>
							浏览全部游戏
						</Button>
					}
				/>
			)}

			<Pagination
				page={page}
				totalPages={totalPages}
				renderLink={(nextPage) => (
					<Link to="/collections" search={{ page: nextPage }} />
				)}
			/>
		</div>
	);
}
