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
		api.umami.remfGame.get(),
		api.umami.remfTag.get(),
	]);

	let gameRes: unknown = null
	let tagRes: unknown = null

	if (gameResult.status === 'fulfilled') {
		const { data, error } = gameResult.value
		if (!error) gameRes = data
	}

	if (tagResult.status === 'fulfilled') {
		const { data, error } = tagResult.value
		if (!error) tagRes = data
	}

	return {
		game: gameRes,
		tag: tagRes,
	};
});
