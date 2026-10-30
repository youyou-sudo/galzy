import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/search/index";

export const getSearch = bffFn<typeof impl.getSearch>("search.getSearch");

export type * from "./../impl/search/index";

// Client-side copies needed by page search schemas (kept in sync with the impl module).
import * as z from "zod/mini";
export const SearchSchema = z.object({
	q: z.optional(z.string()),
	startDate: z.optional(z.string()),
	endDate: z.optional(z.string()),
});
