import { SectionHeader } from "@web/components/shared/section-header";
import {
	type ChartLang,
	nodeLabel,
	segmentOptionCount,
	segmentsForCharacter,
	type WalkthroughChart,
} from "@web/components/walkthrough/chart";
import { cn } from "@web/lib/utils";
import { ListOrdered } from "lucide-react";

/**
 * 「按角色」视图顶部的段落概览：每条路线分几段、每段从哪到哪、几个选项。
 *
 * 点击只做滚动（锚点由图表的 OrderView 渲染，id 见 segmentAnchorId），
 * 不折叠/展开段落——正文始终完整渲染，避免「点一下少一半内容」的错觉。
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
	const segments = segmentsForCharacter(chart, characterKey);
	if (segments.length === 0) return null;

	return (
		<section>
			<div className="mb-3">
				<SectionHeader
					className="mb-1"
					count={`${segments.length} 段`}
					icon={ListOrdered}
					title="段落"
				/>
				<p className="text-xs text-muted-foreground">
					本路线分 {segments.length} 段，点击跳到对应段落
				</p>
			</div>
			<ol className="grid gap-2 sm:grid-cols-2">
				{segments.map((segment, index) => {
					const from = nodeLabel(chart, segment.from_node, lang).primary;
					const to = nodeLabel(chart, segment.to_node, lang).primary;
					const options = segmentOptionCount(segment);
					return (
						<li key={segment.key}>
							<button
								className={cn(
									"flex gap-2 items-center p-2.5 w-full text-left rounded-xl ring-1 ring-border/60 transition-colors duration-200",
									"hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
								)}
								onClick={() => onSelect(segment.key)}
								type="button"
							>
								<span className="grid place-items-center shrink-0 w-6 h-6 text-xs font-medium tabular-nums bg-muted rounded-lg">
									{index + 1}
								</span>
								<span className="flex-1 min-w-0 text-sm truncate">
									{from} → {to}
								</span>
								{options > 0 ? (
									<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
										{options} 个选项
									</span>
								) : null}
							</button>
						</li>
					);
				})}
			</ol>
		</section>
	);
}
