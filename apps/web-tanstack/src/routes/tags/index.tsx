import { createFileRoute, Link } from "@tanstack/react-router";
import TagsPage from "@web/components/tags/tags-page";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/ui/breadcrumb";
import { Skeleton } from "@web/components/ui/skeleton";
import { seoTemplate } from "@web/config/seoTemplate";
import { getSearchTags, getTagCategories } from "@web/server/tags";
import { z } from "zod";
import { object, string } from "zod/schemas";

export const TagsSearchSchema = object({
	q: string().optional(),
	cat: z.enum(["all", "cont", "ero", "tech"]).optional().default("all"),
	sort: z.enum(["views", "nameAsc", "nameDesc"]).optional().default("views"),
});

export const Route = createFileRoute("/tags/")({
	component: () => {
		const { q } = Route.useLoaderData();
		const { cat, sort } = Route.useSearch();
		return (
			<div>
				<Breadcrumb className="mb-4">
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>标签</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<TagsPage q={q} cat={cat} sort={sort} />
			</div>
		);
	},
	validateSearch: TagsSearchSchema,
	loaderDeps: ({ search: { q } }) => ({ q: q?.trim() }),
	loader: async ({ deps, context }) => {
		const q = deps.q ?? "";
		await Promise.all([
			context.queryClient.ensureQueryData({
				queryKey: ["tagCategories"],
				queryFn: () => getTagCategories(),
				staleTime: 5 * 60_000,
			}),
			q
				? context.queryClient.ensureQueryData({
						queryKey: ["searchTags", q],
						queryFn: () => getSearchTags({ data: { q, limit: 200 } }),
						staleTime: 30_000,
					})
				: Promise.resolve(),
		]);
		return { q: q || undefined };
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `标签检索${loaderData?.q ? ` - ${loaderData.q}` : ""} | ${seoTemplate.title}`,
			},
			{
				name: "description",
				content: loaderData?.q
					? `搜索标签"${loaderData.q}"，浏览相关游戏标签`
					: `按剧情、性爱、技术分类浏览游戏标签，每个标签展示收录的游戏数量`,
			},
		],
	}),
	headers: () => ({
		"Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
		"Cache-Tag": "page-tags",
		Vary: "Accept, Accept-Encoding",
	}),
	pendingComponent: () => <TagsPageSkeleton />,
	staleTime: 1000 * 30,
});

const SKELETON_KEYS = Array.from({ length: 12 }, (_, i) => i);

function TagsPageSkeleton() {
	return (
		<div className="max-w-5xl mx-auto py-3 px-0 sm:px-3 flex flex-col gap-8">
			<div className="text-center flex flex-col items-center gap-1.5">
				<Skeleton className="h-7 w-40" />
				<Skeleton className="h-4 w-56" />
			</div>
			<Skeleton className="h-10 w-full md:w-1/2 mx-auto" />
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
				{SKELETON_KEYS.map((k) => (
					<Skeleton key={k} className="h-10 rounded-lg" />
				))}
			</div>
		</div>
	);
}
