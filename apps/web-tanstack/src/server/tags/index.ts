import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import type { StripUnknown } from "@web/lib/serializable";
import { number, object, string } from "zod/schemas";

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
		}),
	)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.tags.taggames.post({
			tagId: data.tagId,
			pageSize: data.pageSize,
			pageIndex: data.pageIndex,
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
