import { cn } from "@web/lib/utils";
import { Bookmark, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { resolveText } from "./chart-utils";
import type { ChartLang, ChartStep, ChartText, WalkthroughChart } from "./types";

/**
 * 单步渲染的三件套（StepText / Badge / StepRow）。
 *
 * 从 order-view 抽出来的原因：流程图右侧的段落面板要渲染「这一段要选什么」，
 * 参考站那里与顺序视图的段落正文是同一套渲染（实测逐字一致）。两处各抄一份
 * 迟早会漂移（编号规则、remark 徽章、差分 CG 备选行），所以收敛到一处。
 */

/** 主文 + 可选括注原文；两侧都空就整块不渲染，避免空行 */
export function StepText({ text }: { text: ChartText }) {
	if (!text.primary && !text.secondary) return null;
	return (
		<>
			{/* 主文单独一层 span，测试与壳都能按整段文字精确定位 */}
			{text.primary ? <span>{text.primary}</span> : null}
			{text.secondary ? (
				<span className="ml-1 text-muted-foreground text-xs">
					（{text.secondary}）
				</span>
			) : null}
		</>
	);
}

/** 小徽章：后果标签（芳乃+1）、成就、结局类型共用一套外观 */
export function Badge({
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
export function StepRow({
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
				className="mt-5 border-primary/40 border-l-2 pl-2 font-medium text-sm first:mt-0"
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
