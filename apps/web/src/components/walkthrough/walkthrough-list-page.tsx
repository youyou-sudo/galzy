import { EmptyState } from "@web/components/shared/empty-state";
import { SectionHeader } from "@web/components/shared/section-header";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent } from "@web/components/ui/card";
import { Link } from "@web/lib/nav";
import { ChevronRight, Route } from "lucide-react";
import { useMemo } from "react";
import {
	countsLine,
	formatDate,
	langLabelOf,
	readWalkthroughList,
	sourceNameOf,
	type WalkthroughSummary,
	walkthroughTitleOf,
} from "./types";

/**
 * 「攻略」页签列表：一部作品通常只有一份 kungal 攻略，
 * 所以这里不做分页/筛选，一行一张卡，点进详情。
 *
 * 空态用全站统一 EmptyState，不另写灰字——删除站内攻略文章后，
 * 「没有攻略」会成为常见状态，文案要说得清楚而不是像出错。
 */
export function WalkthroughListPage({
	data,
	gameId,
}: {
	data: unknown;
	gameId: string;
}) {
	const list = useMemo(() => readWalkthroughList(data), [data]);

	if (list.length === 0) {
		return (
			<EmptyState
				description="这部作品还没有收录选项流程攻略，收录后会出现在这里"
				icon={Route}
				size="sm"
				title="暂无攻略"
			/>
		);
	}

	return (
		<section>
			<SectionHeader count={list.length} icon={Route} title="攻略" />
			<div className="space-y-2">
				{list.map((item) => (
					<WalkthroughCard gameId={gameId} item={item} key={item.id} />
				))}
			</div>
		</section>
	);
}

function WalkthroughCard({
	item,
	gameId,
}: {
	item: WalkthroughSummary;
	gameId: string;
}) {
	const counts = countsLine(item);
	const lang = langLabelOf(item.lang);
	const updated = formatDate(item.updatedAt);
	// 来源展示名与概览卡共用 sourceNameOf：署名 → 域名 → source 原值
	const source = sourceNameOf(item);
	const meta = [
		source ? `整理自 ${source}` : null,
		updated ? `更新于 ${updated}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<Link
			className="block group"
			params={{ id: gameId, walkthroughId: item.id }}
			// 进攻略详情后由 GameTabs 内的页签锚定把页签栏顶到视口顶部；
			// 交给 furin 复位滚动会把这次锚定覆盖掉（复位晚于页内的 layout effect）
			resetScroll={false}
			to="/:id/walkthrough/:walkthroughId"
		>
			<Card className="py-0 transition-colors duration-200 ring-border/60 group-hover:bg-muted/40">
				<CardContent className="flex gap-3 items-center p-4">
					<div className="flex-1 min-w-0 space-y-1">
						<div className="flex flex-wrap gap-2 items-center">
							<span className="text-sm font-medium">
								{walkthroughTitleOf(item)}
							</span>
							{lang ? <Badge variant="outline">{lang}</Badge> : null}
						</div>
						{counts ? (
							<p className="text-xs tabular-nums text-muted-foreground">
								{counts}
							</p>
						) : null}
						{meta ? (
							<p className="text-xs text-muted-foreground">{meta}</p>
						) : null}
					</div>
					<ChevronRight
						aria-hidden="true"
						className="shrink-0 size-4 text-muted-foreground"
					/>
				</CardContent>
			</Card>
		</Link>
	);
}
