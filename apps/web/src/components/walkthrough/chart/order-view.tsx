import { cn } from "@web/lib/utils";
import { Bookmark, Trophy } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import {
	endingTypeBadgeLabel,
	nodeLabel,
	nodeStartPhrase,
	resolveText,
	segmentAnchorId,
	segmentOptionCount,
	segmentsForCharacter,
	stepNumbers,
} from "./chart-utils";
import type {
	ChartLang,
	ChartSegment,
	ChartStep,
	ChartText,
	WalkthroughChart,
} from "./types";

export interface OrderViewProps {
	chart: WalkthroughChart;
	/** 双语三档，默认 both（中文主文 + 括注原文） */
	lang?: ChartLang;
	/** 只看某个角色（c1/c2…）；null/undefined 表示全部 */
	characterKey?: string | null;
	className?: string;
}

/** 分组：同一 section 的连续段落归一组；section 变化就换组（保源文顺序，不重排） */
interface SegmentGroup {
	key: string;
	title: ChartText | null;
	segments: ChartSegment[];
}

function groupSegments(
	chart: WalkthroughChart,
	lang: ChartLang,
	characterKey: string | null | undefined,
): SegmentGroup[] {
	const segments = segmentsForCharacter(chart, characterKey);
	const groups: SegmentGroup[] = [];
	for (const segment of segments) {
		const groupKey = segment.section_key ?? "__none__";
		const last = groups.at(-1);
		if (last && last.key === groupKey) {
			last.segments.push(segment);
			continue;
		}
		const section = segment.section_key
			? (chart.sections ?? []).find((s) => s.key === segment.section_key)
			: null;
		groups.push({
			key: groupKey,
			title: section
				? resolveText(section.title, section.localized, lang)
				: null,
			segments: [segment],
		});
	}
	return groups;
}

/** 主文 + 可选括注原文；两侧都空就整块不渲染，避免空行 */
function StepText({ text }: { text: ChartText }) {
	if (!text.primary && !text.secondary) return null;
	return (
		<>
			{/* 主文单独一层 span，测试与壳都能按整段文字精确定位 */}
			{text.primary ? <span>{text.primary}</span> : null}
			{text.secondary ? (
				<span className="ml-1 text-xs text-muted-foreground">
					（{text.secondary}）
				</span>
			) : null}
		</>
	);
}

/** 小徽章：后果标签（芳乃+1）、成就、结局类型共用一套外观 */
function Badge({
	children,
	tone = "muted",
}: {
	children: ReactNode;
	tone?: "muted" | "affect" | "achievement";
}) {
	const toneClass =
		tone === "affect"
			? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
			: tone === "achievement"
				? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
				: "border-border bg-muted text-muted-foreground";
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-4",
				toneClass,
			)}
		>
			{children}
		</span>
	);
}

/** 单步渲染：五种 step_type 各自一种外观 */
function StepRow({
	chart,
	lang,
	step,
	number,
}: {
	chart: WalkthroughChart;
	lang: ChartLang;
	step: ChartStep;
	number: number | null;
}) {
	const text = resolveText(step.text, step.localized, lang);
	const remark = resolveText(step.remark, step.remark_localized, lang).primary;

	if (step.step_type === "heading") {
		// 源文自带「■」前缀，直接原样显示，不再补符号；编号由 stepNumbers 归零
		return (
			<p
				className="mt-5 border-l-2 border-primary/40 pl-2 font-medium text-sm first:mt-0"
				data-step-type="heading"
			>
				<StepText text={text} />
			</p>
		);
	}

	if (step.step_type === "save") {
		const save = step.save_key
			? (chart.saves ?? []).find((s) => s.key === step.save_key)
			: null;
		const saveLabel = save
			? resolveText(save.label, save.localized ?? {}, lang)
			: null;
		return (
			<p
				className="flex flex-wrap items-center gap-x-1.5 text-primary text-sm"
				data-step-type="save"
			>
				<Bookmark aria-hidden className="size-3.5 shrink-0" />
				<span>在这里存档：</span>
				<span className="font-medium">
					「{saveLabel?.primary ?? step.save_key ?? "存档"}」
				</span>
				{saveLabel?.secondary ? (
					<span className="text-muted-foreground text-xs">
						（{saveLabel.secondary}）
					</span>
				) : null}
			</p>
		);
	}

	if (step.step_type === "note") {
		if (!text.primary && !text.secondary) return null;
		return (
			<p
				className="text-muted-foreground text-sm leading-6"
				data-step-type="note"
			>
				<StepText text={text} />
			</p>
		);
	}

	// choice / action：编号行（未知 step_type 也会落到这里，但没有编号）
	return (
		<div className="space-y-1" data-step-type={step.step_type}>
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
				{number === null ? null : (
					<span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground tabular-nums">
						{number}
					</span>
				)}
				<span
					className={cn(
						"text-sm leading-6",
						step.step_type === "choice" && "font-medium",
					)}
				>
					<StepText text={text} />
				</span>
				{remark ? <Badge tone="affect">{remark}</Badge> : null}
				{step.achievement ? (
					<Badge tone="achievement">
						<Trophy aria-hidden className="size-3" />
						成就
					</Badge>
				) : null}
			</div>
			{/* 差分 CG：源文把另一条分支收在 alternatives 里，提示玩家读档改选（备选不编号） */}
			{(step.alternatives ?? []).map((alternative, index) => (
				<div
					className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pl-7 text-muted-foreground text-xs leading-5"
					data-alternative-index={index}
					key={index}
				>
					<span className="rounded border border-border border-dashed px-1.5 py-0.5">
						差分 CG 回收时改选
					</span>
					<span aria-hidden>→</span>
					<StepText
						text={resolveText(alternative.text, alternative.localized, lang)}
					/>
				</div>
			))}
		</div>
	);
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
 * 「按顺序」视图：段落为单元，段内按 step_type 渲染步骤。
 * 先按 section 分组，再逐段输出；每段带稳定锚点 id，供壳的段落导航与
 * 流程图的点击回跳使用。
 */
export function OrderView({
	chart,
	lang = "both",
	characterKey = null,
	className,
}: OrderViewProps) {
	const groups = useMemo(
		() => groupSegments(chart, lang, characterKey),
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
