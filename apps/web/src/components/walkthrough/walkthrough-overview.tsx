import { Badge } from "@web/components/ui/badge";
import { ExternalLink } from "lucide-react";
import {
	countItemsOf,
	formatDate,
	langLabelOf,
	sourceNameOf,
	type WalkthroughDetail,
} from "./types";

/**
 * 攻略概览块：这份攻略「是什么、覆盖多少、从哪来」。
 *
 * 不用 Card 包裹（用户要求）：这一页是作品页的页签，外面已经有页面级留白
 * 与页签栏，再套一层卡只是把同一块内容多描一遍边。现在是一段直接落在
 * 页面上的信息块，视觉层级靠字号/颜色，而不是容器。
 *
 * 右侧给一个「查看原攻略页面」的出口（新窗口打开）：正文只搬了选项与存档
 * 结构，原文的说明与配图得回原站看；sourceUrl 为空（本站整理）时不渲染。
 */
export function WalkthroughOverview({ detail }: { detail: WalkthroughDetail }) {
	const lang = langLabelOf(detail.lang);
	const counts = countItemsOf(detail);
	// 跟的是汉化补丁时给一行副标题：读者要知道自己手上的版本是否对得上
	const patch = detail.release?.kind === "patch" ? detail.release : null;
	// 只放行 http(s)：sourceUrl 来自上游同步，库里可能存在任意字符串，
	// 直接拼进 href 会留出 javascript: 之类的口子
	const rawSourceUrl = detail.sourceUrl?.trim();
	const sourceUrl =
		rawSourceUrl && /^https?:\/\//i.test(rawSourceUrl) ? rawSourceUrl : null;

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
						<h2 className="font-semibold text-xl tracking-tight">攻略</h2>
						{lang ? <Badge variant="secondary">{lang}</Badge> : null}
						{detail.workRouteHints ? (
							<Badge variant="outline">游戏自带路线提示</Badge>
						) : null}
					</div>

					{counts.length > 0 ? (
						<ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
							{counts.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					) : null}

					{patch ? (
						<p className="text-xs text-muted-foreground">
							本攻略跟随汉化补丁：{patch.title ?? "未命名补丁"}
							{patch.companies.length > 0
								? `（${patch.companies.join(" / ")}）`
								: ""}
						</p>
					) : null}
				</div>

				{sourceUrl ? (
					// 文字链接而不是按钮（用户要求）：这里是「补充材料在哪」的
					// 一句注脚，不是这一页的主要操作，做成按钮会和页签/下载抢视线
					<a
						className="inline-flex shrink-0 items-center gap-1 rounded-sm font-medium text-primary text-sm underline-offset-4 opacity-70 transition-[color,opacity] hover:text-primary hover:underline hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
						href={sourceUrl}
						rel="noopener noreferrer"
						target="_blank"
					>
						查看原攻略页面
						<ExternalLink aria-hidden className="size-3.5" />
					</a>
				) : null}
			</div>

			<p className="text-xs leading-relaxed text-muted-foreground">
				{attributionOf(detail)}
			</p>
		</div>
	);
}

/**
 * 来源署名：必须写清「只搬了选项结构、原文说明请看原页面」，
 * 否则读者会以为中文解释也是原作者的。
 */
function attributionOf(detail: WalkthroughDetail): string {
	const sentences: string[] = [];
	const source = detail.source;
	// nextmoe = 本站撰写（没有原页面可指），source_url 也为空
	const isPlatform = !detail.sourceUrl || source === "nextmoe";

	if (isPlatform) {
		sentences.push("本页由本站整理，只保留了选项与存档结构。");
	} else if (source) {
		const updated = detail.sourceUpdatedOn
			? `，原页面更新于 ${formatDate(detail.sourceUpdatedOn)}`
			: "";
		sentences.push(
			`选项流程整理自 ${sourceNameOf(detail) ?? "原攻略页面"}${updated}。只保留了选项与存档结构，原文说明请查看原页面。`,
		);
	}

	if (detail.lang?.toLowerCase().startsWith("zh")) {
		sentences.push("原文即中文，游戏内显示的语言与原文一致。");
	} else {
		const sourceLang = langLabelOf(detail.lang) ?? "原文";
		sentences.push(
			`选项的中文为机器翻译，游戏内显示的是${sourceLang}原文；没有可靠译名的人名保持原文。`,
		);
	}

	return sentences.join("");
}
