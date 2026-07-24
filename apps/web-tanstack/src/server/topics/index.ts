import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import { cookiePass } from "@web/lib/cookie-pass";
import z from "zod";

export const getTopics = createServerFn()
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

export const getTopic = createServerFn()
	.validator(
		z.object({
			id: z.number(),
		}),
	)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.topics({ id: data.id }).get({
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	});

export const createTopic = createServerFn()
	.validator(
		z.object({
			title: z.string().min(1),
			content: z.string().min(1),
		}),
	)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.topics.post(
			{
				title: data.title,
				content: data.content,
			},
			cookiePass(),
		);
		elysiaErrorF(error);
		return res;
	});

export const updateTopic = createServerFn()
	.validator(
		z.object({
			id: z.number(),
			title: z.optional(z.string()),
			content: z.optional(z.string()),
			status: z.optional(z.string()),
		}),
	)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.topics({ id: data.id }).put(
			{
				title: data.title,
				content: data.content,
				status: data.status,
			},
			cookiePass(),
		);
		elysiaErrorF(error);
		return res;
	});

export const deleteTopic = createServerFn()
	.validator(
		z.object({
			id: z.number(),
		}),
	)
	.handler(async ({ data }) => {
		const { data: res, error } = await api
			.topics({ id: data.id })
			.delete(undefined, cookiePass());
		elysiaErrorF(error);
		return res;
	});
