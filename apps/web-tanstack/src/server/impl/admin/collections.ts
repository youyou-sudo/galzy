import "@teyik0/furin/server-only";
import { defineBff } from "@web/lib/bff/define";
import { api } from "@libs";
import { cookiePass } from "@web/lib/cookie-pass";
import { elysiaErrorF } from "@web/lib/elysia-error";
import type { StripUnknown } from "@web/lib/serializable";
import * as z from "zod/mini";

export const adminGetCollections = defineBff(z.object({
			page: z.optional(z.number()),
			limit: z.optional(z.number()),
			status: z.optional(z.string()),
		}), async ({ data }) => {
		const query: Record<string, unknown> = {
			page: data.page,
			limit: data.limit,
		};
		if (data.status && data.status !== "__all__") {
			query.status = data.status;
		}
		const { data: res, error } = await api.collections.get({
			query,
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res as StripUnknown<NonNullable<typeof res>> | null;
	});

export const adminCreateCollection = defineBff(z.object({
			title: z.string().check(z.minLength(1)),
			description: z.optional(z.string()),
			type: z.optional(z.string()),
			producerIds: z.optional(z.array(z.string())),
			status: z.optional(z.string()),
		}), async ({ data }) => {
		const { data: collection, error } = await api.collections.post(
			data,
			cookiePass(),
		);
		elysiaErrorF(error);
		return {
			success: true,
			collection:
				(collection as StripUnknown<NonNullable<typeof collection>>) ?? null,
		};
	});

export const adminUpdateCollection = defineBff(z.object({
			id: z.number(),
			title: z.optional(z.string()),
			description: z.optional(z.string()),
			type: z.optional(z.string()),
			producerIds: z.optional(z.array(z.string())),
			status: z.optional(z.string()),
			sortOrder: z.optional(z.number()),
		}), async ({ data }) => {
		const { id, ...rest } = data;
		const { error } = await api
			.collections({ id: String(id) })
			.put(rest, cookiePass());
		elysiaErrorF(error);
		return { success: true };
	});

export const adminDeleteCollection = defineBff(z.object({ id: z.number() }), async ({ data }) => {
		const { error } = await api
			.collections({ id: String(data.id) })
			.delete(undefined, cookiePass());
		elysiaErrorF(error);
		return { success: true };
	});

export const adminUpdateCollectionEntries = defineBff(z.object({
			id: z.number(),
			entries: z.array(z.object({ vid: z.string(), sortOrder: z.number() })),
		}), async ({ data }) => {
		const { error } = await api
			.collections({ id: String(data.id) })
			.entries.put({ entries: data.entries }, cookiePass());
		elysiaErrorF(error);
		return { success: true };
	});

export const adminSearchProducers = defineBff(z.object({
			q: z.string().check(z.minLength(1)),
			limit: z.optional(z.number()),
		}), async ({ data }) => {
		const { data: res, error } = await api.producer.search.get({
			query: { q: data.q, limit: data.limit },
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	});

export const adminSearchGames = defineBff(z.object({
			q: z.string().check(z.minLength(1)),
			limit: z.optional(z.number()),
		}), async ({ data }) => {
		const { data: res, error } = await api.games["quick-search"].get({
			query: { q: data.q, limit: data.limit },
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	});
