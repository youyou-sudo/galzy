import "@teyik0/furin/server-only";
import { defineBff } from "@web/lib/bff/define";
import { api } from "@libs";
import { elysiaErrorF } from "@web/lib";
import { cookiePass } from "@web/lib/cookie-pass";
import type { StripUnknown } from "@web/lib/serializable";
import * as z from "zod/mini";

export const adminGetComments = defineBff(z.object({
			page: z.optional(z.number()),
			limit: z.optional(z.number()),
			targetType: z.optional(z.string()),
			targetId: z.optional(z.string()),
			type: z.optional(z.string()),
			status: z.optional(z.string()),
		}), async ({ data }) => {
		const { data: res, error } = await api.comments.get({
			query: {
				page: data.page,
				limit: data.limit,
				targetType: data.targetType,
				targetId: data.targetId,
				type: data.type,
				status: data.status,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res as StripUnknown<NonNullable<typeof res>> | null;
	});

export const adminUpdateComment = defineBff(z.object({
			id: z.string(),
			content: z.string().check(z.minLength(1)),
		}), async ({ data }) => {
		const { data: res, error } = await api
			.comments({ id: data.id })
			.put({ content: data.content }, cookiePass());
		elysiaErrorF(error);
		return res;
	});

export const adminDeleteComment = defineBff(z.object({ id: z.string() }), async ({ data }) => {
		const { data: res, error } = await api
			.comments({ id: data.id })
			.delete(undefined, cookiePass());
		elysiaErrorF(error);
		return res;
	});

export const adminChangeCommentStatus = defineBff(z.object({
			id: z.string(),
			status: z.string(),
		}), async ({ data }) => {
		const { data: res, error } = await api
			.comments({ id: data.id })
			.status.patch({ status: data.status }, cookiePass());
		elysiaErrorF(error);
		return res;
	});

export const adminGetAllComments = defineBff(z.object({
			page: z.optional(z.number()),
			limit: z.optional(z.number()),
			targetType: z.optional(z.string()),
			targetId: z.optional(z.string()),
			type: z.optional(z.string()),
			status: z.optional(z.string()),
			excludeReplies: z.optional(z.boolean()),
		}), async ({ data }) => {
		const { data: res, error } = await api.comments.admin.get({
			query: {
				page: data.page,
				limit: data.limit,
				targetType: data.targetType,
				targetId: data.targetId,
				type: data.type,
				status: data.status,
				excludeReplies: data.excludeReplies,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res as StripUnknown<NonNullable<typeof res>> | null;
	});

export const adminTogglePin = defineBff(z.object({ id: z.string() }), async ({ data }) => {
		const { data: res, error } = await api
			.comments({ id: data.id })
			.pin.patch(undefined, cookiePass());
		elysiaErrorF(error);
		return res;
	});
