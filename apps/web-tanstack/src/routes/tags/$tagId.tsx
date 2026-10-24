import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import TagDetailPage from "@web/components/tags/tag-detail-page";
import { TagDetailPending } from "@web/components/tags/tag-detail-pending";
import { seoTemplate } from "@web/config/seoTemplate";
import { getTagData, getVnListByTag } from "@web/server/tags";
import { recordTagView } from "@web/server/views";

export const Route = createFileRoute("/tags/$tagId")({
	pendingComponent: PendingTagDetail,
	loader: async ({ params }) => {
		const { tagId } = params;
		const [tag, game] = await Promise.all([
			getTagData({ data: { tagId } }),
			// includeChildren：对齐 VNDB 语义（该标签或其任意后代标签），
			// 否则 meta/组织类标签自身没有直接标注作品，列表会是空的
			getVnListByTag({
				data: { tagId, pageIndex: 0, pageSize: 24, includeChildren: true },
			}),
		]);
		return {
			tag,
			game,
			tagId,
		};
	},
	// 仅在真实进入页面时计 view；预加载(悬停/空闲)不触发 onEnter，不会污染热榜
	onEnter: ({ params }) => {
		void recordTagView({ data: { tagId: params.tagId } }).catch(() => {
			// silently ignore recording failures
		});
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
	headers: ({ params }) => ({
		"Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
		"Cache-Tag": `tag-${params.tagId},page-tag-detail`,
	}),

	component: () => {
		const loaderData = Route.useLoaderData();
		const tagName = loaderData.tag?.zht_name || loaderData.tag?.name || "标签";
		return (
			<div>
				{/* 面包屑只保留最小路径：VNDB 层级是 DAG，把多路径铺开会占满首屏。
				    祖先关系交给下方可折叠的标签层级关系图（TagHierarchy）。 */}
				<Breadcrumb className="mb-4">
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink render={<Link to="/tags" />}>标签</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{tagName}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<TagDetailPage {...loaderData} />
			</div>
		);
	},
});

// pending 态需要 tagId 才能复用入口带过来的标签名（tagHeroStore 按 id 匹配）
function PendingTagDetail() {
	const { tagId } = useParams({ from: "/tags/$tagId" });
	return <TagDetailPending tagId={tagId} />;
}
