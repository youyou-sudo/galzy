import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/tags/index";

export const getTagData = bffFn<typeof impl.getTagData>("tags.getTagData");
export const getSearchTags = bffFn<typeof impl.getSearchTags>("tags.getSearchTags");
export const getVnListByTag = bffFn<typeof impl.getVnListByTag>("tags.getVnListByTag");
export const getTagCategories = bffFn<typeof impl.getTagCategories>("tags.getTagCategories");
export const getTagHub = bffFn<typeof impl.getTagHub>("tags.getTagHub");
export const getTagGroupTags = bffFn<typeof impl.getTagGroupTags>("tags.getTagGroupTags");

export type * from "./../impl/tags/index";

// Client-side copies needed by page search schemas (kept in sync with the impl module).
import * as z from "zod/mini";
export const SearchTagsSchema = z.object({
	q: z.optional(z.string()),
	limit: z.optional(z.number()),
});

export const TAG_SORT_KEYS = [
	"count",
	"views",
	"hotWeek",
	"hotMonth",
	"name",
] as const;

export const TAG_ORDER_KEYS = ["desc", "asc"] as const;

export const TAG_GROUP_KEYS = [
	"character",
	"theme",
	"plot",
	"setting",
	"gameplay",
	"hot",
	"cont",
] as const;
