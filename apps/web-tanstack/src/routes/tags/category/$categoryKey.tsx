import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import TagCategoryPage, {
	TagCategoryPageSkeleton,
} from "@web/components/tags/tag-category-page";
import { seoTemplate } from "@web/config/seoTemplate";
import {
	getTagGroupTags,
	TAG_GROUP_KEYS,
	TAG_ORDER_KEYS,
	TAG_SORT_KEYS,
	type TagGroupKey,
} from "@web/server/tags";
import { z } from "zod";
import { object } from "zod/schemas";

export const TagCategorySearchSchema = object({
	// 与标签库一致：默认按总浏览量倒序
	// catch：旧链接里的排序键（如已下线的 nameAsc）落到默认值，而不是整页 500
	sort: z.enum(TAG_SORT_KEYS).catch("views").optional().default("views"),
	order: z.enum(TAG_ORDER_KEYS).catch("desc").optional().default("desc"),
});

const isTagGroupKey = (value: string): value is TagGroupKey =>
	(TAG_GROUP_KEYS as readonly string[]).includes(value);

export const Route = createFileRoute("/tags/category/$categoryKey")({
	pendingComponent: () => <TagCategoryPageSkeleton />,
	validateSearch: TagCategorySearchSchema,
	loader: async ({ params }) => {
		const categoryKey = params.categoryKey;
		// 非法分类键先在路由层挡掉：直接打 API 只会换来一个 422 校验错误，
		// 落到 __root 的错误组件上，用户看不到「分类不存在」的兜底页。
		if (!isTagGroupKey(categoryKey)) {
			return { category: null, categoryKey };
		}
		const res = await getTagGroupTags({ data: { group: categoryKey } });
		return { category: res.category, categoryKey };
	},
	head: ({ loaderData }) => {
		const name = loaderData?.category?.name ?? "标签分类";
		return {
			meta: [
				{ title: `${name} | ${seoTemplate.title}` },
				{
					name: "description",
					content:
						loaderData?.category?.description ||
						`浏览「${name}」分类下的全部游戏标签，每个标签展示收录的游戏数量`,
				},
			],
		};
	},
	headers: ({ params }) => ({
		"Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
		"Cache-Tag": `page-tags,tag-group-${params.categoryKey}`,
		Vary: "Accept, Accept-Encoding",
	}),
	component: () => {
		const { category } = Route.useLoaderData();
		const { sort, order } = Route.useSearch();
		const name = category?.name ?? "标签分类";
		return (
			<div>
				<Breadcrumb className="mb-4">
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink render={<Link to="/tags" />}>标签</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{name}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<TagCategoryPage category={category} sort={sort} order={order} />
			</div>
		);
	},
});
