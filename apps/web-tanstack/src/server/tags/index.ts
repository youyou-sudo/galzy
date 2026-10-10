import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import type { StripUnknown } from "@web/lib/serializable";
import {
	boolean,
	enum as zEnum,
	number,
	object,
	string,
} from "zod/schemas";

export const getTagData = createServerFn()
	.validator(
		object({
			tagId: string(),
		}),
	)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.tags.tag.get({
			query: { tagId: data.tagId },
		});
		elysiaErrorF(error);
		return res;
	});

export const SearchTagsSchema = object({
	q: string().optional(),
	limit: number().optional(),
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
		object({
			tagId: string(),
			pageSize: number(),
			pageIndex: number(),
			/**
			 * 是否计入子标签（任意深度后代）的作品。
			 * 对齐 VNDB `tag` 过滤器语义；关闭时等价于 `dtag`（仅直接标注）。
			 */
			includeChildren: boolean().optional(),
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

const TagHubSchema = object({
	group: zEnum(["character", "theme", "plot", "setting", "gameplay"])
		.optional(),
	limit: number().optional(),
});

export type TagHubTag = {
	id: string;
	name: string;
	vnCount: number;
	views: number;
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
			query: { group: data.group, limit: data.limit },
		});
		elysiaErrorF(error);
		return res as unknown as TagHubResult;
	});
