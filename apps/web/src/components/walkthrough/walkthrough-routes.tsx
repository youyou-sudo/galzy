import { SectionHeader } from "@web/components/shared/section-header";
import type { ChartStats } from "@web/components/walkthrough/chart";
import { cn } from "@web/lib/utils";
import { Users } from "lucide-react";
import {
	characterNameOf,
	routeCountsLine,
	type WalkthroughCharacter,
} from "./types";

/**
 * 角色路线卡：一行一个角色，第一张是「全部路线」。
 *
 * 点击即切 `character=<key>`（并回到按角色视图）；「全部路线」清空选择。
 * 结局数/段数来自 chartStats 的 byCharacter，与视图里的过滤口径一致。
 */
export function WalkthroughRoutes({
	characters,
	stats,
	selectedKey,
	onSelect,
}: {
	characters: WalkthroughCharacter[];
	stats: ChartStats;
	selectedKey: string | null;
	onSelect: (characterKey: string | null) => void;
}) {
	if (characters.length === 0) return null;

	return (
		<section>
			<div className="mb-3">
				<SectionHeader
					className="mb-1"
					count={characters.length}
					icon={Users}
					title="角色路线"
				/>
				<p className="text-xs text-muted-foreground">
					选择角色查看这条路线的选项
				</p>
			</div>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
				<RouteCard
					active={selectedKey === null}
					description={routeCountsLine(stats.endings, stats.segments)}
					onClick={() => onSelect(null)}
					title="全部路线"
				/>
				{characters.map((character) => {
					const item = stats.byCharacter[character.key];
					return (
						<RouteCard
							active={selectedKey === character.key}
							description={routeCountsLine(
								item?.endings ?? 0,
								item?.segments ?? 0,
							)}
							key={character.key}
							onClick={() => onSelect(character.key)}
							title={characterNameOf(character)}
						/>
					);
				})}
			</div>
		</section>
	);
}

function RouteCard({
	active,
	title,
	description,
	onClick,
}: {
	active: boolean;
	title: string;
	description: string;
	onClick: () => void;
}) {
	return (
		<button
			aria-pressed={active}
			className={cn(
				"flex flex-col gap-0.5 items-start p-3 text-left rounded-xl ring-1 transition-colors duration-200",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
				active ? "bg-muted/60 ring-border" : "ring-border/60 hover:bg-muted/40",
			)}
			onClick={onClick}
			type="button"
		>
			<span className="overflow-hidden max-w-full text-sm font-medium whitespace-nowrap text-ellipsis">
				{title}
			</span>
			{description ? (
				<span className="text-xs tabular-nums text-muted-foreground">
					{description}
				</span>
			) : null}
		</button>
	);
}
