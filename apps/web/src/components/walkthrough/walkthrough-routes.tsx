import { Image } from "@unpic/react";
import {
	type CharacterView,
	roleLabelOf,
} from "@web/components/game/characters/character-types";
import { AspectRatio } from "@web/components/ui/aspect-ratio";
import { Badge } from "@web/components/ui/badge";
import type { ChartStats } from "@web/components/walkthrough/chart";
import { useThumbHashDataUrl } from "@web/lib/image";
import { cn } from "@web/lib/utils";
import { Check, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
	characterNameOf,
	routeCountsLine,
	type WalkthroughCharacter,
} from "./types";

/** 竖版封面兜底尺寸（名册行没带宽高时用，与条目页角色卡同一口径） */
const FALLBACK_IMAGE_WIDTH = 400;
const FALLBACK_IMAGE_HEIGHT = 533;

/**
 * 自适应列宽：卡片最小 108px、剩余空间均分，一行能塞几张塞几张。
 *
 * 比较过固定断点（3/4/5/6/7 列）：攻略的角色通常只有 5–8 个，固定断点在
 * 1280 以下会折成两行，反而比条目页的角色栅格还占地方。auto-fill 让小卡片
 * 拿到该有的密度（宽屏一行 9–11 张），也顺手适配了 1024/1440 之间的各种宽度。
 */
const gridClass =
	"grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-x-1.5 gap-y-3 sm:grid-cols-[repeat(auto-fill,minmax(108px,1fr))] sm:gap-x-2.5";

/** 左上角身份徽章：与角色卡同款（近实底 + 发丝边，任何底图上都可读） */
const badgeClass =
	"h-4 px-1.5 rounded-md text-[10px] bg-background/95 ring-1 ring-border/70 shadow-sm backdrop-blur-sm pointer-events-none";

/**
 * 角色路线选择器：**竖版头像卡**，与条目页「详情」页签的角色栅格同构。
 *
 * 之前是一排「文字 + 计数」的方块，读者要在心里把「朝武 芳乃」翻译成一张脸；
 * 换成头像卡后，选路线=认人，和站内其它角色入口的视觉也连上了。
 * 头像来自条目页角色名册（按 chart 角色钉住的 kungal 角色 id 匹配），
 * 没钉住 / 没图的角色退回首字占位，不影响可选性。
 */
export function WalkthroughRoutes({
	characters,
	roster = [],
	stats,
	selectedKey,
	onSelect,
}: {
	characters: WalkthroughCharacter[];
	/** 条目页角色名册（CharacterView[]）：提供头像、拉丁名与身份徽章 */
	roster?: CharacterView[];
	stats: ChartStats;
	selectedKey: string | null;
	onSelect: (characterKey: string | null) => void;
}) {
	const rosterById = useMemo(
		() => new Map(roster.map((item) => [item.id, item])),
		[roster],
	);

	if (characters.length === 0) return null;

	return (
		<section aria-label="角色路线">
			{/* 不再有「角色路线」大标题：一排头像卡的意图已经写在下面这行小字里，
			    再加标题只是多占一行高度 */}
			<p className="mb-3 text-muted-foreground text-xs">
				选择角色查看这条路线的选项
			</p>
			<div className={gridClass}>
				<RouteCard
					active={selectedKey === null}
					description={routeCountsLine(stats.endings, stats.segments)}
					name="全部路线"
					onClick={() => onSelect(null)}
				/>
				{characters.map((character) => {
					const item = stats.byCharacter[character.key];
					return (
						<RouteCard
							active={selectedKey === character.key}
							description={routeCountsLine(
								item?.endings ?? 0,
								item?.segments ?? 0,
							)}
							key={character.key}
							name={characterNameOf(character)}
							onClick={() => onSelect(character.key)}
							roster={
								character.characterId
									? rosterById.get(character.characterId)
									: undefined
							}
						/>
					);
				})}
			</div>
		</section>
	);
}

/**
 * 一张路线卡：3:4 竖版封面 + 左上角身份徽章 + 选中勾 + 姓名/计数。
 *
 * 与条目页角色卡的区别只在「选中态」和「计数副标」：这里点卡是筛选，
 * 不是打开详情，所以要多一个选中勾与 ring，副标给结局数/段数。
 */
function RouteCard({
	active,
	name,
	description,
	roster,
	onClick,
}: {
	active: boolean;
	name: string;
	description: string;
	roster?: CharacterView;
	onClick: () => void;
}) {
	const [failed, setFailed] = useState(false);
	const placeholder = useThumbHashDataUrl(roster?.imageThumbhash);
	const imageUrl = failed ? null : (roster?.imageUrl ?? null);
	const initial = name.trim().slice(0, 1) || "?";
	const roleLabel = roster?.rosterRole ? roleLabelOf(roster.rosterRole) : null;
	const isAll = !roster && name === "全部路线";

	return (
		<button
			aria-pressed={active}
			className={cn(
				"group -m-1 flex flex-col gap-1.5 rounded-xl p-1 text-left transition-colors duration-200",
				"hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
			)}
			onClick={onClick}
			type="button"
		>
			<div
				className={cn(
					"relative w-full overflow-hidden rounded-xl bg-muted/40 ring-1 transition-[box-shadow,background-color] duration-200",
					active
						? "ring-2 ring-primary"
						: "ring-border/60 group-hover:ring-border",
				)}
			>
				<AspectRatio className="overflow-hidden" ratio={3 / 4}>
					{imageUrl ? (
						<>
							{placeholder ? (
								<img
									alt=""
									aria-hidden="true"
									className="absolute inset-0 h-full w-full object-cover"
									src={placeholder}
								/>
							) : null}
							<Image
								alt={name}
								className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
								decoding="async"
								height={roster?.imageHeight ?? FALLBACK_IMAGE_HEIGHT}
								loading="lazy"
								onError={() => setFailed(true)}
								src={imageUrl}
								width={roster?.imageWidth ?? FALLBACK_IMAGE_WIDTH}
							/>
						</>
					) : isAll ? (
						<span
							aria-hidden="true"
							className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground/70"
						>
							<Users className="size-7" />
							<span className="text-[11px]">全部</span>
						</span>
					) : (
						<span
							aria-hidden="true"
							className="absolute inset-0 flex items-center justify-center font-semibold text-3xl text-muted-foreground/60 select-none"
						>
							{initial}
						</span>
					)}
				</AspectRatio>
				{roleLabel ? (
					<span className="absolute top-1.5 left-1.5 z-10">
						<Badge className={badgeClass} variant="outline">
							{roleLabel}
						</Badge>
					</span>
				) : null}
				{active ? (
					<span className="absolute top-1.5 right-1.5 z-10 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
						<Check aria-hidden="true" className="size-3" />
					</span>
				) : null}
			</div>
			<div className="min-w-0 px-0.5">
				<p className="truncate font-medium text-xs" title={name}>
					{name}
				</p>
				{description ? (
					<p className="truncate text-[11px] text-muted-foreground tabular-nums">
						{description}
					</p>
				) : null}
			</div>
		</button>
	);
}
