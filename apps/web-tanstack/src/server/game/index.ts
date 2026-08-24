import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import type { StripUnknown } from "@web/lib/serializable";
import z from "zod";

export const getGameDetail = createServerFn()
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		const { data: getgame, error } = await api.games.get({
			query: {
				id: data.id,
			},
		});
		elysiaErrorF(error);
		return getgame as StripUnknown<NonNullable<typeof getgame>> | null;
	});

export const getGameTags = createServerFn()
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		const { data: tags, error } = await api.tags.gametags.post({ id: data.id });
		elysiaErrorF(error);
		return tags;
	});

export const getGameRelations = createServerFn()
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		const { data: relations, error } = await api.games.relations.get({
			query: { id: data.id },
		});
		elysiaErrorF(error);
		return relations;
	});

export const getFileList = createServerFn()
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		try {
			const { data: filelist, error } = await api.games.openlistfiles.get({
				query: { id: data.id },
			});
			elysiaErrorF(error);
			return { game: filelist };
		} catch {
			return { game: [] };
		}
	});

export const translateData = createServerFn()
	.validator(
		z.object({
			id: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const { data: translate, error } = await api.games.gameTimeNumberGet.get({
			query: { id: data.id, time: "week" },
		});
		elysiaErrorF(error);
		return translate;
	});

export const dwAcConst = createServerFn()
	.validator(z.object({ path: z.string(), game_id: z.string() }))
	.handler(async ({ data }) => {
		const { data: res, error } = await api.download.path.get({
			query: { path: data.path, game_id: data.game_id },
		});
		elysiaErrorF(error);
		return res;
	});

export const getGameList = createServerFn()
	.validator(
		z
			.object({
				pageSize: z.optional(z.number()),
				pageIndex: z.optional(z.number()),
				sortBy: z.optional(z.string()),
				order: z.optional(z.string()),
				q: z.optional(z.string()),
				olang: z.optional(z.string()),
				tags: z.optional(z.union([z.string(), z.array(z.string())])),
				startDate: z.optional(z.string()),
				endDate: z.optional(z.string()),
				showR18: z.optional(z.boolean()),
			})
			.partial()
			.default({}),
	)
	.handler(async ({ data }) => {
		// Map legacy sortBy values to Meilisearch sortable attributes
		const sortByMap: Record<string, string> = {
			released: "released_first",
			downloads: "dl_count",
			views: "vw_count",
			rating: "rating",
			votecount: "votecount",
			id: "id",
		};
		const meiliSortBy = data.sortBy
			? (sortByMap[data.sortBy] ?? data.sortBy)
			: undefined;

		const { data: result, error } = await api.search.games.get({
			query: {
				q: data.q || "",
				page: (data.pageIndex || 0) + 1,
				hitsPerPage: data.pageSize || 24,
				sortBy: meiliSortBy as
					| "released_first"
					| "rating"
					| "votecount"
					| "dl_count"
					| "vw_count"
					| "id"
					| undefined,
				order: data.order as "asc" | "desc" | undefined,
				olang: data.olang,
				tags: data.tags,
				startDate: data.startDate,
				endDate: data.endDate,
				r18: data.showR18,
			},
		});
		elysiaErrorF(error);
		return {
			gamelist: {
				items: result?.hits ?? [],
				currentPage: (result?.page || 1) - 1,
				totalPages: result?.totalPages || 0,
				totalCount: result?.totalHits || 0,
			},
		};
	});

export const getTotalCount = createServerFn().handler(async () => {
	const { data: totalRes, error } = await api.games.count.get();
	elysiaErrorF(error);
	return totalRes;
});
export const getCritical = createServerFn()
	.validator(z.object({ showR18: z.optional(z.boolean()) }))
	.handler(async ({ data }) => {
		const [gameResult, tagResult] = await Promise.allSettled([
			api.views.hot.game.get({ query: { r18: data.showR18 } }),
			api.views.hot.tag.get(),
		]);

		const game =
			gameResult.status === "fulfilled" && !gameResult.value.error
				? (gameResult.value.data ?? null)
				: null;

		const tag =
			tagResult.status === "fulfilled" && !tagResult.value.error
				? (tagResult.value.data ?? null)
				: null;

		return { game, tag };
	});
