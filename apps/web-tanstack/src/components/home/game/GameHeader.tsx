import { GameCard } from "@web/components/home/card";
import { Skeleton } from "@web/components/ui/skeleton";
import { getImageUrl } from "@web/lib";
import type { getGameDetail } from "@web/server/game";

type GameData = NonNullable<Awaited<ReturnType<typeof getGameDetail>>>;

export function GameHeader({ game }: { game: GameData }) {
	const olangTitle = game?.vn?.titles?.find(
		(t) => t.lang === game.vn?.olang && t.title.trim() !== "",
	)?.title;

	return (
		<>
			{/* Cover and basic info section */}
			<div className="sm:float-right text-center sm:text-right sm:ml-4 pb-4 relative">
				<div className="relative inline-block">
					<div
						className={`${
							game?.vn?.image?.height &&
							game?.vn?.image?.height < game?.vn?.image?.width
								? "min-w-72.5"
								: "max-w-55"
						} relative overflow-hidden text-left`}
					>
						<Skeleton className="absolute inset-0 w-full h-full rounded-lg" />
						<GameCard.Image
							width={game?.vn?.image?.width ?? 200}
							height={game?.vn?.image?.height ?? 300}
							loading="lazy"
							decoding="async"
							src={getImageUrl({
								imageId: game?.vn?.image?.id,
								width: game?.vn?.image?.width,
								height: game?.vn?.image?.height,
							})}
							alt={olangTitle || "null"}
							cSexualAvg={game?.vn?.image?.cSexualAvg}
							className="rounded-lg w-full h-full object-cover"
						/>
					</div>
				</div>
			</div>

			{/* Main content section */}
			<div className="overflow-hidden wrap-break-word">
				<h1 className="font-semibold text-2xl leading-[1.2] mt-2">
					{olangTitle || "null"}
				</h1>

				{/* Aliases */}
				{game?.vn?.alias && (
					<div className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-[1.2]">
						别名:{" "}
						{game?.vn?.alias
							.split("\n")
							.flatMap((s) => {
								const trimmed = s.trim();
								return trimmed ? [trimmed] : [];
							})
							.filter(
								(s) =>
									s !==
									game?.vn?.titles?.find((t) => t.lang === "zh-Hans")?.title,
							)
							.join(", ")}
					</div>
				)}
			</div>
		</>
	);
}
