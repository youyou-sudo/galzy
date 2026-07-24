import { createFileRoute } from "@tanstack/react-router";
import TagsPage from "@web/components/tags/tags-page";
import { seoTemplate } from "@web/config/seoTemplate";
import { getSearchTags, SearchTagsSchema } from "@web/server/tags";

export const Route = createFileRoute("/tags/")({
	component: () => {
		const { tags, q } = Route.useLoaderData();
		return (
			<TagsPage
				tags={
					tags as
						| {
								hits: Array<{ id: string; name: string; zh_name?: string }>;
								totalHits: number;
						  }
						| null
						| undefined
				}
				q={q}
			/>
		);
	},
	validateSearch: SearchTagsSchema,
	loaderDeps: ({ search: { q } }) => ({ q }),
	loader: async ({ deps }) => {
		return {
			tags: await getSearchTags({ data: { q: deps.q, limit: 200 } }),
			q: deps.q,
		};
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `标签检索 - ${loaderData?.q || "所有标签"} | ${seoTemplate.title}`,
			},
			{
				name: "description",
				content: `浏览和搜索游戏标签，当前${loaderData?.q ? `搜索"${loaderData.q}"` : "查看所有标签"}，共 ${loaderData?.tags?.totalHits || 0} 个标签`,
			},
		],
	}),
	headers: () => ({
		"Cache-Control": "public, max-age=300",
		Vary: "Accept, Accept-Encoding",
	}),
	staleTime: 1000 * 30,
});
