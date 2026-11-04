import { Badge } from "@web/components/ui/badge";
import { Card, CardContent } from "@web/components/ui/card";
import { formatLooseDate } from "@web/lib";
import { Link } from "@web/lib/nav";
import { ExternalLink } from "lucide-react";
import {
	countItemsOf,
	formatDate,
	langLabelOf,
	sourceNameOf,
	type WalkthroughDetail,
} from "./types";

/** 元信息标签：与值分列，长列表换行时仍能对齐阅读（对齐 GameInfo 的写法） */
const metaLabelClass = "shrink-0 pt-0.5 w-10 text-xs text-muted-foreground";
const linkClass =
	"inline-flex gap-1 items-center transition-colors duration-200 hover:text-foreground";

/**
 * 攻略概览块：这份攻略「是什么、覆盖多少、从哪来」。
 *
 * 参考站把它当页头（独立页面），我们放在内容卡最上方：布局卡已经给了作品
 * 封面与标题，这里只补充攻略自身的信息——制作会社、发售日期、计数、
 * 来源署名与两个出口（回游戏页 / 去原页面）。
 *
 * 制作会社取**作品**的厂商（game.producers），不是 release.companies：
 * 后者是「这个发行版 / 汉化补丁的组名」，拿来当制作会社就会把汉化组
 * 显示成开发商（后端 DTO 注释里也明确写了这一点）。
 */
export function WalkthroughOverview({
	detail,
	gameId,
	releasedAt,
	companies,
}: {
	detail: WalkthroughDetail;
	gameId: string;
	/** 作品的首次发售日（from loader 的 game.released_first），原样交给 formatLooseDate */
	releasedAt?: string | null;
	/** 作品的厂商展示名（去重后），来自 game.producers */
	companies?: string[];
}) {
	const lang = langLabelOf(detail.lang);
	const counts = countItemsOf(detail);
	const workCompanies = companies ?? [];
	// 跟的是汉化补丁时给一行副标题：读者要知道自己手上的版本是否对得上
	const patch = detail.release?.kind === "patch" ? detail.release : null;
	const released = formatLooseDate(releasedAt ?? undefined);
	const releasedLabel = released.formatted
		? `${released.year}-${released.formatted}`
		: null;

	return (
		<Card className="py-0 ring-border/60">
			<CardContent className="space-y-4 p-4 sm:p-5">
				<div className="flex flex-wrap gap-x-3 gap-y-2 items-center">
					<h2 className="text-xl font-semibold tracking-tight">攻略</h2>
					{lang ? <Badge variant="secondary">{lang}</Badge> : null}
					{detail.workRouteHints ? (
						<Badge variant="outline">游戏自带路线提示</Badge>
					) : null}
					<div className="flex flex-wrap gap-x-3 gap-y-1 items-center text-xs ms-auto text-muted-foreground">
						<Link className={linkClass} params={{ id: gameId }} to="/:id">
							返回游戏页面
						</Link>
						{detail.sourceUrl ? (
							<a
								className={linkClass}
								href={detail.sourceUrl}
								rel="noopener noreferrer"
								target="_blank"
							>
								查看原攻略页面
								<ExternalLink aria-hidden="true" className="size-3" />
							</a>
						) : null}
					</div>
				</div>

				{counts.length > 0 ? (
					<ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
						{counts.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				) : null}

				<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-baseline text-sm">
					{workCompanies.length > 0 ? (
						<div className="contents">
							<dt className={metaLabelClass}>制作会社</dt>
							<dd className="flex flex-wrap gap-1.5">
								{workCompanies.map((company) => (
									<Badge key={company} variant="outline">
										{company}
									</Badge>
								))}
							</dd>
						</div>
					) : null}
					{releasedLabel ? (
						<div className="contents">
							<dt className={metaLabelClass}>发售日期</dt>
							<dd className="tabular-nums">{releasedLabel}</dd>
						</div>
					) : null}
				</dl>

				{patch ? (
					<p className="text-xs text-muted-foreground">
						本攻略跟随汉化补丁：{patch.title ?? "未命名补丁"}
						{patch.companies.length > 0
							? `（${patch.companies.join(" / ")}）`
							: ""}
					</p>
				) : null}

				<p className="text-xs leading-relaxed text-muted-foreground">
					{attributionOf(detail)}
				</p>
			</CardContent>
		</Card>
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
