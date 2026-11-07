import { SectionHeader } from "@web/components/shared/section-header";
import {
	type ChartLang,
	nodeLabel,
	segmentGroups,
	segmentOptionCount,
	type WalkthroughChart,
} from "@web/components/walkthrough/chart";
import { cn } from "@web/lib/utils";
import { ListOrdered } from "lucide-react";

/**
 * 「按角色 / 按顺序」顶部的**段落目录**。
 *
 * 做成目录（分组标题 + 条目 + 点线 + 右侧选项数 + 编号），而不是卡片网格：
 * 这部分是导航索引，正文就在下面。一张卡片一格时，一条 5 段的路线就要占掉
 * 两屏，反而把正文推到看不见的地方；目录式一行一段，扫一眼就能定位。
 *
 * 编号与顺序视图里的段落编号同源（跨分组连续 1..N），分组口径走
 * segmentGroups，避免两处各算一次导致编号/标题对不上。
 */
export function WalkthroughSegments({
	chart,
	lang,
	characterKey,
	onSelect,
}: {
	chart: WalkthroughChart;
	lang: ChartLang;
	characterKey: string | null;
	onSelect: (segmentKey: string) => void;
}) {
	const groups = segmentGroups(chart, lang, characterKey);
	const total = groups.reduce((sum, group) => sum + group.segments.length, 0);
	if (total === 0) return null;

	let running = 0;

	return (
		<section>
			<div className="mb-3">
				<SectionHeader
					className="mb-1"
					count={`${total} 段`}
					icon={ListOrdered}
					title="段落"
				/>
				<p className="text-muted-foreground text-xs">
					本路线分 {total} 段，点击跳到对应段落
				</p>
			</div>
			<nav
				aria-label="段落目录"
				className="max-w-3xl rounded-xl border border-border/70 bg-card/30 px-3 py-1.5 sm:px-4"
			>
				{groups.map((group, groupIndex) => {
					const start = running;
					running += group.segments.length;
					return (
						<div
							className={cn(
								groupIndex > 0 && "mt-1.5 border-border/60 border-t pt-1.5",
							)}
							key={`${group.key}#${groupIndex}`}
						>
							{group.title?.primary ? (
								<p className="px-1.5 pt-1 pb-0.5 font-medium text-[11px] text-muted-foreground tracking-wide">
									{group.title.primary}
									{group.title.secondary ? (
										<span className="ml-1 opacity-70">
											（{group.title.secondary}）
										</span>
									) : null}
								</p>
							) : null}
							<ol>
								{group.segments.map((segment, segmentIndex) => {
									const index = start + segmentIndex + 1;
									const from = nodeLabel(chart, segment.from_node, lang).primary;
									const to = nodeLabel(chart, segment.to_node, lang).primary;
									const options = segmentOptionCount(segment);
									return (
										<li key={segment.key}>
											<button
												className={cn(
													"group flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors",
													"hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
												)}
												onClick={() => onSelect(segment.key)}
												type="button"
											>
												<span className="w-5 shrink-0 text-right font-medium text-muted-foreground text-xs tabular-nums">
													{index}
												</span>
												<span className="min-w-0 shrink truncate text-sm">
													<span>{from}</span>
													<span aria-hidden className="mx-1 text-muted-foreground">
														→
													</span>
													<span>{to}</span>
												</span>
												{/* 目录点线：把标题和右侧「页码」拉开，扫读时不会串行 */}
												<span
													aria-hidden
													className="mx-1 h-px min-w-4 flex-1 border-border border-b border-dotted transition-colors group-hover:border-muted-foreground/60"
												/>
												<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
													{options} 个选项
												</span>
											</button>
										</li>
									);
								})}
							</ol>
						</div>
					);
				})}
			</nav>
		</section>
	);
}
