import { cn } from "@web/lib/utils";
import { useMemo } from "react";
import {
	endingTypeBadgeLabel,
	nodeLabel,
	nodeStartPhrase,
	resolveText,
	segmentAnchorId,
	segmentGroups,
	segmentOptionCount,
	stepNumbers,
} from "./chart-utils";
import { Badge, StepRow, StepText } from "./step-row";
import type { ChartLang, ChartSegment, WalkthroughChart } from "./types";

export interface CharacterViewProps {
	chart: WalkthroughChart;
	/** 双语三档，默认 both（中文主文 + 括注原文） */
	lang?: ChartLang;
	/** 只看某个角色（c1/c2…）；null/undefined 表示全部 */
	characterKey?: string | null;
	className?: string;
}

/** 卡片头：段序号 + 起点短语（entry/save/ending 三种写法）+ 选项数 */
function SegmentStart({
	chart,
	lang,
	segment,
	index,
}: {
	chart: WalkthroughChart;
	lang: ChartLang;
	segment: ChartSegment;
	index: number;
}) {
	const phrase = nodeStartPhrase(chart, segment.from_node, lang);
	const options = segmentOptionCount(segment);

	return (
		<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
			<span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs tabular-nums">
				{index}
			</span>
			<span className="font-medium">
				<StepText text={phrase} />
			</span>
			<span className="ml-auto text-muted-foreground text-xs tabular-nums">
				{options} 个选项
			</span>
		</div>
	);
}

/** 卡片尾：按 to_node 给终点块（ending 结局名+徽章 / collect 回收结束 / open 不渲染） */
function SegmentEnd({
	chart,
	lang,
	segment,
}: {
	chart: WalkthroughChart;
	lang: ChartLang;
	segment: ChartSegment;
}) {
	const to = segment.to_node;

	if (to.node_type === "collect") {
		return (
			<p
				className="mt-3 border-border border-t pt-2 text-primary text-sm"
				data-segment-end="collect"
			>
				回收 CG / 场景后结束
			</p>
		);
	}

	// open（以及异常地以 save/entry 收尾的段落）不画终点块：源文本来就没给终点
	if (to.node_type !== "ending") return null;

	const ending = (chart.endings ?? []).find((e) => e.key === to.key);
	const label = nodeLabel(chart, to, lang);
	if (!label.primary && !label.secondary) return null;
	const badge = ending ? endingTypeBadgeLabel(ending.ending_type) : null;

	return (
		<p
			className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-border border-t pt-2 text-sm"
			data-segment-end="ending"
		>
			<span aria-hidden className="text-muted-foreground">
				→
			</span>
			<span className="font-medium">
				<StepText text={label} />
			</span>
			{badge ? <Badge>{badge}</Badge> : null}
		</p>
	);
}

/**
 * 「按角色」视图：段落为单元，段内按 step_type 渲染步骤（长文形态）。
 *
 * 先按 section 分组，再逐段输出；每段带稳定锚点 id，供壳的段落目录与
 * 流程图的点击回跳使用。「按顺序」视图不是它 —— 那边是可勾选进度的
 * 折叠清单（order-view.tsx）。
 */
export function CharacterView({
	chart,
	lang = "both",
	characterKey = null,
	className,
}: CharacterViewProps) {
	const groups = useMemo(
		() => segmentGroups(chart, lang, characterKey),
		[chart, lang, characterKey],
	);

	// 段落编号跨分组连续（参考站一条路线 1..N），所以先算出每组起始号
	const starts: number[] = [];
	let running = 0;
	for (const group of groups) {
		starts.push(running);
		running += group.segments.length;
	}

	if (running === 0) {
		const emptyText =
			(chart.segments ?? []).length === 0
				? "这份攻略还没有选项数据"
				: "这条路线还没有选项数据";
		return (
			<div
				className={cn(
					"rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground text-sm",
					className,
				)}
			>
				{emptyText}
			</div>
		);
	}

	return (
		<div className={cn("space-y-8", className)}>
			{groups.map((group, groupIndex) => (
				// 同一个 section_key 可能不连续出现两次，key 里带上组序号才唯一
				<section
					data-section-key={group.key}
					key={`${group.key}#${groupIndex}`}
				>
					{group.title ? (
						<h3 className="mb-4 border-primary/60 border-l-4 pl-2 font-semibold text-base">
							<StepText text={group.title} />
						</h3>
					) : null}
					<div className="space-y-4">
						{group.segments.map((segment, segmentIndex) => {
							const steps = segment.steps ?? [];
							const numbers = stepNumbers(steps);
							// 前置条件以 condition 为主、requires_ending_keys 作补充（后者可能没解析全）
							const condition = resolveText(
								segment.condition,
								segment.condition_localized,
								lang,
							);
							const requires = (segment.requires_ending_keys ?? [])
								.map(
									(key) =>
										(chart.endings ?? []).find((e) => e.key === key)?.name ??
										key,
								)
								.filter(Boolean);

							return (
								<article
									className="scroll-mt-24 rounded-xl border border-border bg-card/40 px-3 py-3 sm:px-4"
									data-segment-key={segment.key}
									id={segmentAnchorId(segment.key)}
									key={segment.key}
								>
									<SegmentStart
										chart={chart}
										index={starts[groupIndex] + segmentIndex + 1}
										lang={lang}
										segment={segment}
									/>
									{condition.primary || requires.length > 0 ? (
										<div className="mt-2 space-y-0.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs leading-5">
											{condition.primary ? (
												<p className="text-muted-foreground">
													<StepText text={condition} />
												</p>
											) : null}
											{requires.length > 0 ? (
												<p className="text-amber-700 dark:text-amber-300">
													需先达成：{requires.join("、")}
												</p>
											) : null}
										</div>
									) : null}
									<div className="mt-3 space-y-1.5">
										{steps.map((step, stepIndex) => (
											<StepRow
												chart={chart}
												key={stepIndex}
												lang={lang}
												number={numbers[stepIndex] ?? null}
												step={step}
											/>
										))}
									</div>
									<SegmentEnd chart={chart} lang={lang} segment={segment} />
								</article>
							);
						})}
					</div>
				</section>
			))}
		</div>
	);
}