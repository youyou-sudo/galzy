import "@teyik0/furin/server-only";
import { api } from "@libs";
import { elysiaErrorF } from "@web/lib";
import { defineBff } from "@web/lib/bff/define";
import { cookiePass } from "@web/lib/cookie-pass";
import { getServerSession } from "@web/server/auth/server-session";
import * as z from "zod/mini";

export const getTopics = defineBff(
	z.object({
		page: z.optional(z.number()),
		limit: z.optional(z.number()),
		status: z.optional(z.string()),
		/**
		 * ISR 页面用：列表要进服务端/CDN 缓存，绝不能带某个用户的个性化结果。
		 * 置 true 时跳过会话读取与 cookie 透传（只取公共数据）；
		 * 浏览器侧的查询不传，保持原有的「自己的隐藏帖」行为。
		 */
		publicOnly: z.optional(z.boolean()),
	}),
	async ({ data }) => {
		// 会话走带缓存的服务端读取：列表页 SSR + 视口预取会反复走到这里
		const session = data.publicOnly ? null : await getServerSession();
		const { data: res, error } = await api.topics.get({
			query: {
				page: data.page,
				limit: data.limit,
				status: data.status,
				userId: session?.user?.id,
			},
			...(data.publicOnly ? {} : cookiePass()),
		});
		elysiaErrorF(error);
		return res;
	},
);

export const getUserFavorites = defineBff(
	z.object({
		page: z.optional(z.number()),
		limit: z.optional(z.number()),
	}),
	async ({ data }) => {
		const { data: res, error } = await api.topics.favorites.get({
			query: {
				page: data.page,
				limit: data.limit,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	},
);

export const getUserLikes = defineBff(
	z.object({
		page: z.optional(z.number()),
		limit: z.optional(z.number()),
	}),
	async ({ data }) => {
		const { data: res, error } = await api.topics.likes.get({
			query: {
				page: data.page,
				limit: data.limit,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	},
);

export const getTopic = defineBff(
	z.object({
		id: z.number(),
		/** ISR 详页用：跳过会话/cookie，返回所有人一致的公共数据 */
		publicOnly: z.optional(z.boolean()),
	}),
	async ({ data }) => {
		// 详情页会被列表页视口预取批量请求，同样复用缓存的会话读取
		const session = data.publicOnly ? null : await getServerSession();
		const { data: res, error } = await api.topics({ id: data.id }).get({
			query: {
				userId: session?.user?.id,
			},
			...(data.publicOnly ? {} : cookiePass()),
		});
		elysiaErrorF(error);
		return res;
	},
);

export const createTopic = defineBff(
	z.object({
		title: z.string().check(z.minLength(1)),
		content: z.string().check(z.minLength(1)),
		contentType: z.optional(z.enum(["markdown", "html"])),
	}),
	async ({ data }) => {
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
	},
);

export const updateTopic = defineBff(
	z.object({
		id: z.number(),
		title: z.optional(z.string()),
		content: z.optional(z.string()),
		contentType: z.optional(z.enum(["markdown", "html"])),
		status: z.optional(z.string()),
	}),
	async ({ data }) => {
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
	},
);

export const toggleTopicLike = defineBff(
	z.object({
		id: z.number(),
	}),
	async ({ data }) => {
		const { data: res, error } = await api
			.topics({ id: data.id })
			.like.post(undefined, cookiePass());
		elysiaErrorF(error);
		return res;
	},
);

export const toggleTopicFavorite = defineBff(
	z.object({
		id: z.number(),
	}),
	async ({ data }) => {
		const { data: res, error } = await api
			.topics({ id: data.id })
			.favorite.post(undefined, cookiePass());
		elysiaErrorF(error);
		return res;
	},
);

export const deleteTopic = defineBff(
	z.object({
		id: z.number(),
	}),
	async ({ data }) => {
		const { data: res, error } = await api
			.topics({ id: data.id })
			.delete(undefined, cookiePass());
		elysiaErrorF(error);
		return res;
	},
);
