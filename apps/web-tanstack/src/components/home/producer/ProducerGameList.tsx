import { Await, getRouteApi } from "@tanstack/react-router";
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
		<div className="grid grid-cols-3 gap-4 md:grid-cols-6">
			<Await
				promise={gameList}
				fallback={
					<>
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
					</>
				}
			>
				{(gameList) => (
					<>
						{!gameList || gameList.length === 0 ? (
							<div className="text-center items-center">没找相关的游戏喵～</div>
						) : (
							gameList.map((item) => {
								if (!item) return null;

								const title =
									item.titles?.find(
										(t) =>
											t.lang === item.olang && (t.title ?? "").trim() !== "",
									)?.title ?? "null";

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
					</>
				)}
			</Await>
		</div>
	);
};
