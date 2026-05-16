import { api } from "@libs";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { GamepadIcon } from "lucide-react";
import { z } from "zod";
import SearchlistComponent from "#/components/home/search/meilisearch";
import SearchInput from "#/components/home/search/Search";
import { seoTemplate } from "#/config/seoTemplate";
import { assertOk } from "#/lib/assertOk";
import { format, parseISO } from "date-fns";

const SearchSchema = z.object({
	q: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
});

const getSearch = createServerFn()
	.inputValidator(SearchSchema)
	.handler(async ({ data }) => {
		const gameListData = await api.search.get({
			query: {
				q: data.q || "",
				limit: 100,
				startDate: data.startDate
					? format(parseISO(data.startDate), "yyyyMMdd")
					: undefined,
				endDate: data.endDate
					? format(parseISO(data.endDate), "yyyyMMdd")
					: undefined,
			},
		});
		return assertOk(gameListData, "search");
	});

export const Route = createFileRoute("/search/")({
	component: RouteComponent,
	validateSearch: SearchSchema,
	loaderDeps: ({ search: { q, startDate, endDate } }) => ({
		q,
		startDate,
		endDate,
	}),
	loader: async ({ deps }) => {
		return { searchdata: await getSearch({ data: deps }), q: deps.q };
	},
	head: ({ loaderData }) => ({
		meta: [
			{ title: `搜索 -  ${loaderData?.q || "游戏"} | ${seoTemplate.title}` },
			{
				name: "description",
				content: `搜索 - ${loaderData?.q || "游戏"} 搜索结果`,
			},
		],
	}),
	headers: () => ({
		// Cache at CDN for 1 hour, allow stale content for up to 1 day
		"Cache-Control":
			"public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
	}),
	staleTime: 1000 * 30,
});

function RouteComponent() {
	return (
		<section className="md:w-7xl p-3">
			<div className="flex items-center justify-center gap-2 mb-4">
				<GamepadIcon className="w-5 h-5 text-primary" />
				<h1 className="text-lg font-semibold text-foreground">游戏搜索</h1>
			</div>

			<div className="mx-auto md:w-1/2 items-center justify-center my-2">
				<SearchInput />
			</div>

			<div className="grid grid-cols-3 gap-4 md:grid-cols-6">
				<SearchlistComponent />
			</div>
		</section>
	);
}
