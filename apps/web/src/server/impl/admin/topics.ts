import "@teyik0/furin/server-only";
import { defineBff } from "@web/lib/bff/define";
import { api } from "@libs";
import { elysiaErrorF } from "@web/lib";
import { cookiePass } from "@web/lib/cookie-pass";
import * as z from "zod/mini";

export const adminGetAllTopics = defineBff(z.object({
			page: z.optional(z.number()),
			limit: z.optional(z.number()),
			status: z.optional(z.string()),
		}), async ({ data }) => {
		const { data: res, error } = await api.topics.get({
			query: {
				page: data.page,
				limit: data.limit,
				status: data.status,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	});

export const adminUpdateTopicStatus = defineBff(z.object({
			id: z.number(),
			status: z.string(),
		}), async ({ data }) => {
		const { data: res, error } = await api.topics({ id: data.id }).put(
			{ status: data.status },
			cookiePass(),
		);
		elysiaErrorF(error);
		return res;
	});
export const adminDeleteTopic = defineBff(z.object({
			id: z.number(),
		}), async ({ data }) => {
		const { data: res, error } = await api.topics({ id: data.id }).delete(
			undefined,
			cookiePass(),
		);
		elysiaErrorF(error);
		return res;
	});
