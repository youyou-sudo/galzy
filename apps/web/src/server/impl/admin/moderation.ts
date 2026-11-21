import "@teyik0/furin/server-only";
import { api } from "@libs";
import { defineBff, defineBffNoInput } from "@web/lib/bff/define";
import { cookiePass } from "@web/lib/cookie-pass";
import { elysiaErrorF } from "@web/lib/elysia-error";
import type { StripUnknown } from "@web/lib/serializable";
import * as z from "zod/mini";

/**
 * 后台：大模型内容审核 BFF。
 *
 * 审核本体（模型调用、内容删除、封禁）全在 API 侧完成，这里只做三件事：
 * 读配置、存配置、对队列做人工处置。apiKey 永远不会回传明文 ——
 * GET 只给 hasApiKey / apiKeyHint，PUT 里不传 apiKey 表示「保持不变」。
 */

const SETTINGS_INPUT = z.object({
	enabled: z.optional(z.boolean()),
	apiBase: z.optional(z.string().check(z.maxLength(500))),
	/** 三态：省略 = 保持不变；空串 = 清空；非空 = 覆盖。 */
	apiKey: z.optional(z.string().check(z.maxLength(500))),
	model: z.optional(z.string().check(z.maxLength(128))),
	prompt: z.optional(z.string().check(z.maxLength(20_000))),
	temperature: z.optional(z.number().check(z.gte(0), z.lte(2))),
	timeoutMs: z.optional(z.int().check(z.gte(3_000), z.lte(120_000))),
	banThreshold: z.optional(z.number().check(z.gte(0), z.lte(1))),
	autoBan: z.optional(z.boolean()),
	checkComments: z.optional(z.boolean()),
	checkTopics: z.optional(z.boolean()),
	maxContentLength: z.optional(z.int().check(z.gte(200), z.lte(20_000))),
});

export const adminGetModerationSettings = defineBffNoInput(async () => {
	const { data, error } = await api.moderation.settings.get(cookiePass());
	elysiaErrorF(error);
	return data as StripUnknown<NonNullable<typeof data>> | null;
});

export const adminUpdateModerationSettings = defineBff(
	SETTINGS_INPUT,
	async ({ data }) => {
		const { data: res, error } = await api.moderation.settings.put(
			data,
			cookiePass(),
		);
		elysiaErrorF(error);
		return res as StripUnknown<NonNullable<typeof res>> | null;
	},
);

export const adminTestModeration = defineBff(
	z.object({
		title: z.optional(z.string().check(z.maxLength(200))),
		content: z.string().check(z.minLength(1), z.maxLength(20_000)),
		targetType: z.optional(z.enum(["comment", "topic"])),
	}),
	async ({ data }) => {
		const { data: res, error } = await api.moderation.settings.test.post(
			data,
			cookiePass(),
		);
		elysiaErrorF(error);
		return res ?? null;
	},
);

export const adminGetModerationQueue = defineBff(
	z.object({
		status: z.optional(z.string()),
		targetType: z.optional(z.string()),
		page: z.optional(z.int().check(z.gte(1))),
		limit: z.optional(z.int().check(z.gte(1), z.lte(100))),
		search: z.optional(z.string()),
	}),
	async ({ data }) => {
		const { data: res, error } = await api.moderation.queue.get({
			query: {
				status: data.status,
				targetType: data.targetType,
				page: data.page,
				limit: data.limit,
				search: data.search,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res as StripUnknown<NonNullable<typeof res>> | null;
	},
);

export const adminConfirmModeration = defineBff(
	z.object({
		id: z.number(),
		banUser: z.optional(z.boolean()),
	}),
	async ({ data }) => {
		const { data: res, error } = await api.moderation
			.queue({ id: String(data.id) })
			.confirm.post({ banUser: data.banUser }, cookiePass());
		elysiaErrorF(error);
		return res;
	},
);

export const adminRestoreModeration = defineBff(
	z.object({ id: z.number() }),
	async ({ data }) => {
		const { data: res, error } = await api.moderation
			.queue({ id: String(data.id) })
			.restore.post(undefined, cookiePass());
		elysiaErrorF(error);
		return res;
	},
);

export const adminRetryModeration = defineBff(
	z.object({ id: z.number() }),
	async ({ data }) => {
		const { data: res, error } = await api.moderation
			.queue({ id: String(data.id) })
			.retry.post(undefined, cookiePass());
		elysiaErrorF(error);
		return res;
	},
);
