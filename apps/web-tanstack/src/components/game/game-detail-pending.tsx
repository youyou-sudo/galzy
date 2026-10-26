import { Link, useRouterState } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import {
	GameTabSkeleton,
	type GameTabKey,
} from "@web/components/game/game-tab-skeleton";
import { GameCard } from "@web/components/home/card";
import { GameTabs, gameTabOf } from "@web/components/home/game/GameTabs";
import { Glgczujm } from "@web/components/home/game/tips";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import { AspectRatio } from "@web/components/ui/aspect-ratio";
import { Card, CardContent } from "@web/components/ui/card";
import { Skeleton } from "@web/components/ui/skeleton";
import { type GameHeroData, gameHeroStore } from "@web/stores/gameHeroStore";

// 详情页封面默认比例，对齐 GameCard.Image（SensitiveImage）的 DETAIL_IMAGE_RATIO
const COVER_FALLBACK_RATIO = 9 / 12;
// 发售/开发/发行三行的标签与行间距，与 GameInfo 的 dl 排布一一对应
const INFO_ROWS = ["发售", "开发", "发行"] as const;
// 简介占位 3 行的宽度（写死，不用随机数）：贴合真实 line-clamp-3 的参差感
const DESCRIPTION_LINE_WIDTHS = ["w-full", "w-[95%]", "w-3/5"] as const;
// TAG 区 8 个胶囊的写死宽度，模拟 flex-wrap 后长短不一的标签
const TAG_WIDTHS = [
	"w-10",
	"w-11",
	"w-12",
	"w-14",
	"w-16",
	"w-18",
	"w-20",
	"w-24",
] as const;

/** 展示标题兜底链与 GameHeader 一致：olang 标题 → 通用标题 → "未知作品" */
function heroTitle(hero: GameHeroData | null): string {
	return hero?.olangTitle?.trim() || hero?.title?.trim() || "未知作品";
}

/**
 * 详情页 HTTP pending（冷缓存直达/刷新）态。
 *
 * 不再整页纯骨架：外壳（面包屑 + Card + 页签）直接渲染真实 HTML，避免首访看到
 * 一屏灰条、数据到达时整页重排。只有真正还拿不到数据的字段各自出骨架：
 * 封面/标题（列表已给到 gameHeroStore 时直接复用）、发布/开发/发行/简介/TAG、
 * 以及当前页签的内容区。面包屑与页签因此是真实可交互内容，不能再整体 aria-hidden。
 */
