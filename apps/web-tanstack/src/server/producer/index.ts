import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import z from "zod";

export interface ProducerRelation {
	id: string | null;
	pid: string | null;
	alias: string | null;
	name: string | null;
	relation: string | null;
}

export interface ProducerInfo {
	id: string;
	type: string | null;
	lang: string | null;
	name: string | null;
	latin: string | null;
	original: string | null;
	alias: string | null;
	description: string | null;
	syncedAt: Date | null;
	producers_relations: ProducerRelation[];
}

export const producerInfo = createServerFn()
	.validator(z.object({ pid: z.string() }))
	.handler(async ({ data }) => {
		const { data: producer, error } = await api.producer.info.get({
			query: { pid: data.pid },
		});
		elysiaErrorF(error);
		// Elysia 推断的响应类型含联合，会被 createServerFn 收敛为 unknown，这里按已知形状定型
		return producer as ProducerInfo;
	});

export const producerGameList = createServerFn()
	.validator(z.object({ pid: z.string() }))
	.handler(async ({ data }) => {
		const { data: result, error } = await api.producer.gamelists.get({
			query: { pid: data.pid },
		});
		elysiaErrorF(error);
		return result?.items ?? [];
	});

export const ProducerSearchSchema = z.object({
	q: z.string().optional(),
	page: z.number().optional(),
	hitsPerPage: z.number().optional(),
});

export const getSearchProducers = createServerFn()
	.validator(ProducerSearchSchema)
	.handler(async ({ data }) => {
		const { data: res, error } = await api.search.producers.get({
			query: {
				q: data.q,
				page: data.page,
				hitsPerPage: data.hitsPerPage,
			},
		});
		elysiaErrorF(error);
		return res;
	});
