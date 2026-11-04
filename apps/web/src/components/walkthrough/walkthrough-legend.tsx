import {
	type ChartLang,
	resolveText,
	type WalkthroughChart,
} from "@web/components/walkthrough/chart";
import { ChevronDown, Info } from "lucide-react";

/**
 * 符号说明：原页面自己定义的那些记号（★、⇒、( ) 等）。
 *
 * 默认折叠——它是「看不懂某个记号时才查」的补充材料，展开状态不写地址栏：
 * 纯展示细节，没必要为它多一个可分享的 URL 变体。
 */
export function WalkthroughLegend({
	chart,
	lang,
}: {
	chart: WalkthroughChart;
	lang: ChartLang;
}) {
	const lines = chart.legend ?? [];
	if (lines.length === 0) return null;

	return (
		<details className="group bg-muted/20 rounded-xl ring-1 ring-border/60">
			<summary
				className={
					"flex gap-2 items-center px-3 h-9 text-sm font-medium rounded-xl cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
				}
			>
				<Info aria-hidden="true" className="size-4 text-muted-foreground" />
				符号说明
				<ChevronDown
					aria-hidden="true"
					className="size-4 ms-auto text-muted-foreground transition-transform duration-200 group-open:rotate-180"
				/>
			</summary>
			<ul className="px-3 pb-3 space-y-1.5 text-sm leading-relaxed">
				{lines.map((line, index) => {
					const text = resolveText(line.text, line.localized, lang);
					return (
						// 上游没有给 legend 行任何 id/顺序保证，按下标做 key 即可
						// biome-ignore lint/suspicious/noArrayIndexKey: 同上
						<li key={index}>
							<span>{text.primary}</span>
							{text.secondary ? (
								<span className="ml-1 text-muted-foreground">
									（{text.secondary}）
								</span>
							) : null}
						</li>
					);
				})}
			</ul>
		</details>
	);
}
