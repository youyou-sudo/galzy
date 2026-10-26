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

const isTagGroupKey = (value: string): value is TagGroupKey =>
	(TAG_GROUP_KEYS as readonly string[]).includes(value);

/** 分类键 → 静态展示名：pending 期间页头/面包屑可以先出真实名称而不是灰条 */
const CATEGORY_LABELS: Record<TagGroupKey, string> = {
	character: "角色与关系",
	theme: "题材与世界观",
	plot: "剧情与情节",
	setting: "世界观与舞台",
	gameplay: "玩法与风格",
	hot: "热门标签",
	cont: "其他剧情标签",
};

export const Route = createFileRoute("/tags/category/$categoryKey")({
	pendingComponent: () => <TagCategoryPending />,
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
				<CategoryBreadcrumb name={name} />
				<TagCategoryPage category={category} sort={sort} order={order} />
			</div>
		);
	},
});

/**
 * 分类页 pending：面包屑、页头、排序条都是静态结构，直接渲染真实组件；
 * 只有分类名/描述/计数和标签行是数据，数据到达时只替换这些内容。
 */
function TagCategoryPending() {
	const { categoryKey } = Route.useParams();
	const { sort, order } = Route.useSearch();
	const label =
		(isTagGroupKey(categoryKey) && CATEGORY_LABELS[categoryKey]) || "标签分类";

	return (
		<div>
			<CategoryBreadcrumb name={label} />
			<TagCategoryPageSkeleton
				name={label}
				categoryKey={categoryKey}
				sort={sort}
				order={order}
			/>
		</div>
	);
}

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
