import { GameCard } from "@web/components/home/card";
import { Skeleton } from "@web/components/ui/skeleton";
import type { getGameDetail } from "@web/server/game";
import { useEffect } from "react";

type GameData = NonNullable<Awaited<ReturnType<typeof getGameDetail>>>;

export function GameHeader({ game, id }: { game: GameData; id: string }) {
	const olangTitle = game?.vn?.titles?.find(
		(t) => t.lang === game.vn?.olang && (t.title ?? "").trim() !== "",
	)?.title;
	const image = game?.vn?.image as unknown as {
		imageUrl?: string | null;
		thumbhash?: string | null;
	} | null;

	// 数据就绪后向 head 注入 preload，让封面下载在 VT 动画期间就开始，
	// 动画结束时大图已可解码渲染；卸载时清理避免残留失效预载。
	useEffect(() => {
		const href = image?.imageUrl;
		if (!href) return;
		const link = document.createElement("link");
		link.rel = "preload";
		link.as = "image";
		link.href = href;
		document.head.appendChild(link);
		return () => {
			link.remove();
		};
	}, [image?.imageUrl]);

	return (
		<>
			{/* Cover and basic info section */}
			<div className="sm:float-right text-center sm:text-right sm:ml-4 pb-4 relative">
				<div className="relative inline-block">
					<div
						className={`${
							(game?.vn?.image?.height ?? 0) > 0 &&
							(game?.vn?.image?.height ?? 0) < (game?.vn?.image?.width ?? 0)
								? "min-w-72.5"
								: "w-55"
						} relative overflow-hidden text-left`}
						// 与列表卡片 GameCard.Item 同名的 view-transition-name，路由切换时封面「飞入」详情页
						style={{ viewTransitionName: `game-cover-${id}` }}
					>
						<Skeleton className="absolute inset-0 w-full h-full rounded-lg" />
						<GameCard.Image
							width={game?.vn?.image?.width ?? 200}
							height={game?.vn?.image?.height ?? 300}
							thumbhash={image?.thumbhash}
							// 详情页主封面是导航关键视觉：立即加载 + 高优先级抓取，
							// 异步解码不阻塞 VT 动画帧；与 thumbhash 占位图配合平滑呈现
							loading="eager"
							fetchPriority="high"
							decoding="async"
							// 详情页主封面：缓存命中时跳过浮现动画，避免重复访问的喧宾夺主
							alwaysAnimate={false}
							src={image?.imageUrl ?? "/No-Image-Placeholder.svg.webp"}
							alt={olangTitle || "null"}
							cSexualAvg={game?.vn?.image?.cSexualAvg}
							className="rounded-lg w-full h-full object-cover"
						/>
					</div>
				</div>
			</div>

			{/* Main content section */}
			<div className="overflow-hidden wrap-break-word">
				<h1
					className="font-semibold text-2xl leading-[1.2] mt-2 w-fit"
					style={{
						viewTransitionName: `game-title-${id}`,
						viewTransitionClass: "vt-text",
					}}
				>
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
