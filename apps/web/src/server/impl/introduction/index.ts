import "@teyik0/furin/server-only";
import { defineBff } from "@web/lib/bff/define";
import { api } from "@libs";
import { elysiaErrorF } from "@web/lib";
import { cookiePass } from "@web/lib/cookie-pass";
import * as z from "zod/mini";

export const getIntroductionArticle = defineBff(z.object({
			id: z.string(),
		}), async ({ data }) => {
		const { data: res, error } = await api.strategy.strategy.get({
			query: {
				strategyId: +data.id,
			},
		});
		elysiaErrorF(error);
		return res;
	});

export const getintroductionList = defineBff(z.object({
			id: z.string(),
		}), async ({ data }) => {
		const { data: res, error } = await api.strategy.gamestrategys.get({
			query: { gameId: data.id },
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	});

export const createIntroduction = defineBff(z.object({
			gameId: z.string(),
			title: z.string().check(z.minLength(1, "标题不能为空")),
			content: z.string().check(z.minLength(1, "内容不能为空")),
			contentType: z.optional(z.enum(["markdown", "html"])),
			copyright: z.optional(z.nullable(z.string())),
		}), async ({ data }) => {
		const { error } = await api.strategy.strategylistcreate.post(
			{
				id: data.gameId,
				data: {
					title: data.title,
					content: data.content,
					contentType: data.contentType,
					copyright: data.copyright ?? "",
				},
			},
			cookiePass(),
		);
		elysiaErrorF(error);
		return { success: true };
	});

export const updateIntroduction = defineBff(z.object({
			id: z.string(),
			data: z.object({
				title: z.string().check(z.minLength(1, "标题不能为空")),
				content: z.string().check(z.minLength(1, "内容不能为空")),
				contentType: z.optional(z.enum(["markdown", "html"])),
				copyright: z.optional(z.nullable(z.string())),
			}),
		}), async ({ data }) => {
		const { error } = await api.strategy.strategylistupdate.post(
			{
				id: data.id,
				data: {
					title: data.data.title,
					content: data.data.content,
					contentType: data.data.contentType,
					copyright: data.data.copyright ?? "",
				},
			},
			cookiePass(),
		);
		elysiaErrorF(error);
		return { success: true };
	});

export const deleteIntroduction = defineBff(z.object({
			strategyId: z.number(),
			gameId: z.string(),
		}), async ({ data }) => {
		const { error } = await api.strategy.strategylistdelete.post(
			{
				strategyId: data.strategyId,
				gameId: data.gameId,
			},
			cookiePass(),
		);
		elysiaErrorF(error);
		return { success: true };
	});
