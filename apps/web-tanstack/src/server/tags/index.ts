import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import type { StripUnknown } from "@web/lib/serializable";
import * as z from "zod/mini";

export const getTagData = createServerFn()
	.validator(
		z.object({
			tagId: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.tags.tag.get({
			query: { tagId: data.tagId },
		});
		elysiaErrorF(error);
		return res;
	});

export const SearchTagsSchema = z.object({
	q: z.optional(z.string()),
	limit: z.optional(z.number()),
});

export const getSearchTags = createServerFn()
	.validator(SearchTagsSchema)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.search.tags.get({
			query: { q: data.q, limit: data.limit },
		});
		elysiaErrorF(error);
		return res;
	});

export const getVnListByTag = createServerFn()
	.validator(
		z.object({
			tagId: z.string(),
			pageSize: z.number(),
			pageIndex: z.number(),
			/**
			 * 是否计入子标签（任意深度后代）的作品。
			 * 对齐 VNDB `tag` 过滤器语义；关闭时等价于 `dtag`（仅直接标注）。
			 */
			includeChildren: z.optional(z.boolean()),
		}),
	)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.tags.taggames.post({
			tagId: data.tagId,
			pageSize: data.pageSize,
			pageIndex: data.pageIndex,
			includeChildren: data.includeChildren ?? false,
		});
		elysiaErrorF(error);
		return res as StripUnknown<NonNullable<typeof res>> | null;
	});

// 分类浏览（cont/ero/tech 三大类），仅含已本地化标签，与详情页口径一致
export const getTagCategories = createServerFn().handler(async () => {
	const { data: res, error } = await api.tags.categories.get();
	elysiaErrorF(error);
	return res;
});

/**
 * 标签排序筛选的第一个维度：依据。与 API 的 hub / 分类页口径一致 ——
 * count 收录游戏数 · views 累计浏览量 · hotWeek/hotMonth 本周/本月浏览量
 * （时间窗热度，窗口口径见 API 的 time-window：周一展示上周，与首页周榜一致）
 * · name 中文名称。
 */
export const TAG_SORT_KEYS = [
	"count",
	"views",
	"hotWeek",
	"hotMonth",
	"name",
] as const;

export type TagSortKey = (typeof TAG_SORT_KEYS)[number];

/**
 * 第二个维度：方向。这里存的是物理方向（desc 降序 / asc 升序），只翻转主键，
 * 并列时回落规范次序；界面上显示成「正序 / 倒序」（= 榜单自然顺序及其反向，
 * 数值指标正序为降序、名称为升序），映射在 tag-sort-bar 里做。
 */
export const TAG_ORDER_KEYS = ["desc", "asc"] as const;

export type TagOrderKey = (typeof TAG_ORDER_KEYS)[number];

const TagHubSchema = z.object({
	group: z.optional(
		z.enum(["character", "theme", "plot", "setting", "gameplay"]),
	),
	limit: z.optional(z.number()),
	sort: z.optional(z.enum([...TAG_SORT_KEYS])),
	order: z.optional(z.enum([...TAG_ORDER_KEYS])),
});

export type TagHubTag = {
	id: string;
	name: string;
	vnCount: number;
	/** 终身累计标签浏览量 */
	views: number;
	/** 本周标签浏览量（「本周热门」排序键） */
	viewsWeek: number;
	/** 本月标签浏览量（「本月热门」排序键） */
	viewsMonth: number;
};

export type TagHubCategory = {
	key: string;
	name: string;
	slug: string;
	description: string;
	sortOrder: number;
	tagCount: number;
	previewTags: TagHubTag[];
};

export type TagHubResult = { categories: TagHubCategory[] };

// 标签库 hub：按语义分类平铺（参考 dg.zi0.in/tags 的分组浏览）
export const getTagHub = createServerFn()
	.validator(TagHubSchema)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.tags.hub.get({
			query: {
				group: data.group,
				limit: data.limit,
				sort: data.sort,
				order: data.order,
			},
		});
		elysiaErrorF(error);
		return res as unknown as TagHubResult;
	});

/**
 * 标签库分类页可访问的分类键。与 API 的 tagGroup 字面量联合一一对应，
 * 路由用它挡掉非法 URL（先去 API 只会换来一个 422）。
 */
export const TAG_GROUP_KEYS = [
	"character",
	"theme",
	"plot",
	"setting",
	"gameplay",
	"hot",
	"cont",
] as const;

export type TagGroupKey = (typeof TAG_GROUP_KEYS)[number];

const TagGroupSchema = z.object({
	group: z.enum([...TAG_GROUP_KEYS]),
});

export type TagGroupCategory = {
	key: string;
	name: string;
	slug: string;
	description: string;
	sortOrder: number;
	tagCount: number;
	tags: TagHubTag[];
};

export type TagGroupResult = { category: TagGroupCategory | null };

// 分类页：某一分类下的**全部**标签（hub 的 previewTags 只给前 N 条，且 limit 上限 500）
export const getTagGroupTags = createServerFn()
	.validator(TagGroupSchema)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.tags.group.get({
			query: { group: data.group },
		});
		elysiaErrorF(error);
		return res as unknown as TagGroupResult;
	});
