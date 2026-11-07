import { cn } from "@web/lib/utils";
import { ArrowRight } from "lucide-react";
import {
	type ChartEdgeChunk,
	edgeOptionLabel,
	endingTypeBadgeLabel,
	nodeLabel,
	stepNumbers,
} from "./chart-utils";
import { Badge, StepRow } from "./step-row";
import type { ChartLang, WalkthroughChart } from "./types";

/**
 * 流程图的一条边对应的「选项面板」：这一段从哪走到哪、要选什么。
 *
 * 桌面端把它固定在画布右侧（用户明确要求「将选项放到右边」），手机端
 * 放进 Modal 内的底部弹层 —— 两处共用同一份内容，避免两种设备的步骤渲染
 * 各写一遍后慢慢走样。渲染复用顺序视图的 StepRow，编号口径与正文一致。
 */
export function GraphOptionsPanel({
	chart,
	lang,
	chunk,
	onOpenSegment,
	onAfterOpenSegment,
	className,
}: {
	chart: WalkthroughChart;
	lang: ChartLang;
	chunk: ChartEdgeChunk;
	/** 「在路线列表中查看」：壳切到「按顺序」视图并滚到该段 */
	onOpenSegment?: (segmentKey: string) => void;
	/** 弹层场景：跳转前先把自己关掉，避免两个 Modal 同时消失的焦点竞争 */
	onAfterOpenSegment?: () => void;
	className?: string;
}) {
	const fromLabel = nodeLabel(chart, chunk.from, lang).primary;
	const toLabel = nodeLabel(chart, chunk.to, lang).primary;
	const numbers = stepNumbers(chunk.steps);
	const ending =
		chunk.to.node_type === "ending"
			? ((chart.endings ?? []).find((item) => item.key === chunk.to.key) ??
				null)
			: null;
	const endingBadge = ending ? endingTypeBadgeLabel(ending.ending_type) : null;

	return (
		<div
			className={cn("flex h-full min-h-0 flex-col", className)}
			data-graph-options-panel
		>
			<header className="space-y-1.5 border-border/70 border-b px-3 py-2.5">
				<p className="text-[11px] text-muted-foreground">这一段要选的选项</p>
				<p className="flex flex-wrap items-center gap-1 font-medium text-sm">
					<span className="max-w-[45%] truncate">{fromLabel}</span>
					<ArrowRight
						aria-hidden
						className="size-3.5 shrink-0 text-muted-foreground"
					/>
					<span className="max-w-[45%] truncate">{toLabel}</span>
				</p>
				<div className="flex flex-wrap items-center gap-1">
					<Badge>{edgeOptionLabel(chunk.optionCount)}</Badge>
					{endingBadge ? <Badge>{endingBadge}</Badge> : null}
				</div>
			</header>
			<div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
				{chunk.steps.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						这一段没有需要选择的选项。
					</p>
				) : (
					chunk.steps.map((step, index) => (
						<StepRow
							chart={chart}
							key={index}
							lang={lang}
							number={numbers[index] ?? null}
							step={step}
						/>
					))
				)}
			</div>
			<div className="border-border/70 border-t px-3 py-2">
				<button
					className="w-full rounded-lg bg-primary/10 px-3 py-1.5 font-medium text-primary text-xs transition-colors hover:bg-primary/15"
					data-segment-key={chunk.segment.key}
					onClick={() => {
						onAfterOpenSegment?.();
						onOpenSegment?.(chunk.segment.key);
					}}
					type="button"
				>
					在路线列表中查看
				</button>
			</div>
		</div>
	);
}
