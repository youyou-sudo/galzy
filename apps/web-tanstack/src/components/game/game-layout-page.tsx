import { Outlet } from "@tanstack/react-router";
import { GameHeader } from "@web/components/home/game/GameHeader";
import { GameInfo } from "@web/components/home/game/GameInfo";
import { GameTabs } from "@web/components/home/game/GameTabs";
import { Glgczujm } from "@web/components/home/game/tips";
import { Card, CardContent } from "@web/components/ui/card";
import { GameViewsTrackEvents } from "@web/components/umami/track-events";

export default function GameLayoutPage({
	game,
	id,
}: {
	game: any;
	id: string;
}) {
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
			<GameViewsTrackEvents idtitle={id} />
		</div>
	);
}
