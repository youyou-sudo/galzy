import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import { cookiePass } from "@web/lib/cookie-pass";
import z from "zod";

export const adminGetAllTopics = createServerFn()
	.validator(
		z.object({
			page: z.optional(z.number()),
			limit: z.optional(z.number()),
			status: z.optional(z.string()),
		}),
	)
	.handler(async ({ data }) => {
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

export const adminUpdateTopicStatus = createServerFn()
	.validator(
		z.object({
			id: z.number(),
			status: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.topics({ id: data.id }).put(
			{ status: data.status },
			cookiePass(),
		);
		elysiaErrorF(error);
		return res;
	});
export const adminDeleteTopic = createServerFn()
	.validator(
		z.object({
			id: z.number(),
		}),
	)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.topics({ id: data.id }).delete(
			undefined,
			cookiePass(),
		);
		elysiaErrorF(error);
		return res;
	});
