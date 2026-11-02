import { defineRoute } from "@teyik0/furin";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import TagsPage, { HUB_PREVIEW_LIMIT } from "@web/components/tags/tags-page";
import { seoTemplate } from "@web/config/seoTemplate";
import { Link } from "@web/lib/nav";
import { useSeedQueries } from "@web/lib/query-seed";
import {
	getSearchTags,
	getTagHub,
	TAG_ORDER_KEYS,
	TAG_SORT_KEYS,
} from "@web/server/tags";
import * as z from "zod/mini";

export const TagsSearchSchema = z.object({
	q: z.optional(z.string()),
	// 默认按总浏览量倒序：这是用户最常想看的「大家都在看什么」
	// catch：旧链接里的排序键（如已下线的 nameAsc）落到默认值，而不是整页 500
	sort: z._default(
		z.optional(z.catch(z.enum(TAG_SORT_KEYS), "views")),
		"views",
	),
	order: z._default(
		z.optional(z.catch(z.enum(TAG_ORDER_KEYS), "desc")),
		"desc",
	),
});

export const route = defineRoute("/tags")
	.config({ mode: "isr", revalidate: 120, query: TagsSearchSchema, tags: ["page-tags"] })
	.loader(async ({ query }) => {
		const q = query.q?.trim() ?? "";
		const [hub, searchTags] = await Promise.all([
			getTagHub({
				data: {
					limit: HUB_PREVIEW_LIMIT,
					sort: query.sort,
					order: query.order,
				},
			}),
			q ? getSearchTags({ data: { q, limit: 200 } }) : Promise.resolve(undefined),
		]);
		return { q: q || undefined, hub, searchTags };
	})
	.head(({ q }) => ({
		meta: [
			{
				title: `标签检索${q ? ` - ${q}` : ""} | ${seoTemplate.title}`,
			},
			{
				name: "description",
				content: q
					? `搜索标签"${q}"，浏览相关游戏标签`
					: "按剧情、性爱、技术分类浏览游戏标签，每个标签展示收录的游戏数量",
			},
		],
	}))
	.page(({ hub, searchTags, q: loadedQ, query }) => (
		<TagsIndexPage
			hub={hub}
			searchTags={searchTags}
			loadedQ={loadedQ}
			query={query}
		/>
	));

function TagsIndexPage({
	hub,
	searchTags,
	loadedQ,
	query,
}: {
	hub: Awaited<ReturnType<typeof getTagHub>>;
	searchTags: Awaited<ReturnType<typeof getSearchTags>> | undefined;
	loadedQ: string | undefined;
	query: z.infer<typeof TagsSearchSchema>;
}) {
	// 等同于旧 SSR dehydrate：先灌 query 缓存，组件里的 useQuery 直接命中
	useSeedQueries([
		[["tagHub", "preview", query.sort, query.order], hub],
		[["searchTags", loadedQ], searchTags],
	]);

	return (
		<div>
			<TagsBreadcrumb />
			<TagsPage q={query.q} sort={query.sort} order={query.order} />
		</div>
	);
}

function TagsBreadcrumb() {
	return (
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
	);
}
