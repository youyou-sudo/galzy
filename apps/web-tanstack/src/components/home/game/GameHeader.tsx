import { useSelector } from "@tanstack/react-store";
import { GameCoverLightbox } from "@web/components/game/game-cover-lightbox";
import { GameCard, useRevealedOnce } from "@web/components/home/card";
import { Skeleton } from "@web/components/ui/skeleton";
import { preferredGameTitle } from "@web/lib/game-title";
import { fullSizeCoverUrl, useThumbHashDataUrl } from "@web/lib/image";
import { commitAfterViewTransition } from "@web/lib/reveal-gate";
import { cn } from "@web/lib/utils";
import { isViewTransitionActive } from "@web/lib/view-transition";
import type { getGameDetail } from "@web/server/game";
import { r18Store } from "@web/stores/r18Store";
import { useEffect, useState } from "react";

type GameData = NonNullable<Awaited<ReturnType<typeof getGameDetail>>>;

/**
 * 展示标题兜底链：中文标题 → olang 标题 → 任意标题 → alias 首个非空行 → "未知作品"。
 * 详情页与列表卡片共用同一条中文优先链，避免「列表日文、详情中文」。
 */
function gameDisplayTitle(game: GameData) {
	const aliasFirstLine = game?.vn?.alias
		?.split("\n")
		.map((line) => line.trim())
		.find((line) => line !== "");
	return preferredGameTitle(game) || aliasFirstLine || "未知作品";
}

/** 别名行：去掉所有中文标题本身（zh-Hans / zh / zh-Hant），多行以「、」连成一行 */
function gameAliases(game: GameData) {
	const titleSet = new Set(
		(game?.vn?.titles ?? [])
			.filter((t) => t.lang?.startsWith("zh") && t.title?.trim())
			.map((t) => t.title?.trim()),
	);
	return (
		game?.vn?.alias
			?.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !titleSet.has(line))
			.join("、") ?? ""
	);
}

/**
 * 详情页右侧封面。
 *
 * 拆成独立组件后，页面外壳可以用 grid 把封面固定在右栏，正文不会再被
 * float 挤压成不可控的窄条；移动端仍先显示封面、再显示标题与信息。
 */
export function GameCover({
	game,
	id,
	className,
}: {
	game: GameData;
	id: string;
	className?: string;
}) {
	const displayTitle = gameDisplayTitle(game);
	const image = game?.vn?.image as unknown as {
		imageUrl?: string | null;
		url?: string | null;
		thumbhash?: string | null;
	} | null;

	// VT 期间大图 gate：客户端导航时本组件在 startViewTransition 的 DOM 更新
	// 回调里挂载，:active-view-transition 此刻已置位（可同步可靠检测；tracker
	// 的 activeTransition 那时尚未赋值，不能依赖）。动画期间只渲染 thumbhash
	// 占位（~32px dataURL），等 VT 结束再提交正式大图 —— 大图的解码/换帧不会
	// 落在动画中途。SSR 与无 VT 场景（含桌面首载）初值即为 false，直接渲染
	// 正式 src，首屏不受影响，桌面体验不变。
	const [vtPending, setVtPending] = useState(() => isViewTransitionActive());
	useEffect(() => {
		if (!vtPending) return;
		return commitAfterViewTransition(() => setVtPending(false));
	}, [vtPending]);
	const thumbhashUrl = useThumbHashDataUrl(image?.thumbhash);
	const src = image?.imageUrl ?? "/No-Image-Placeholder.svg.webp";
	const cachedRevealed = useRevealedOnce(src);
	const vtGated = vtPending && !cachedRevealed;

	// 灯箱用原图：VNDB 封面在列表/详情统一走 `.t` 缩略图，`url` 才是原尺寸；
	// kungal 封面的 url 与 imageUrl 相同。没有原图 URL（占位图）时不启用灯箱。
	const lightboxSrc =
		image?.url?.trim() ||
		(image?.imageUrl ? fullSizeCoverUrl(image.imageUrl.trim()) : null);
	const showR18 = useSelector(r18Store, (state) => state.showR18);
	const [coverRevealed, setCoverRevealed] = useState(false);
	const coverSensitiveHidden =
		!showR18 && (game?.vn?.image?.cSexualAvg ?? 0) >= 1 && !coverRevealed;

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

	const coverClassName = `${
		(game?.vn?.image?.height ?? 0) > 0 &&
		(game?.vn?.image?.height ?? 0) < (game?.vn?.image?.width ?? 0)
			? "min-w-60"
			: "w-48"
	} relative overflow-hidden rounded-xl text-left ring-1 ring-border/60`;
	const coverStyle = { viewTransitionName: `game-cover-${id}` };
	const coverContent = (
		<>
			{vtGated && !thumbhashUrl && (
				<Skeleton className="absolute inset-0 w-full h-full rounded-xl" />
			)}
			{vtGated ? (
				thumbhashUrl ? (
					<img
						aria-hidden="true"
						alt=""
						className="object-cover w-full h-full rounded-xl"
						src={thumbhashUrl}
					/>
				) : null
			) : (
				<GameCard.Image
					width={game?.vn?.image?.width ?? 200}
					height={game?.vn?.image?.height ?? 300}
					thumbhash={image?.thumbhash}
					loading="eager"
					fetchPriority="high"
					decoding="async"
					alwaysAnimate={false}
					src={src}
					alt={displayTitle}
					cSexualAvg={game?.vn?.image?.cSexualAvg}
					revealed={coverRevealed}
					onReveal={() => setCoverRevealed(true)}
					className="object-cover w-full h-full rounded-xl"
				/>
			)}
		</>
	);

	return (
		<div
			className={cn(
				"relative mx-auto w-fit text-center sm:mx-0 sm:text-right",
				className,
			)}
		>
			<div className="inline-block relative max-w-full">
				{lightboxSrc && !coverSensitiveHidden ? (
					<GameCoverLightbox alt={displayTitle} src={lightboxSrc}>
						<div className={coverClassName} style={coverStyle}>
							{coverContent}
							<button
								aria-label={`查看《${displayTitle}》封面大图`}
								className="absolute inset-0 z-10 rounded-xl outline-none cursor-zoom-in focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-ring/60"
								type="button"
							/>
						</div>
					</GameCoverLightbox>
				) : (
					<div className={coverClassName} style={coverStyle}>
						{coverContent}
					</div>
				)}
			</div>
		</div>
	);
}

/** 标题 + 别名：单独占正文首行，不再和封面共用 float 流。 */
export function GameTitle({ game, id }: { game: GameData; id: string }) {
	const displayTitle = gameDisplayTitle(game);
	const aliases = gameAliases(game);

	return (
		<div className="min-w-0">
			<h1
				className="w-fit text-2xl leading-tight font-semibold tracking-tight text-balance"
				style={{
					viewTransitionName: `game-title-${id}`,
					viewTransitionClass: "vt-text",
				}}
			>
				{displayTitle}
			</h1>
			{aliases && (
				<p className="mt-1 max-w-3xl text-xs leading-relaxed line-clamp-1 text-muted-foreground">
					别名：{aliases}
				</p>
			)}
		</div>
	);
}

/** 兼容旧调用：测试与外部仍可拿一个同时含封面/标题的整体。 */
export function GameHeader({ game, id }: { game: GameData; id: string }) {
	return (
		<>
			<GameCover game={game} id={id} />
			<GameTitle game={game} id={id} />
		</>
	);
}
