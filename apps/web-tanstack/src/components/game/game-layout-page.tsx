import { Outlet } from "@tanstack/react-router";
import { GameHeader } from "@web/components/home/game/GameHeader";
import { GameInfo } from "@web/components/home/game/GameInfo";
import { GameTabs } from "@web/components/home/game/GameTabs";
import { Glgczujm } from "@web/components/home/game/tips";
import { Card, CardContent } from "@web/components/ui/card";
import { useIdlePreload } from "@web/hooks/use-idle-preload";

export default function GameLayoutPage({
	game,
	id,
}: {
	game: any;
	id: string;
}) {
	// 首屏渲染完成后，空闲时预取各 tab 的 JS chunk + loader 数据，
	// 切换 tab 时命中路由缓存，体验如 SPA 般即时；不阻塞首屏加载。
	useIdlePreload([
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
	]);

	return (
		<div className="space-y-3">
			<Card className="overflow-hidden wrap-break-word border-0 pb-0 ">
				<CardContent>
					<GameHeader game={game} />
					<GameInfo game={game} />
				</CardContent>
			</Card>

			<GameTabs id={id} />
			<Card className="p-1">
				<CardContent className="p-1">
					<Outlet />
					<Glgczujm />
				</CardContent>
			</Card>
		</div>
	);
}
