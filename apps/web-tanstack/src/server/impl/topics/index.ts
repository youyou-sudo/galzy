import "@teyik0/furin/server-only";
import { defineBff } from "@web/lib/bff/define";
import { api } from "@libs";
import { elysiaErrorF } from "@web/lib";
import { cookiePass } from "@web/lib/cookie-pass";
import { authServerClient } from "@web/server/auth/auth.server";
import * as z from "zod/mini";

export const getTopics = defineBff(z.object({
			page: z.optional(z.number()),
			limit: z.optional(z.number()),
			status: z.optional(z.string()),
		}), async ({ data }) => {
		let session = null;
		try {
			const { data: s } = await authServerClient.getSession();
			session = s;
		} catch {
			/* network error → session stays null */
		}
		const { data: res, error } = await api.topics.get({
			query: {
				page: data.page,
				limit: data.limit,
				status: data.status,
				userId: session?.user?.id,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	});

export const getUserFavorites = defineBff(z.object({
			page: z.optional(z.number()),
			limit: z.optional(z.number()),
		}), async ({ data }) => {
		const { data: res, error } = await api.topics.favorites.get({
			query: {
				page: data.page,
				limit: data.limit,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	});

export const getUserLikes = defineBff(z.object({
			page: z.optional(z.number()),
			limit: z.optional(z.number()),
		}), async ({ data }) => {
		const { data: res, error } = await api.topics.likes.get({
			query: {
				page: data.page,
				limit: data.limit,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	});

export const getTopic = defineBff(z.object({
			id: z.number(),
		}), async ({ data }) => {
		let session = null;
		try {
			const { data: s } = await authServerClient.getSession();
			session = s;
		} catch {
			/* network error → session stays null */
		}
		const { data: res, error } = await api.topics({ id: data.id }).get({
			query: {
				userId: session?.user?.id,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	});

export const createTopic = defineBff(z.object({
			title: z.string().check(z.minLength(1)),
			content: z.string().check(z.minLength(1)),
			contentType: z.optional(z.enum(["markdown", "html"])),
		}), async ({ data }) => {
		const { data: res, error } = await api.topics.post(
			{
				title: data.title,
				content: data.content,
				contentType: data.contentType,
			},
			cookiePass(),
		);
		elysiaErrorF(error);
		return res;
	});

export const updateTopic = defineBff(z.object({
			id: z.number(),
			title: z.optional(z.string()),
			content: z.optional(z.string()),
			contentType: z.optional(z.enum(["markdown", "html"])),
			status: z.optional(z.string()),
		}), async ({ data }) => {
		const { data: res, error } = await api.topics({ id: data.id }).put(
			{
				title: data.title,
				content: data.content,
				contentType: data.contentType,
				status: data.status,
			},
			cookiePass(),
		);
		elysiaErrorF(error);
		return res;
	});

export const toggleTopicLike = defineBff(z.object({
			id: z.number(),
		}), async ({ data }) => {
		const { data: res, error } = await api
			.topics({ id: data.id })
			.like.post(undefined, cookiePass());
		elysiaErrorF(error);
		return res;
	});

export const toggleTopicFavorite = defineBff(z.object({
			id: z.number(),
		}), async ({ data }) => {
		const { data: res, error } = await api
			.topics({ id: data.id })
			.favorite.post(undefined, cookiePass());
		elysiaErrorF(error);
		return res;
	});

export const deleteTopic = defineBff(z.object({
			id: z.number(),
		}), async ({ data }) => {
		const { data: res, error } = await api
			.topics({ id: data.id })
			.delete(undefined, cookiePass());
		elysiaErrorF(error);
		return res;
	});
