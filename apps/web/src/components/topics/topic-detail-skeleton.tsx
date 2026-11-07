import { CommentThreadSkeleton } from "@web/components/cmments/comment-skeleton";
import { RichContentSkeleton } from "@web/components/rich-content-skeleton";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import { SectionHeader } from "@web/components/shared/section-header";
import { Card, CardContent, CardHeader } from "@web/components/ui/card";
import { Skeleton } from "@web/components/ui/skeleton";
import { MessageSquare } from "lucide-react";

/**
 * 帖子详情页加载态：外壳与真实页同构（面包屑 → Card → 作者行 → 正文 → 评论区），
 * 数据到达时只替换内容，不产生整体高度跳动。
 *
 * 触发场景：
 * - 详情页 loader 只服务首屏；站内切页 / 悬停预取走 `?_furin=data`，loader 返回后
 *   才 commit，正常不会出现「数据未到」；
 * - 兜底覆盖 loader 未返回内容（topic 为空）且查询仍在 pending 的情况 —— 旧实现
 *   这时会直接渲染「帖子不存在」空态，属于误报。
 *
 * 面包屑只保留「首页 / 论坛」两段静态文字（不伪造帖子标题），不 import 路由 API，
 * 因此可脱离 Router 直接 renderToString。
 */
export function TopicDetailSkeleton() {
	return (
		<div className="mx-auto w-full max-w-4xl" aria-busy="true">
			<Breadcrumb className="mb-4">
				<BreadcrumbList>
					<BreadcrumbItem>
						<span>首页</span>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<span>论坛</span>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<Skeleton className="w-24 h-3" aria-hidden />
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			{/* 标题未知：骨架不外露真实标题，避免和 SEO / 屏幕阅读器抢语义 */}
			<Card aria-hidden>
				<CardHeader className="gap-3">
					<Skeleton className="w-3/4 h-7" />
					<div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
						<Skeleton className="shrink-0 rounded-full size-8" />
						<Skeleton className="w-24 h-4" />
						<Skeleton className="w-16 h-3" />
					</div>
				</CardHeader>
				<CardContent>
					<RichContentSkeleton />
				</CardContent>
			</Card>

			<section className="mt-8">
				<SectionHeader icon={MessageSquare} title="评论" />
				<CommentThreadSkeleton />
			</section>
		</div>
	);
}
