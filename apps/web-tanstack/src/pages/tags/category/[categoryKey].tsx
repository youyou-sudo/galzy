import { defineRoute } from "@teyik0/furin";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import TagCategoryPage from "@web/components/tags/tag-category-page";
import { seoTemplate } from "@web/config/seoTemplate";
import { Link } from "@web/lib/nav";
import {
	getTagGroupTags,
	type TagGroupCategory,
	TAG_GROUP_KEYS,
	TAG_ORDER_KEYS,
	TAG_SORT_KEYS,
} from "@web/server/tags";
import { t } from "elysia";
import * as z from "zod/mini";

export const TagCategorySearchSchema = z.object({
	// 与标签库一致：默认按总浏览量倒序
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

const paramsSchema = t.Object({ categoryKey: t.String() });

const isTagGroupKey = (value: string): value is (typeof TAG_GROUP_KEYS)[number] =>
	(TAG_GROUP_KEYS as readonly string[]).includes(value);

export const route = defineRoute("/tags/category/[categoryKey]")
	.config({
		mode: "isr",
		revalidate: 300,
		params: paramsSchema,
		query: TagCategorySearchSchema,
		tags: ["page-tags"],
	})
	.loader(async ({ params }) => {
		const categoryKey = params.categoryKey;
		// 非法分类键先在路由层挡掉：直接打 API 只会换来一个 422 校验错误，
		// 落到错误组件上，用户看不到「分类不存在」的兜底页。
		if (!isTagGroupKey(categoryKey)) {
			return { category: null, categoryKey };
		}
		// BFF 返回类型被收敛为 unknown，这里按页面实际消费的形状显式定型
		const res = (await getTagGroupTags({ data: { group: categoryKey } })) as {
			category: TagGroupCategory | null;
		};
		return { category: res.category, categoryKey };
	})
	.head(({ category }) => {
		const name = category?.name ?? "标签分类";
		return {
			meta: [
				{ title: `${name} | ${seoTemplate.title}` },
				{
					name: "description",
					content:
						category?.description ||
						`浏览「${name}」分类下的全部游戏标签，每个标签展示收录的游戏数量`,
				},
			],
		};
	})
	.page(({ category, query }) => (
		<div>
			<CategoryBreadcrumb name={category?.name ?? "标签分类"} />
			<TagCategoryPage
				category={category}
				sort={query.sort}
				order={query.order}
			/>
		</div>
	));

function CategoryBreadcrumb({ name }: { name: string }) {
	return (
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
	);
}