export function GameDetailPending({ id }: { id: string }) {
	// 列表点击进入时 gameHeroStore 已有封面/标题；id 不匹配（换了条目）时不用旧数据
	const hero = useSelector(gameHeroStore, (s) => (s.id === id ? s.data : null));
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	// 与页签栏共用同一份判定（GameTabs 导出），新增页签不会让 pending 掉回文件列表骨架
	const currentTab = gameTabOf(pathname);

	return (
		<div>
			<Breadcrumb className="mb-4">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/games" />}>
							全部游戏
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						{hero ? (
							<BreadcrumbLink render={<Link to="/$id" params={{ id }} />}>
								{heroTitle(hero)}
							</BreadcrumbLink>
						) : (
							// 唯一允许的面包屑占位：条目名必须等 loader 返回，
							// 列表没给到标题时只在这里放一个词宽的骨架，不伪造文案。
							<Skeleton aria-hidden className="w-24 h-4" />
						)}
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className="space-y-3">
				{/* 与 game-layout-page 完全一致的卡片外壳：首屏结构稳定，
				    数据返回时只替换卡片内部字段，不再整页重排 */}
				<Card className="py-0 wrap-break-word ring-border/60">
					<CardContent className="grid gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-7 sm:px-6 sm:py-5">
						<div className="order-2 min-w-0 sm:order-1">
							<PendingGameTitle hero={hero} id={id} />
							<PendingGameInfo />
						</div>
						<div className="order-1 self-start sm:order-2">
							<PendingGameCover hero={hero} id={id} />
						</div>
					</CardContent>
				</Card>

				{/* 页签是真实内容：切 tab 走正常路由导航，pending 期间也可点击 */}
				<GameTabs id={id} />
				<Card className="ring-border/60">
					<CardContent>
						<GameTabSkeleton tab={currentTab as GameTabKey} />
						<Glgczujm />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

/**
 * pending 态英雄区：有列表数据时用 GameCard.Image 渲染真实封面（与 GameHeader
 * 同款包裹类名 / 尺寸判定 / view-transition-name），列表已经加载过的图直接出图；
 * 这里不再额外叠一层无条件 Skeleton —— 加载态交给 ThumbHashImage 内部判定：
 * revealedSrcs 命中（列表已揭示过）首帧即终态，没有加载过的图才按有无 thumbhash
 * 走占位图/骨架，因此「只有没加载过才看得到加载态」。
 * 只有直达/刷新（无 hero）时才用比例占位骨架占住封面位置。
 */
/** pending 封面：与真实 GameCover 同尺寸判定 / VT 名 / 圆角。 */
export function PendingGameCover({
	hero,
	id,
}: {
	hero: GameHeroData | null;
	id: string;
}) {
	const title = heroTitle(hero);

	if (!hero) {
		return (
			<div className="relative mx-auto w-fit text-center sm:mx-0 sm:text-right">
				<div className="inline-block relative">
					<div className="overflow-hidden relative w-48 text-left rounded-xl ring-1 ring-border/60">
						<AspectRatio
							aria-hidden
							ratio={COVER_FALLBACK_RATIO}
							className="overflow-hidden w-full rounded-lg"
						>
							<Skeleton
								aria-hidden
								className="absolute inset-0 w-full h-full rounded-lg"
							/>
						</AspectRatio>
					</div>
				</div>
			</div>
		);
	}

	// 横向封面（高 < 宽）与 GameCover 使用相同的更宽最小宽度
	const coverClassName = `${
		(hero.height ?? 0) > 0 && (hero.height ?? 0) < (hero.width ?? 0)
			? "min-w-60"
			: "w-48"
	} relative overflow-hidden rounded-xl text-left ring-1 ring-border/60`;

	return (
		<div className="relative mx-auto w-fit text-center sm:mx-0 sm:text-right">
			<div className="inline-block relative max-w-full">
				<div
					className={coverClassName}
					style={{ viewTransitionName: `game-cover-${id}` }}
				>
					<GameCard.Image
						width={hero.width ?? 200}
						height={hero.height ?? 300}
						thumbhash={hero.thumbhash}
						src={hero.imageUrl}
						alt={title}
						loading="eager"
						fetchPriority="high"
						decoding="async"
						alwaysAnimate={false}
						cSexualAvg={hero.cSexualAvg}
						className="object-cover w-full h-full rounded-lg"
					/>
				</div>
			</div>
		</div>
	);
}

/** pending 标题：列表没带标题时只占一行，不伪造文案。 */
export function PendingGameTitle({
	hero,
	id,
}: {
	hero: GameHeroData | null;
	id: string;
}) {
	if (!hero) {
		return (
			<div className="min-w-0">
				<Skeleton aria-hidden className="w-2/3 max-w-80 h-8" />
			</div>
		);
	}

	return (
		<div className="min-w-0">
			<h1
				className="w-fit text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl"
				style={{
					viewTransitionName: `game-title-${id}`,
					viewTransitionClass: "vt-text",
				}}
			>
				{heroTitle(hero)}
			</h1>
		</div>
	);
}

/** 兼容旧调用（测试）：封面 + 标题整体 */
export function PendingGameHero({
	hero,
	id,
}: {
	hero: GameHeroData | null;
	id: string;
}) {
	return (
		<>
			<PendingGameCover hero={hero} id={id} />
			<PendingGameTitle hero={hero} id={id} />
		</>
	);
}

/**
 * pending 态信息区：只给「loader 返回后才有的字段」出骨架 —— 发布/开发/发行
 * 三行（真实标签 + inline 值骨架，保持真实行高）、游戏简介（标签 + 3 行）、
 * TAG 胶囊（8 个）。别名、按钮行等不属于加载态的内容不额外占位。
 */
export function PendingGameInfo() {
	return (
		<>
			<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-baseline mt-4 text-sm">
				{INFO_ROWS.map((label) => (
					<div key={label} className="contents">
						<dt className="shrink-0 pt-0.5 w-8 text-xs text-muted-foreground">
							{label}
						</dt>
						<dd>
							<Skeleton aria-hidden className="w-24 h-3.5" />
						</dd>
					</div>
				))}
			</dl>

			<div className="mt-4">
				<div className="text-xs font-medium tracking-wide text-muted-foreground">
					游戏简介
				</div>
				<div className="mt-1.5 space-y-1.5">
					{DESCRIPTION_LINE_WIDTHS.map((width) => (
						<Skeleton key={width} aria-hidden className={`h-4 ${width}`} />
					))}
				</div>
			</div>

			{/* TAG 区：真实 TagsCard 自己按 tags 查询加载，这里只占位形状 */}
			<div className="flex flex-wrap gap-1.5 mt-4 mb-5" aria-hidden>
				{TAG_WIDTHS.map((width) => (
					<Skeleton key={width} className={`h-6 rounded-full ${width}`} />
				))}
			</div>
		</>
	);
}
