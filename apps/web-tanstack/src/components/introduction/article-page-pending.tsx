import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { PageHeader } from "@web/components/shared/page-header";
import { Button } from "@web/components/ui/button";
import { Skeleton } from "@web/components/ui/skeleton";
import { articleHeroStore } from "@web/stores/articleHeroStore";
import { ArrowLeft, FileText, User } from "lucide-react";

// 正文骨架：每段的行宽写死（不用随机数）—— 长度参差才像真实排版，
// 且 pending 重渲染时宽度不会抖动。
const BODY_PARAGRAPHS = [
	["w-full", "w-[97%]", "w-11/12", "w-3/5"],
	["w-full", "w-[94%]", "w-2/3"],
	["w-11/12", "w-3/4"],
] as const;

/**
 * 攻略文章详情的 pending 态（冷缓存直达 / loader 未返回）。
 *
 * 本页渲染在游戏详情页的内容卡里（见 ArticlePage），pending 只替换内容卡内部：
 * 页头是真实的 PageHeader —— 标题从列表入口带过来时直接复用，并与列表条目共用
 * 同名 view-transition-name（路由切换时标题继续飞入页头，数据到达前后是同一组
 * VT，不会闪），返回列表按钮也是真实可点的链接。
 * 只有 loader 返回后才有的内容各自出骨架：作者/日期与正文。
 */
export function ArticlePagePending({
	articleId,
	gameId,
}: {
	articleId: string;
	gameId: string;
}) {
	// 只消费与当前 articleId 匹配的入口标题，切到别的文章后不会误用上一篇标题
	const title = useSelector(articleHeroStore, (state) =>
		state.id === articleId ? (state.data?.title ?? "") : "",
	);

	return (
		<section>
			<PageHeader
				icon={FileText}
				title={
					title ? (
						// 文案与 ArticlePage 的标题一致，样式也一致：VT 旧/新快照是同一串
						// 文本时由 CSS（.article-title）直接原位替换再飞入，无重影
						<span
							className="w-fit"
							style={{
								viewTransitionName: `article-title-${articleId}`,
								viewTransitionClass: "article-title",
							}}
						>
							{title}
						</span>
					) : (
						// 入口没带标题时才出标题骨架（高度对齐 PageHeader 的 h1），不伪造文案；
						// 此时不挂 VT 名 —— 旧页文字不该飞进一个骨架盒。
						// as="span"：骨架落在 h1 里，h1 只允许 phrasing content（div 会报
						// 「<div> cannot be a descendant of <h1>」），block 只为让宽高生效
						<Skeleton as="span" aria-hidden className="block w-48 h-8" />
					)
				}
				description={
					<span className="flex flex-wrap gap-x-2 gap-y-1 items-center text-xs text-muted-foreground">
						<span className="inline-flex gap-1 items-center">
							<User aria-hidden="true" className="size-3.5" />
							{/* 作者来自 loader，只出一段词宽的骨架。as="span"：描述行由
							    PageHeader 渲染在 <p> 里，<p> 只允许 phrasing content */}
							<Skeleton as="span" aria-hidden className="w-16 h-3.5" />
						</span>
						<span aria-hidden="true">·</span>
						{/* 「攻略」是静态文案，属于真实外壳 */}
						<span>攻略</span>
						<span aria-hidden="true">·</span>
						{/* 发布日期同样来自 loader */}
						<Skeleton as="span" aria-hidden className="w-20 h-3.5" />
					</span>
				}
				actions={
					<Button
						variant="outline"
						size="sm"
						// render 成 <a> 时必须关掉 nativeButton，否则 Base UI 会告警
						// 「expected a native <button>」（语义仍是链接，见 GameTabs）
						nativeButton={false}
						render={<Link to="/$id/introduction" params={{ id: gameId }} />}
					>
						<ArrowLeft className="size-4" />
						返回列表
					</Button>
				}
			/>

			{/* 正文与页头/内容卡同宽（与 ArticlePage 一致）：攻略多为短段落，
			    这里只占几段文字行，不做整页骨架 */}
			<div className="space-y-4" aria-hidden>
				{BODY_PARAGRAPHS.map((lines) => (
					<div key={lines.join(" ")} className="space-y-2">
						{lines.map((width) => (
							<Skeleton key={width} className={`h-4 ${width}`} />
						))}
					</div>
				))}
			</div>
		</section>
	);
}
