import { Await, getRouteApi } from "@tanstack/react-router";
import {
	ProducerGameGrid,
	ProducerGameGridSkeleton,
} from "@web/components/producer/producer-game-grid";
import { EmptyState } from "@web/components/shared/empty-state";
import { preferredTitleFrom } from "@web/lib/game-title";
import { Gamepad2 } from "lucide-react";
import { useState } from "react";
import { GameCard } from "../card";

const apiroute = getRouteApi("/producer/$pid");

function clickedGameKey(pid: string) {
	return `galzy:vt:producer:${pid}`;
}

// 回程配对：从 sessionStorage 恢复被点卡，首帧挂 view-transition-name
function readClickedGame(pid: string): string | null {
	try {
		if (typeof sessionStorage === "undefined") return null;
		return sessionStorage.getItem(clickedGameKey(pid));
	} catch {
		return null;
	}
}

export const ProducerGamelist = () => {
	const { pid } = apiroute.useParams();
	const { gameList } = apiroute.useLoaderData();
	const [clickedId, setClickedId] = useState<string | null>(() =>
		readClickedGame(pid),
	);

	const handleActivate = (gameid: string) => {
		setClickedId(gameid);
		try {
			sessionStorage.setItem(clickedGameKey(pid), gameid);
		} catch {
			// sessionStorage 不可用时仅影响回程动画配对
		}
	};

	return (
		<Await promise={gameList} fallback={<ProducerGameGridSkeleton />}>
			{(gameList) => (
				<ProducerGameGrid>
					{!gameList || gameList.length === 0 ? (
						<EmptyState
							icon={Gamepad2}
							title="没找到相关的游戏喵～"
							description="换一个厂商或稍后再来看看"
							className="col-span-full"
						/>
					) : (
						gameList.map((item) => {
							if (!item) return null;

							const title =
								preferredTitleFrom(item.titles, item.olang) ?? "null";

							return (
								<GameCard.Item
									key={item.id}
									gameid={String(item.id)}
									width={item.image_width ?? 200}
									height={item.image_height ?? 300}
									thumbhash={item.image_thumbhash}
									src={item.image_url ?? "/No-Image-Placeholder.svg.webp"}
									cSexualAvg={item.c_sexual_avg}
									title={title}
									hasVT={clickedId === String(item.id)}
									onActivate={handleActivate}
								/>
							);
						})
					)}
				</ProducerGameGrid>
			)}
		</Await>
	);
};
