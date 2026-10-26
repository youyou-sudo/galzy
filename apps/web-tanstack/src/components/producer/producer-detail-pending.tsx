import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { ProducerGameGridSkeleton } from "@web/components/producer/producer-game-grid";
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
	CardDescription,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { Skeleton } from "@web/components/ui/skeleton";
import { producerHeroStore } from "@web/stores/producerHeroStore";

// 简介骨架 3 行宽度（写死，不用随机数）：贴合真实 BBCode 段落的参差感
const DESCRIPTION_LINE_WIDTHS = ["w-full", "w-[92%]", "w-3/5"] as const;

/**
 * 厂商详情页的 pending 态（冷缓存直达 / 刷新 / loader 未返回）。
 *
 * 不再整页骨架：面包屑、卡片外壳、游戏栅格都是真实 HTML（与 producer-detail-page
 * 完全同款），固定结构不参与加载态，数据到达时只替换卡片内部的字段，不整页重排。
 * 只有 loader 返回后才有的内容各自出骨架：厂商名（入口带了名字就直接复用）、
 * 别名、简介、以及游戏列表的卡片内部。
 */
export function ProducerDetailPending({ pid }: { pid: string }) {
	// 只消费与当前 pid 匹配的入口数据，切换厂商后不会误用上一个名字
	const name = useSelector(producerHeroStore, (state) =>
		state.pid === pid ? state.name : "",
	);

	return (
		<div>
			<Breadcrumb className="mb-4">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/producer" />}>
							厂商
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						{name ? (
							// 与真实页一致：当前厂商用 BreadcrumbPage（非链接、aria-current=page），
							// 避免对正在 loading 的同一条路由再挂一次 viewport 预取
							<BreadcrumbPage>{name}</BreadcrumbPage>
						) : (
							// 唯一允许的面包屑占位：入口没带名字时只在这里放一个词宽的骨架
							<Skeleton aria-hidden className="w-20 h-4" />
						)}
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<section className="space-y-3 w-full">
				{/* 与 producer-detail-page 完全一致的卡片外壳：厂商名仍挂同名
				    view-transition-name，从条目页/列表点进来时厂商名继续做文字飞行 */}
				<Card className="w-full">
					<CardHeader className="text-center">
						<CardTitle
							className="items-center text-2xl"
							// 有真实名字才挂 VT 名：名字未知时旧页文字不该飞进一个骨架盒
							style={
								name
									? {
											viewTransitionName: `producer-name-${pid}`,
											viewTransitionClass: "producer-name vt-text",
										}
									: undefined
							}
						>
							{/* 标题骨架高度对齐 text-2xl + leading-snug 的实际行高（33px） */}
							{name || <Skeleton aria-hidden className="mx-auto w-48 h-8" />}
						</CardTitle>
						{/* 别名：真实数据是换行连成一行，这里只占一行 */}
						<CardDescription>
							{/* 别名骨架高度对齐 text-sm 行高（20px） */}
							<Skeleton aria-hidden className="mx-auto w-56 h-5" />
						</CardDescription>
						<CardContent className="p-0 text-center">
							{/* 简介：真实简介是一段 BBCode 富文本，这里只占三行 */}
							<div className="space-y-1.5" aria-hidden>
								{DESCRIPTION_LINE_WIDTHS.map((width) => (
									// 真实简介居中（CardContent text-center），骨架行同样居中
									<Skeleton key={width} className={`mx-auto h-4 ${width}`} />
								))}
							</div>
						</CardContent>
					</CardHeader>
				</Card>
			</section>

			<section className="mt-4">
				<ProducerGameGridSkeleton />
			</section>
		</div>
	);
}
