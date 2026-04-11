import { api } from "@libs";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { DownloadOptions } from "#/components/game/download-options";
import { assertOk } from "#/lib/assertOk";

const getFileList = createServerFn()
	.inputValidator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		const filelist = await api.games.openlistfiles.get({
			query: {
				id: data.id,
			},
		});
		return {
			game: assertOk(filelist, "文件列表"),
		};
	});

export const Route = createFileRoute("/$id/_layout/")({
	component: DownloadComponent,
	loader: async ({ params }) => {
		const { id } = params;
		const filelist = await getFileList({ data: { id } });
		return {
			filelist,
		};
	},
	staleTime: 1000 * 30,
	headers: () => ({
		// Cache at CDN for 1 hour, allow stale content for up to 1 day
		"Cache-Control":
			"public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
	}),
});

function DownloadComponent() {
	const { filelist } = Route.useLoaderData();
	if (!filelist) {
		return <div>没有找到文件列表喵～</div>;
	}
	return <>{filelist.game && <DownloadOptions />}</>;
}
