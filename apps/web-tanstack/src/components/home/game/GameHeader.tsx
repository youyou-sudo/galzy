import { useSelector } from "@tanstack/react-store";
import { GameCoverLightbox } from "@web/components/game/game-cover-lightbox";
import { GameCard, useRevealedOnce } from "@web/components/home/card";
import { Skeleton } from "@web/components/ui/skeleton";
import { fullSizeCoverUrl, useThumbHashDataUrl } from "@web/lib/image";
import {
	isViewTransitionActive,
	waitForViewTransitionEnd,
} from "@web/lib/view-transition";
import type { getGameDetail } from "@web/server/game";
import { r18Store } from "@web/stores/r18Store";
import { useEffect, useState } from "react";

type GameData = NonNullable<Awaited<ReturnType<typeof getGameDetail>>>;

export function GameHeader({ game, id }: { game: GameData; id: string }) {
	const olangTitle = game?.vn?.titles?.find(
		(t) => t.lang === game.vn?.olang && (t.title ?? "").trim() !== "",
	)?.title;
	// 展示标题兜底链：kungal-only 条目（vn 缺失或未水合）没有 olang 标题，
	// 直接用 olangTitle 会渲染成字面 "null" 或空 h1。
	// 顺序：olang 标题 → 任意非空标题 → alias 首个非空行 → "未知作品"。
	const anyTitle = game?.vn?.titles?.find(
		(t) => (t.title ?? "").trim() !== "",
	)?.title;
	const aliasFirstLine = game?.vn?.alias
		?.split("\n")
		.map((line) => line.trim())
		.find((line) => line !== "");
	const displayTitle =
		olangTitle?.trim() || anyTitle?.trim() || aliasFirstLine || "未知作品";
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
	// 例外：列表已成功加载过同图（revealedSrcs 缓存命中，useRevealedOnce
	// 客户端挂载时同步读真值）时跳过 gate —— VT 快照直接拍到真图终态，
	// GameCard.Image 内部 ThumbHashImage 缓存命中首帧直出、无浮现动画，
	// 实现无缝飞入。gate 仅对未揭示过的新图生效，保留原有防掉帧动机。
	const [vtPending, setVtPending] = useState(() => isViewTransitionActive());
	useEffect(() => {
		if (!vtPending) return;
		let cancelled = false;
		void waitForViewTransitionEnd().then(() => {
			if (!cancelled) setVtPending(false);
		});
		return () => {
			cancelled = true;
		};
	}, [vtPending]);
	const thumbhashUrl = useThumbHashDataUrl(image?.thumbhash);
	const src = image?.imageUrl ?? "/No-Image-Placeholder.svg.webp";
	const cachedRevealed = useRevealedOnce(src);
	// 仅对「未揭示过的新图」生效：缓存命中时 VT 期间直接渲染 GameCard.Image
	const vtGated = vtPending && !cachedRevealed;

	// 灯箱用原图：VNDB 封面在列表/详情统一走 `.t` 缩略图，`url` 才是原尺寸；
	// kungal 封面的 url 与 imageUrl 相同。没有原图 URL（占位图）时不启用灯箱。
	const lightboxSrc =
		image?.url?.trim() ||
		(image?.imageUrl ? fullSizeCoverUrl(image.imageUrl.trim()) : null);
	// R18 遮挡与 Reveal 状态提升到本组件：未揭示时灯箱触发器不可聚焦、不可点击，
	// 避免键盘 Enter 绕过遮挡直接打开敏感大图。
	const showR18 = useSelector(r18Store, (state) => state.showR18);
	const [coverRevealed, setCoverRevealed] = useState(false);
	const coverSensitiveHidden =
		!showR18 && (game?.vn?.image?.cSexualAvg ?? 0) >= 1 && !coverRevealed;

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

	const coverClassName = `${
		(game?.vn?.image?.height ?? 0) > 0 &&
		(game?.vn?.image?.height ?? 0) < (game?.vn?.image?.width ?? 0)
			? "min-w-72.5"
			: "w-55"
	} relative overflow-hidden text-left`;
	const coverStyle = { viewTransitionName: `game-cover-${id}` };
	const coverContent = (
		<>
			{vtGated && !thumbhashUrl && (
				<Skeleton className="absolute inset-0 w-full h-full rounded-lg" />
			)}
			{vtGated ? (
				// VT 进行中：只渲染 thumbhash 占位，等动画结束再挂正式大图
				//（与 ThumbHashImage 内的占位同源，VT 结束后无缝续接）
				thumbhashUrl ? (
					<img
						aria-hidden="true"
						alt=""
						className="rounded-lg w-full h-full object-cover"
						src={thumbhashUrl}
					/>
				) : null
			) : (
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
					src={src}
					alt={displayTitle}
					cSexualAvg={game?.vn?.image?.cSexualAvg}
					// 揭示态受控：未揭示的敏感图不挂载灯箱，避免绕过遮挡。
					revealed={coverRevealed}
					onReveal={() => setCoverRevealed(true)}
					className="rounded-lg w-full h-full object-cover"
				/>
			)}
		</>
	);

	return (
		<>
			{/* Cover and basic info section */}
			<div className="sm:float-right text-center sm:text-right sm:ml-4 pb-4 relative">
				<div className="relative inline-block">
					{lightboxSrc && !coverSensitiveHidden ? (
						<GameCoverLightbox alt={displayTitle} src={lightboxSrc}>
							<div className={coverClassName} style={coverStyle}>
								{coverContent}
								{/* 原生 button 覆盖层：给灯箱触发器完整键盘/读屏语义。
								    敏感图未揭示时整个灯箱不挂载，点击封面只会走「显示」。 */}
								<button
									aria-label={`查看《${displayTitle}》封面大图`}
									className="absolute inset-0 z-10 cursor-zoom-in rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

			{/* Main content section */}
			<div className="overflow-hidden wrap-break-word">
				<h1
					className="font-semibold text-2xl leading-[1.2] mt-2 w-fit"
					style={{
						viewTransitionName: `game-title-${id}`,
						viewTransitionClass: "vt-text",
					}}
				>
					{displayTitle}
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
