import { createFileRoute, Link } from "@tanstack/react-router";
import TagsPage, { TagsHubSkeleton } from "@web/components/tags/tags-page";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import { seoTemplate } from "@web/config/seoTemplate";
import { getSearchTags, getTagHub } from "@web/server/tags";
import { z } from "zod";
import { object, string } from "zod/schemas";

export const TagsSearchSchema = object({
	q: string().optional(),
	sort: z.enum(["nameAsc", "nameDesc"]).optional().default("nameAsc"),
});

export const Route = createFileRoute("/tags/")({
	component: () => {
		const { q, sort } = Route.useSearch();
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
				<TagsPage q={q} sort={sort} />
			</div>
		);
	},
	validateSearch: TagsSearchSchema,
	loaderDeps: ({ search: { q } }) => ({ q: q?.trim() }),
	loader: async ({ deps, context }) => {
		const q = deps.q ?? "";
		const pending: Array<Promise<unknown>> = [
			context.queryClient.ensureQueryData({
				queryKey: ["tagHub", "preview"],
				queryFn: () => getTagHub({ data: { limit: 48 } }),
				staleTime: 10 * 60_000,
			}),
		];
		if (q) {
			pending.push(
				context.queryClient.ensureQueryData({
					queryKey: ["searchTags", q],
					queryFn: () => getSearchTags({ data: { q, limit: 200 } }),
					staleTime: 30_000,
				}),
			);
		}
		if (typeof window === "undefined") {
			// SSR：等待数据，保证首屏直出与 query 脱水
			await Promise.all(pending);
		} else {
			// 客户端导航：不阻塞路由切换 —— await 会因 defaultPendingMs=60
			// 把整页换成 pendingComponent（全屏骨架）。输入关键词时加载态
			// 交给组件内 useQuery 的局部加载承担。
			void Promise.all(pending).catch(() => {});
		}
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
	pendingComponent: () => <TagsHubSkeleton />,
	staleTime: 1000 * 30,
});
