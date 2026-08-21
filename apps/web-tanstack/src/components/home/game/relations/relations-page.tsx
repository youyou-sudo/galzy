import { getRouteApi } from "@tanstack/react-router";
import { GameCard } from "@web/components/home/card";
import { Link } from "@tanstack/react-router";

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
	const { relations } = apiroute.useLoaderData();
	const list: RelationItem[] = relations?.relations ?? [];

	if (list.length === 0) {
		return (
			<div className="p-8 text-center text-sm text-zinc-500">
				暂无相关游戏
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{list.map((rel) => {
				const label =
					RELATION_LABELS[rel.relation] ??
					(rel.reverse ? "反向相关" : "相关");
				return (
					<div key={rel.vid} className="relative">
						{rel.game ? (
							<GameCard.Item
								gameid={rel.vid}
								width={rel.game.images?.width ?? 200}
								height={rel.game.images?.height ?? 300}
								src={
									rel.game.images?.imageUrl ??
									"/No-Image-Placeholder.svg.webp"
								}
								cSexualAvg={rel.game.images?.c_sexual_avg}
								title={
									rel.game.titles_obj?.find(
										(t) =>
											t.lang === rel.game?.olang &&
											t.title.trim() !== "",
									)?.title || "null"
								}
							/>
						) : (
							// 站内未收录（无文件）：仅显示缓存标题链接
							<Link
								to="/$id"
								params={{ id: rel.vid }}
								className="block rounded-lg border border-zinc-200 p-3 text-center text-sm text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300"
							>
								{rel.title ?? rel.vid}
							</Link>
						)}
						<span className="absolute left-1 top-1 z-10 rounded bg-zinc-900/70 px-1.5 py-0.5 text-xs text-white">
							{label}
						</span>
					</div>
				);
			})}
		</div>
	);
}
