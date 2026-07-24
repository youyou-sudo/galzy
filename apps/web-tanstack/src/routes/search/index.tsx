import { createFileRoute } from "@tanstack/react-router";
import { seoTemplate } from "@web/config/seoTemplate";
import SearchPage from "@web/components/search/search-page";
import { getSearch, SearchSchema } from "@web/server/search";

export const Route = createFileRoute("/search/")({
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
		"Cache-Control": "public, max-age=300",
		Vary: "Accept, Accept-Encoding",
	}),
	staleTime: 1000 * 30,

	component: SearchPage,
});
