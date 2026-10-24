import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { GameCard } from "@web/components/home/card";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { Skeleton } from "@web/components/ui/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@web/components/ui/tabs";
import { tagHeroStore } from "@web/stores/tagHeroStore";
import { Network, Tags } from "lucide-react";
import { useState } from "react";

// 简介骨架 3 行宽度（写死，不用随机数）：贴合真实简介段落的参差感
const DESCRIPTION_LINE_WIDTHS = ["w-full", "w-[92%]", "w-3/5"] as const;
// 子标签药丸骨架的写死宽度，模拟真实标签长短不一（唯一值，可直接当 key）
const CHILD_TAG_WIDTHS = [
	"w-12",
	"w-20",
	"w-14",
	"w-16",
	"w-24",
	"w-10",
	"w-18",
	"w-22",
] as const;
// 相关游戏首屏骨架数量：窄屏三列正好两行，md 六列时是一整行
const RELATED_GAME_SKELETONS = 6;

/**
 * 标签详情页的 pending 态（冷缓存直达/刷新，或 loader 未返回时）。
 *
 * 不再整页骨架：面包屑、卡片外壳、两个页签、相关游戏小标题都渲染真实 HTML，
 * 只给「loader 返回后才有的内容」各自出加载态：简介、子标签、标签层级关系、
 * 相关游戏列表。标签名如果从入口（标签流/标签库/热门标签/层级图）带过来
 * （tagHeroStore），标题与面包屑直接复用真实文案，不出骨架。
 */
export function TagDetailPending({ tagId }: { tagId: string }) {
	// 只消费与当前 tagId 匹配的入口数据，切换标签后不会误用上一个标签的名字
	const hero = useSelector(tagHeroStore, (s) =>
		s.id === tagId ? s.data : null,
	);
	const name = hero?.name?.trim() ?? "";
	const [tab, setTab] = useState("children");

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
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						{name ? (
							// 与真实页一致：当前标签用 BreadcrumbPage（非链接、aria-current=page），
							// 避免对正在 loading 的同一条路由再挂一次 viewport 预取
							<BreadcrumbPage>{name}</BreadcrumbPage>
						) : (
							// 唯一允许的面包屑占位：入口没带名字时只在这里放一个词宽的骨架
							<Skeleton aria-hidden className="h-4 w-20" />
						)}
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<section className="w-full">
				{/* 与 tag-detail-page 完全一致的卡片外壳：数据到达时只替换内容，
				    不会整块卡片重排 */}
				<Card className="w-full">
					<CardHeader>
						<CardTitle className="text-2xl text-center items-center">
							{name || <Skeleton aria-hidden className="mx-auto h-8 w-48" />}
						</CardTitle>
						{/* 简介：真实简介是一段 BBCode 富文本，这里只占三行 */}
						<div className="space-y-1.5" aria-hidden>
							{DESCRIPTION_LINE_WIDTHS.map((width) => (
								<Skeleton key={width} className={`h-4 ${width}`} />
							))}
						</div>
					</CardHeader>
					<CardContent>
						{/* 页签是真实内容：pending 期间可以在两个面板之间切换、各自看到
						    对应的骨架；数据到达后由真实页接管（默认回到子标签） */}
						<Tabs value={tab} onValueChange={setTab} className="w-full">
							<TabsList className="h-8">
								<TabsTrigger value="children">
									<Tags className="size-3.5" />
									子标签
								</TabsTrigger>
								<TabsTrigger value="hierarchy">
									<Network className="size-3.5" />
									标签层级关系
								</TabsTrigger>
							</TabsList>
							<TabsContent value="children">
								<ChildTagsSkeleton />
							</TabsContent>
							<TabsContent value="hierarchy">
								<TagHierarchySkeleton />
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>
			</section>

			{/* 小标题是静态文案，直接渲染真实内容（不参与加载态） */}
			<div className="mt-4 text-sm text-center items-center opacity-30 italic">
				相关游戏，过滤自 VNDB
			</div>
			<section>
				<TagRelatedGamesSkeleton />
			</section>
		</div>
	);
}

/** 子标签面板骨架：真实标签流收起态恒为一行药丸（max-h-6 + overflow-hidden），
 *  骨架同样裁到一行，窄屏上数据到达时不会整块回缩几十像素 */
export function ChildTagsSkeleton() {
	return (
		<div className="flex flex-wrap gap-1.5 max-h-6 overflow-hidden" aria-hidden>
			{CHILD_TAG_WIDTHS.map((width) => (
				<Skeleton key={width} className={`h-5 rounded-4xl ${width}`} />
			))}
		</div>
	);
}

/**
 * 标签层级关系面板骨架：真实画布是一块带边框的圆角区域（高度上限 70vh），
 * 左上角悬浮统计数字。骨架按同样的外框占位，避免数据到达时整块高度跳变。
 */
export function TagHierarchySkeleton() {
	return (
		<div
			className="relative mt-2 h-64 w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20"
			aria-hidden
		>
			<Skeleton className="absolute top-2 left-2 h-5 w-40 rounded-full" />
			<div className="absolute inset-0 flex items-center justify-center gap-3">
				<Skeleton className="h-7 w-24 rounded-lg" />
				<Skeleton className="h-7 w-24 rounded-lg" />
				<Skeleton className="h-7 w-24 rounded-lg" />
			</div>
		</div>
	);
}

/** 相关游戏列表骨架：与 TagGamelist 的栅格一致（3 列 / md 6 列） */
export function TagRelatedGamesSkeleton() {
	return (
		<div className="grid grid-cols-3 gap-4 md:grid-cols-6" aria-hidden>
			{Array.from({ length: RELATED_GAME_SKELETONS }, (_, index) => (
				<GameCard.ListSkeleton key={index} />
			))}
		</div>
	);
}
