import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@web/lib/utils";
import { X } from "lucide-react";
import type { ChartStats, WalkthroughChart } from "./chart";
import { GraphView } from "./chart";
import {
	characterNameOf,
	routeCountsLine,
	type WalkthroughCharacter,
	type WalkthroughLang,
} from "./types";
import { WalkthroughLangSwitch } from "./walkthrough-toolbar";

/**
 * 流程图全屏 Modal。
 *
 * 流程图本身仍内联在攻略页里（第三个视图），这里只是画布操作按钮里那个
 * 「全屏」的落地页：图太大、拖不动时才需要这一屏，所以 Modal 里除了换掉
 * 语言 / 角色筛选，不再重复页面的其它内容。
 *
 * 不用 ui/dialog 的 DialogContent：它是一枚「居中对话框」，自带的
 * `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` 与「铺满整屏」是同一组
 * translate 工具类，谁生效取决于 Tailwind 的样式顺序——手机上实测会把弹层
 * 留在屏幕中心点、右下角溢出到视口外。全屏 Modal 的盒子自己写，移动端
 * `inset-0 + h-dvh` 铺满、lg 以上才收成居中内容区，两套断点互不打架。
 */
export function WalkthroughGraphFullscreen({
	open,
	onOpenChange,
	onOpenChangeComplete,
	chart,
	lang,
	onLangChange,
	characterKey,
	onCharacterChange,
	characters,
	stats,
	onOpenSegment,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 关闭动画结束：壳用它把「在路线列表中查看」的滚动放到 Modal 退场之后 */
	onOpenChangeComplete?: (open: boolean) => void;
	chart: WalkthroughChart;
	lang: WalkthroughLang;
	onLangChange: (lang: WalkthroughLang) => void;
	characterKey: string | null;
	onCharacterChange: (characterKey: string | null) => void;
	characters: WalkthroughCharacter[];
	stats: ChartStats;
	onOpenSegment?: (segmentKey: string) => void;
}) {
	return (
		<DialogPrimitive.Root
			onOpenChange={onOpenChange}
			onOpenChangeComplete={onOpenChangeComplete}
			open={open}
		>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
				<DialogPrimitive.Popup
					className={cn(
						// 手机 / 平板：就是整屏，不留边距与圆角
						"flex fixed inset-0 z-50 h-dvh w-full flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)] lg:pb-0",
						"transition-[opacity,scale] duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
						// lg 以上：内容区式浮层。宽高**跟着视口走**（94vw / 92dvh），
						// 只留上限防止 4K/带鱼屏上一味拉成一条横带；之前写死 1200×900，
						// 在大屏上四周会空出一大片，图也只能缩到 83%。
						"lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-[min(92dvh,1100px)] lg:w-[min(94vw,1800px)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border lg:border-border/70 lg:shadow-2xl",
					)}
				>
					{/* 刘海机（iPhone 等）要避开状态栏与 Home 指示条：全屏弹层贴着
					    视口边缘，不补安全区的话标题会压到状态栏下面 */}
					<header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-border/70 border-b px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pr-12 pb-3 lg:pt-3">
						<div className="min-w-0">
							<DialogPrimitive.Title className="font-medium font-heading text-base text-foreground">
								选项流程图
							</DialogPrimitive.Title>
							<DialogPrimitive.Description className="text-muted-foreground text-xs">
								{routeCountsLine(stats.endings, stats.segments)}
							</DialogPrimitive.Description>
						</div>
						<div className="ml-auto flex shrink-0 items-center gap-2">
							<WalkthroughLangSwitch lang={lang} onLangChange={onLangChange} />
						</div>
					</header>
					{characters.length > 0 ? (
						<div
							aria-label="角色路线"
							className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-border/70 border-b px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
							role="group"
						>
							<RoutePill
								active={characterKey === null}
								count={routeCountsLine(stats.endings, stats.segments)}
								label="全部路线"
								onClick={() => onCharacterChange(null)}
							/>
							{characters.map((character) => {
								const item = stats.byCharacter[character.key];
								return (
									<RoutePill
										active={characterKey === character.key}
										count={routeCountsLine(
											item?.endings ?? 0,
											item?.segments ?? 0,
										)}
										key={character.key}
										label={characterNameOf(character)}
										onClick={() => onCharacterChange(character.key)}
									/>
								);
							})}
						</div>
					) : null}
					<div className="min-h-0 flex-1 p-2 sm:p-3">
						<GraphView
							chart={chart}
							characterKey={characterKey}
							fullscreen
							lang={lang}
							onOpenSegment={onOpenSegment}
							onToggleFullscreen={() => onOpenChange(false)}
						/>
					</div>
					<DialogPrimitive.Close className="absolute top-[calc(0.625rem+env(safe-area-inset-top))] right-3 grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 lg:top-2.5">
						<X aria-hidden className="size-4" />
						<span className="sr-only">关闭全屏</span>
					</DialogPrimitive.Close>
				</DialogPrimitive.Popup>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

/** 紧凑角色筛选药丸：Modal 表头空间有限，不再放竖版头像卡 */
function RoutePill({
	active,
	label,
	count,
	onClick,
}: {
	active: boolean;
	label: string;
	count: string;
	onClick: () => void;
}) {
	return (
		<button
			aria-pressed={active}
			className={cn(
				"flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
				active
					? "bg-primary/10 font-medium text-primary ring-1 ring-primary/30"
					: "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
			)}
			onClick={onClick}
			title={count}
			type="button"
		>
			{label}
			<span className="hidden text-[10px] text-muted-foreground sm:inline">
				{count}
			</span>
		</button>
	);
}
