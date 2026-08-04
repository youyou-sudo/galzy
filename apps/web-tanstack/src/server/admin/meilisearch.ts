import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import { cookiePass } from "@web/lib/cookie-pass";
import z from "zod";

const INDEX_NAME_MAP = {
	game: process.env.MEILISEARCH_INDEXNAME || "galzy_games",
	tag: process.env.MEILISEARCH_TAG_INDEXNAME || "galrc_Tag",
	producer: process.env.MEILISEARCH_PRODUCER_INDEXNAME || "galrc_Producer",
} as const;

export const getMeiliSearchProgress = createServerFn({ method: "GET" })
	.validator(
		z.object({
			type: z.enum(["game", "tag", "producer"]),
		}),
	)
	.handler(async ({ data: { type } }) => {
		const { data, error } = await api.task.meiliSearchProgress.get({
			query: { type },
			...cookiePass(),
		});
		elysiaErrorF(error);
		return data;
	});

/**
 * 获取 Meilisearch 实例统计信息
 */

export const getMeiliStats = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data, error } = await api.search.getStats.get(cookiePass());
		elysiaErrorF(error);
		return data;
	},
);

/**
 * 获取 Embedders 配置
 */
export const getEmbedders = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data, error } = await api.search.meilisearchEmbeddersGet.get(
			cookiePass(),
		);
		elysiaErrorF(error);
		return data;
	},
);

/**
 * 更新 Embedders 配置
 */
export const updateEmbedders = createServerFn({ method: "POST" })
	.validator(
		z.object({
			url: z.string().min(1, "URL 不能为空"),
			embeddingApiKey: z.string(),
			model: z.string().min(1, "Model 不能为空"),
			documentTemplateMaxBytes: z.number().min(1),
			documentTemplate: z.string().min(1, "Document Template 不能为空"),
		}),
	)
	.handler(async ({ data: body }) => {
		const { data, error } = await api.search.meilisearchEmbeddersUpdate.post(
			body,
			cookiePass(),
		);
		elysiaErrorF(error);
		return data;
	});

/**
 * 获取属性列表
 */
export const getPropertyList = createServerFn({ method: "GET" })
	.validator(
		z.object({
			indexType: z.enum(["game", "tag", "producer"]).optional().default("game"),
		}),
	)
	.handler(async ({ data }) => {
		const indexName = INDEX_NAME_MAP[data?.indexType ?? "game"];
		const { data: result, error } =
			await api.search.meilisearchPropertylist.get({
				query: { indexName },
				fetch: cookiePass().fetch,
			});
		elysiaErrorF(error);
		return result;
	});

/**
 * 获取搜索属性
 */
export const getSearchableAttributes = createServerFn({ method: "GET" })
	.validator(
		z.object({
			indexType: z.enum(["game", "tag", "producer"]).optional().default("game"),
		}),
	)
	.handler(async ({ data }) => {
		const indexName = INDEX_NAME_MAP[data?.indexType ?? "game"];
		const { data: result, error } =
			await api.search.meilisearchSearchableAttributesGet.get({
				query: { indexName },
				fetch: cookiePass().fetch,
			});
		elysiaErrorF(error);
		return result;
	});

/**
 * 更新搜索属性
 */
export const updateSearchableAttributes = createServerFn({ method: "POST" })
	.validator(
		z.object({
			fields: z.array(z.string()),
			indexType: z.enum(["game", "tag", "producer"]).optional().default("game"),
		}),
	)
	.handler(async ({ data: { fields, indexType } }) => {
		const indexName = INDEX_NAME_MAP[indexType];
		const { data, error } =
			await api.search.meilisearchSearchableAttributesUpdate.post(
				{ fields, indexName },
				cookiePass(),
			);
		elysiaErrorF(error);
		return data;
	});

/**
 * 触发游戏索引重建
 */
export const triggerGameIndexRebuild = createServerFn({
	method: "GET",
}).handler(async () => {
	const { data, error } = await api.task.meiliSearchAddIndex.get(cookiePass());
	elysiaErrorF(error);
	return data;
});

/**
 * 触发标签索引重建
 */
export const triggerTagIndexRebuild = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data, error } = await api.task.meiliSearchAddTag.get(cookiePass());
		elysiaErrorF(error);
		return data;
	},
);

/**
 * 触发厂商索引重建
 */
export const triggerProducerIndexRebuild = createServerFn({
	method: "GET",
}).handler(async () => {
	const { data, error } = await api.task.meiliSearchAddProducer.get(
		cookiePass(),
	);
	elysiaErrorF(error);
	return data;
});
