import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
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
		return getgame;
	});

export const getGameTags = createServerFn()
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		const { data: tags, error } = await api.tags.gametags.post({ id: data.id });
		elysiaErrorF(error);
		return tags;
	});

export const getFileList = createServerFn()
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		const { data: filelist, error } = await api.games.openlistfiles.get({
			query: {
				id: data.id,
			},
		});
		elysiaErrorF(error);
		return {
			game: filelist,
		};
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
				pageSize: z.number(),
				pageIndex: z.number(),
			})
			.partial()
			.default({}),
	)
	.handler(async ({ data }) => {
		const { data: gamelistRes, error } = await api.games.gamelist.get({
			query: {
				pageIndex: data.pageIndex || 0,
				pageSize: data.pageSize || 24,
			},
		});

		elysiaErrorF(error);
		return { gamelist: gamelistRes };
	});

export const getCritical = createServerFn().handler(async () => {
	const [gameResult, tagResult] = await Promise.allSettled([
		api.views.hot.game.get(),
		api.views.hot.tag.get(),
	]);

	const gameRes: Array<{ id: string; title: string | null; total: number }> | null =
		gameResult.status === 'fulfilled' && !gameResult.value.error
			? (gameResult.value.data ?? null)
			: null

	const tagRes: Array<{ tag: string; title: string | null; total: number }> | null =
		tagResult.status === 'fulfilled' && !tagResult.value.error
			? (tagResult.value.data ?? null)
			: null

	return {
		game: gameRes,
		tag: tagRes,
	}
});
