import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/producer/index";

export const producerInfo = bffFn<typeof impl.producerInfo>("producer.producerInfo");
export const producerGameList = bffFn<typeof impl.producerGameList>("producer.producerGameList");
export const getSearchProducers = bffFn<typeof impl.getSearchProducers>("producer.getSearchProducers");

export type * from "./../impl/producer/index";

// Client-side copies needed by page search schemas (kept in sync with the impl module).
import * as z from "zod/mini";
export const ProducerSearchSchema = z.object({
	q: z.optional(z.string()),
	page: z.optional(z.number()),
	hitsPerPage: z.optional(z.number()),
});
