import { createFileRoute, Link } from "@tanstack/react-router";
import { TagDetailPageSkeleton } from "@web/components/shared/route-skeletons";
import TagDetailPage from "@web/components/tags/tag-detail-page";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import { seoTemplate } from "@web/config/seoTemplate";
import { getTagData, getVnListByTag } from "@web/server/tags";
import { recordTagView } from "@web/server/views";
import { Fragment } from "react";

export const Route = createFileRoute("/tags/$tagId")({
	pendingComponent: () => <TagDetailPageSkeleton />,
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
		// VNDB 层级是 DAG，祖先由 API 按 depth 降序返回（根最远 → 最近父级 → 当前标签）
		const ancestors: Array<{
			id: string;
			name?: string | null;
			zht_name?: string | null;
		}> = loaderData.tag?.ancestors ?? [];
		return (
			<div>
				<Breadcrumb className="mb-4">
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink render={<Link to="/tags" />}>标签</BreadcrumbLink>
						</BreadcrumbItem>
						{ancestors.map((a) => (
							<Fragment key={a.id}>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbLink
										render={<Link to="/tags/$tagId" params={{ tagId: a.id }} />}
									>
										{a.zht_name || a.name || a.id}
									</BreadcrumbLink>
								</BreadcrumbItem>
							</Fragment>
						))}
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
