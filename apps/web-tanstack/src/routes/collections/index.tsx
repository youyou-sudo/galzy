import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CollectionItem,
	CollectionItemSkeleton,
} from "@web/components/home/collection-card";
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
import { Skeleton } from "@web/components/ui/skeleton";
import { seoTemplate } from "@web/config/seoTemplate";
import { seoMeta } from "@web/lib/seo";
import { getCollectionsWithPreview } from "@web/server/collections";
import { Library } from "lucide-react";
import * as z from "zod/mini";

const PAGE_SIZE = 30;

const searchSchema = z.object({
	page: z.catch(z.number(), 1),
});

export const Route = createFileRoute("/collections/")({
	head: () =>
		seoMeta({
			title: `游戏合集 | ${seoTemplate.title}`,
			description:
				"GalZY 精选游戏合集：官方中文、经典名作、会社作品集等主题合集，一次发现更多好游戏。",
			path: "/collections",
		}),
	validateSearch: searchSchema,
	loaderDeps: ({ search: { page } }) => ({ page }),
	loader: async ({ deps: { page } }) => {
		return getCollectionsWithPreview({
			data: { page, limit: PAGE_SIZE, previewLimit: 4 },
		});
	},
	headers: () => ({
		"Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
		"Cache-Tag": "page-collections",
	}),
	component: RouteComponent,
	pendingComponent: () => <CollectionsPageSkeleton />,
});

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

function CollectionsPageSkeleton() {
	return (
		<div>
			<CollectionsBreadcrumb />

			{/* 与真实页同一套 PageHeader 外壳：计数位置先占一个词宽骨架 */}
			<PageHeader
				icon={Library}
				title="精选合集"
				description="编辑精选的主题合集，一次发现更多好游戏"
				meta={<Skeleton className="h-4 w-16" />}
			/>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{Array.from({ length: 12 }).map((_, i) => (
					<CollectionItemSkeleton key={i} />
				))}
			</div>
		</div>
	);
}

function RouteComponent() {
	const { page } = Route.useSearch();
	const initialData = Route.useLoaderData();

	const { data: result } = useSuspenseQuery({
		queryKey: ["collections", page],
		queryFn: () =>
			getCollectionsWithPreview({
				data: { page, limit: PAGE_SIZE, previewLimit: 4 },
			}),
		initialData,
		staleTime: 5 * 60_000,
	});

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
