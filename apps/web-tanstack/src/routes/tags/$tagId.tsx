import { api } from '@libs'
import { createFileRoute, Link } from '@tanstack/react-router'
import TagDetailPage from '@web/components/tags/tag-detail-page'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@web/components/ui/breadcrumb'
import { seoTemplate } from '@web/config/seoTemplate'
import { getTagData, getVnListByTag } from '@web/server/tags'

export const Route = createFileRoute('/tags/$tagId')({
	loader: async ({ params }) => {
		const { tagId } = params;
		// Record tag view for hot ranking (non-blocking)
		try {
			await api.views.tag.post({ tagId });
		} catch {
			// silently ignore recording failures
		}
		return {
			tag: await getTagData({ data: { tagId } }),
			game: await getVnListByTag({
				data: { tagId, pageIndex: 0, pageSize: 24 },
			}),
			tagId,
		};
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.tag?.zht_name || loaderData?.tag?.name || "标签"} | ${seoTemplate.title}`,
			},
			{
				name: "description",
				content: `${
					loaderData?.tag?.zht_name || loaderData?.tag?.name || "标签"
				} 类型下的游戏列表，类型介绍：${
					loaderData?.tag?.zht_description ||
					loaderData?.tag?.description ||
					"无"
				}`,
			},
		],
	}),
	headers: () => ({
		"Cache-Control": "public, max-age=300, stale-while-revalidate=600",
	}),

	component: () => {
		const loaderData = Route.useLoaderData();
		const tagName = loaderData.tag?.zht_name || loaderData.tag?.name || "标签";
		return (
			<div className="max-w-7xl mx-auto py-6 px-4 sm:px-0">
				<Breadcrumb className="mb-4">
					<BreadcrumbList>
						<BreadcrumbItem><BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink></BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem><BreadcrumbLink render={<Link to="/tags" />}>标签</BreadcrumbLink></BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem><BreadcrumbPage>{tagName}</BreadcrumbPage></BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<TagDetailPage {...loaderData} />
			</div>
		);
	},
});
