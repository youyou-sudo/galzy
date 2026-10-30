import "@teyik0/furin/server-only";
import { defineBff } from "@web/lib/bff/define";
import { api } from "@libs";
import { elysiaErrorF } from "@web/lib";
import { cookiePass } from "@web/lib/cookie-pass";
import * as z from "zod/mini";

export const adminGetAllArticles = defineBff(z.object({
			page: z.optional(z.number()),
			limit: z.optional(z.number()),
			status: z.optional(z.string()),
			type: z.optional(z.string()),
			search: z.optional(z.string()),
		}), async ({ data }) => {
		const { data: res, error } = await api.strategy.admin.articles.get({
			query: {
				page: data.page,
				limit: data.limit,
				status: data.status,
				type: data.type,
				search: data.search,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	});

export const adminUpdateArticle = defineBff(z.object({
			id: z.number(),
			title: z.optional(z.string()),
			content: z.optional(z.string()),
			contentType: z.optional(z.enum(["markdown", "html"])),
		}), async ({ data }) => {
		const { error } = await api.strategy.strategylistupdate.post(
			{
				id: String(data.id),
				data: {
					title: data.title,
					content: data.content,
					contentType: data.contentType,
				},
			},
			cookiePass(),
		);
		elysiaErrorF(error);
		return { success: true };
	});

export const adminDeleteArticle = defineBff(z.object({
			strategyId: z.number(),
			gameId: z.optional(z.string()),
		}), async ({ data }) => {
		const { error } = await api.strategy.strategylistdelete.post(
			{
				strategyId: data.strategyId,
				gameId: data.gameId ?? "",
			},
			cookiePass(),
		);
		elysiaErrorF(error);
		return { success: true };
	});

export const adminChangeArticleStatus = defineBff(z.object({
			id: z.number(),
			status: z.string(),
		}), async ({ data }) => {
		const { error } = await api.strategy.admin.articles.status.post(
			{ id: data.id, status: data.status },
			cookiePass(),
		);
		elysiaErrorF(error);
		return { success: true };
	});
