import {
	GameCover,
	GameTitle,
} from "@web/components/home/game/GameHeader";
import { GameInfo } from "@web/components/home/game/GameInfo";
import { DownloadSpotlight } from "@web/components/home/game/download-spotlight";
import { GameTabs, gameTabOf } from "@web/components/home/game/GameTabs";
import { Glgczujm } from "@web/components/home/game/tips";
import { Card, CardContent } from "@web/components/ui/card";
import { useIdlePreload } from "@web/hooks/use-idle-preload";
import type { ReactNode } from "react";

/**
 * 游戏详情页外壳（三明治：概览卡 → 页签 → 内容卡）。
 *
 * 三块共用顶栏的语言：rounded-2xl + 发丝描边（ring-border/60）+ 同一套
 * Card 内边距。内容卡不再套一层 p-1 的内嵌卡——页签切换时内容区就是页面本身，
 * 各 tab（下载/详情/攻略/讨论/统计/系列）自己只负责区块内部的排版。
 */
export default function GameLayoutPage({
	game,
	id,
	path,
	children,
}: {
	game: any;
	id: string;
	/** 当前请求路径（furin 从 page/layout props 下发）；SSR 下用它判定选中页签 */
	path?: string;
	/** 当前页签内容：furin 用 children 渲染子页面，替代 TanStack 的 <Outlet/> */
	children?: ReactNode;
}) {
	// 首屏渲染完成后，空闲时预取各 tab 的 JS chunk + loader 数据，
	// 切换 tab 时命中路由缓存，体验如 SPA 般即时；不阻塞首屏加载。
	// 错峰 300ms 逐个预取：返回列表时在途任务更少，主线程/网络让路给导航。
	useIdlePreload(
		[
			(router) => {
				void router.prefetch({ to: "/:id", params: { id } });
			},
			(router) => {
				void router.prefetch({ to: "/:id/characters", params: { id } });
			},
			(router) => {
				void router.prefetch({ to: "/:id/introduction", params: { id } });
			},
			(router) => {
				void router.prefetch({ to: "/:id/comment", params: { id } });
			},
			(router) => {
				void router.prefetch({ to: "/:id/translate", params: { id } });
			},
			(router) => {
				void router.prefetch({ to: "/:id/relations", params: { id } });
			},
		],
		{ staggerMs: 300 },
	);

	// 下载 tab 才在封面下方给出「下载」定位按钮（其它 tab 没有文件列表可定位）
	const isDownloadTab = gameTabOf(path ?? "") === "download";

	return (
		<div className="space-y-2">
			{/* 概览卡：桌面左右两栏（信息 / 封面），移动端封面在前。
			    pb-0 交给 TagsCard 自己的下边距，避免卡片底部多出一截空白 */}
			<Card className="py-0 wrap-break-word ring-border/60">
				<CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 sm:px-5">
					<div className="order-2 min-w-0 sm:order-1">
						<GameTitle game={game} id={id} />
						<GameInfo game={game} gameId={id} />
					</div>
					{/* 移动端单列：封面自行居中、按钮占满整行；桌面端第二轨宽 = 封面宽 */}
					<div className="order-1 flex flex-col gap-2 self-start sm:order-2">
						<GameCover game={game} id={id} />
						{/* 所有页签都保留「下载」入口；不在下载页签时点击会先切回去 */}
						<DownloadSpotlight gameId={id} isDownloadTab={isDownloadTab} />
					</div>
				</CardContent>
			</Card>

			<GameTabs id={id} path={path} />

			<Card className="ring-border/60">
				<CardContent>
					{/* 下载定位按钮的高亮锚点：包住 tab 内容本体（不含下方推荐位） */}
					<div data-download-target="">
						{children}
					</div>
					<Glgczujm />
				</CardContent>
			</Card>
		</div>
	);
}
