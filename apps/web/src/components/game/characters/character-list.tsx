import { EmptyState } from "@web/components/shared/empty-state";
import { SectionHeader } from "@web/components/shared/section-header";
import { Users } from "lucide-react";
import { CharacterCard } from "./character-card";
import { type CharacterView, groupCharacters } from "./character-types";

/** 与系列页签同一套栅格断点，卡片密度一致 */
const gridClass =
	"grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

/**
 * 角色列表：按身份分组（主要 / 次要 / 登场 / 其他），每组一张章节标题 + 卡片栅格。
 * 空态与无图占位都走全站统一组件，不另写一套灰字。
 */
export function CharacterList({
	characters,
	onSelect,
}: {
	characters: CharacterView[];
	onSelect: (character: CharacterView) => void;
}) {
	const groups = groupCharacters(characters);

	if (groups.length === 0) {
		return (
			<EmptyState
				description="这部作品还没有收录角色信息"
				icon={Users}
				size="sm"
				title="暂无角色数据"
			/>
		);
	}

	return (
		<div className="space-y-8">
			{groups.map((group) => (
				<section key={group.key}>
					<SectionHeader
						count={group.characters.length}
						icon={Users}
						title={group.label}
					/>
					<div className={gridClass}>
						{group.characters.map((character) => (
							<CharacterCard
								character={character}
								key={character.id}
								onSelect={onSelect}
							/>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
