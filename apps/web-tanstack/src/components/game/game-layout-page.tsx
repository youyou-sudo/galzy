import { Outlet } from "@tanstack/react-router";
import {
	GameCover,
	GameTitle,
} from "@web/components/home/game/GameHeader";
import { GameInfo } from "@web/components/home/game/GameInfo";
import { GameTabs } from "@web/components/home/game/GameTabs";
import { Glgczujm } from "@web/components/home/game/tips";
import { Card, CardContent } from "@web/components/ui/card";
import { useIdlePreload } from "@web/hooks/use-idle-preload";

/**
 * 游戏详情页外壳（三明治：概览卡 → 页签 → 内容卡）。
 *
 * 三块共用顶栏的语言：rounded-2xl + 发丝描边（ring-border/60）+ 同一套
 * Card 内边距。内容卡不再套一层 p-1 的内嵌卡——页签切换时内容区就是页面本身，
 * 各 tab（下载/攻略/统计/系列）自己只负责区块内部的排版。
 */
export default function GameLayoutPage({
	game,
	id,
}: {
	game: any;
	id: string;
}) {
	// 首屏渲染完成后，空闲时预取各 tab 的 JS chunk + loader 数据，
	// 切换 tab 时命中路由缓存，体验如 SPA 般即时；不阻塞首屏加载。
	// 错峰 300ms 逐个预取：返回列表时在途任务更少，主线程/网络让路给导航。
	useIdlePreload(
		[
			(router) => {
				void router.preloadRoute({ to: "/$id", params: { id } });
			},
			(router) => {
				void router.preloadRoute({ to: "/$id/introduction", params: { id } });
			},
			(router) => {
				void router.preloadRoute({ to: "/$id/comment", params: { id } });
			},
			(router) => {
				void router.preloadRoute({ to: "/$id/translate", params: { id } });
			},
			(router) => {
				void router.preloadRoute({ to: "/$id/relations", params: { id } });
			},
		],
		{ staggerMs: 300 },
	);

	return (
		<div className="space-y-2">
			{/* 概览卡：桌面左右两栏（信息 / 封面），移动端封面在前。
			    pb-0 交给 TagsCard 自己的下边距，避免卡片底部多出一截空白 */}
			<Card className="wrap-break-word py-0 ring-border/60">
				<CardContent className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 sm:px-5">
					<div className="order-2 min-w-0 sm:order-1">
						<GameTitle game={game} id={id} />
						<GameInfo game={game} gameId={id} />
					</div>
					<div className="order-1 self-start sm:order-2">
						<GameCover game={game} id={id} />
					</div>
				</CardContent>
			</Card>

			<GameTabs id={id} />

			<Card className="ring-border/60">
				<CardContent>
					<Outlet />
					<Glgczujm />
				</CardContent>
			</Card>
		</div>
	);
}
