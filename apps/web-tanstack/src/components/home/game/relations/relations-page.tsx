import { getRouteApi } from "@tanstack/react-router";
import { GameCard } from "@web/components/home/card";
import { EmptyState } from "@web/components/shared/empty-state";
import { GitFork } from "lucide-react";

const apiroute = getRouteApi("/$id/_layout/relations");

/** VNDB relation 类型 → 中文标签 */
const RELATION_LABELS: Record<string, string> = {
	seq: "续作",
	preq: "前作",
	fan: "衍生作品",
	side: "外传",
	orig: "原作",
	set: "同设定",
	char: "同角色",
	alt: "其他版本",
	par: "系列",
	ser: "系列",
	and: "动画",
};

interface RelationGame {
	id: string;
	olang: string;
	titles_obj: Array<{ lang: string; title: string }>;
	images?: {
		imageUrl?: string | null;
		width?: number | null;
		height?: number | null;
		thumbhash?: string | null;
		c_sexual_avg?: number | null;
	} | null;
}

interface RelationItem {
	vid: string;
	relation: string;
	relationOfficial: boolean | null;
	title: string | null;
	reverse: boolean;
	game: RelationGame | null;
}

export function RelationsPage() {
	const { relations } = apiroute.useLoaderData() as {
		relations?: { relations?: RelationItem[]; truncated?: boolean };
	};
	// 仅显示站内已收录（有 vn 数据/下载文件）的关联游戏；站外未收录的隐藏
	const list: RelationItem[] = (relations?.relations ?? []).filter(
		(rel) => rel.game != null,
	);
	const truncated = relations?.truncated ?? false;

	if (list.length === 0) {
		return (
			<EmptyState
				icon={GitFork}
				size="sm"
				title="暂无相关游戏"
				description="这部作品还没有收录系列或关联作品"
			/>
		);
	}

	return (
		<>
			{truncated && (
				<p className="mb-3 text-center text-xs text-muted-foreground">
					关联作品较多，仅显示部分
				</p>
			)}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{list.map((rel) => {
					const label =
						RELATION_LABELS[rel.relation] ??
						(rel.reverse ? "反向相关" : "相关");
					return (
						<div key={rel.vid} className="relative">
							<GameCard.Item
								gameid={rel.game!.id}
								width={rel.game!.images?.width ?? 200}
								height={rel.game!.images?.height ?? 300}
								thumbhash={rel.game!.images?.thumbhash}
								src={
									rel.game!.images?.imageUrl ?? "/No-Image-Placeholder.svg.webp"
								}
								cSexualAvg={rel.game!.images?.c_sexual_avg}
								title={
									rel.game!.titles_obj?.find(
										(t) => t.lang === rel.game!.olang && t.title.trim() !== "",
									)?.title || "null"
								}
							/>
							{/* 关系标签：封面颜色不可控，必须用近实底 + 发丝边保证任何封面上都可读；
							    字号从 11px 提到 12px，并限制最大宽度避免长标签压住封面 */}
							<span className="pointer-events-none absolute top-2 left-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-lg bg-background/95 px-2 py-1 text-xs font-semibold text-foreground shadow-sm ring-1 ring-border/70 backdrop-blur-sm">
								{label}
							</span>
						</div>
					);
				})}
			</div>
		</>
	);
}
