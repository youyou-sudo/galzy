import { defineRoute } from "@teyik0/furin";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import TagDetailPage from "@web/components/tags/tag-detail-page";
import { seoTemplate } from "@web/config/seoTemplate";
import { Link } from "@web/lib/nav";
import { getTagData, getVnListByTag } from "@web/server/tags";
import { recordTagView } from "@web/server/views";
import { t } from "elysia";
import { useEffect } from "react";

const paramsSchema = t.Object({ tagId: t.String() });

/** getTagData 的返回形状（BFF 侧类型收敛为 unknown，这里显式定型） */
type TagDetail = {
	name?: string | null;
	zht_name?: string | null;
	description?: string | null;
	zht_description?: string | null;
	children?: unknown[];
	[key: string]: unknown;
} | null;

export const route = defineRoute("/tags/[tagId]")
	.config({ mode: "isr", revalidate: 300, params: paramsSchema })
	.loader(async ({ params }) => {
		const { tagId } = params;
		const [tag, game] = await Promise.all([
			getTagData({ data: { tagId } }),
			// includeChildren：对齐 VNDB 语义（该标签或其任意后代标签），
			// 否则 meta/组织类标签自身没有直接标注作品，列表会是空的
			getVnListByTag({
				data: { tagId, pageIndex: 0, pageSize: 24, includeChildren: true },
			}),
		]);
		return { tag: tag as TagDetail, game, tagId };
	})
	.head(({ tag }) => ({
		meta: [
			{
				title: `${tag?.zht_name || tag?.name || "标签"} | ${seoTemplate.title}`,
			},
			{
				name: "description",
				content: `${tag?.zht_name || tag?.name || "标签"} 类型下的游戏列表，类型介绍：${tag?.zht_description || tag?.description || "无"}`,
			},
		],
	}))
	.page(({ tag, tagId }) => (
		<TagDetailRoute tag={tag} tagId={tagId} />
	));

function TagDetailRoute({
	tag,
	tagId,
}: {
	tag: TagDetail;
	tagId: string;
}) {
	const tagName = tag?.zht_name || tag?.name || "标签";

	// 旧 beforeLoad/onEnter 的埋点：仅在真实进入页面时计 view，
	// 预加载（悬停/空闲）不触发 effect，不会污染热榜
	useEffect(() => {
		void recordTagView({ data: { tagId } }).catch(() => {
			// silently ignore recording failures
		});
	}, [tagId]);

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
			<TagDetailPage tag={tag} />
		</div>
	);
}
