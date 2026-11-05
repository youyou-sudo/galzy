import { EmptyState } from "@web/components/shared/empty-state";
import { SectionHeader } from "@web/components/shared/section-header";
import { Users } from "lucide-react";
import { useState } from "react";
import { CharacterCard } from "./character-card";
import { type CharacterView, groupCharacters } from "./character-types";

/**
 * 角色卡比系列卡再小一档：角色封面是 3:4 竖版、名字短，
 * 同一行能放更多；手机端也从 2 列提到 3 列。
 */
const gridClass =
	"grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-x-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7";

/** 带剧透标记的角色（minor / major）：默认不展示，由开关控制 */
function isSpoilerCharacter(character: CharacterView): boolean {
	return (character.spoiler ?? "none") !== "none";
}

/**
 * 角色列表：按身份分组（主要 / 次要 / 登场 / 其他），每组一张章节标题 + 卡片栅格。
 *
 * 剧透角色默认隐藏：名册里的 spoiler 标记通常对应「出场即剧透」的角色
 * （身份反转、真结局角色等），直接铺在列表里就把玩点漏了。开关是组件内部状态
 * （不依赖外部传回调，少一层耦合），打勾后显示并恢复卡片上的剧透徽章。
 */
export function CharacterList({
	characters,
	onSelect,
}: {
	characters: CharacterView[];
	onSelect: (character: CharacterView) => void;
}) {
	const [showSpoilers, setShowSpoilers] = useState(false);
	const spoilerCount = characters.filter(isSpoilerCharacter).length;
	const visible = showSpoilers
		? characters
		: characters.filter((character) => !isSpoilerCharacter(character));
	const groups = groupCharacters(visible);

	if (groups.length === 0) {
		// 全都藏在剧透开关后面时给一句可操作的提示，而不是「没有收录角色」
		if (spoilerCount > 0 && !showSpoilers) {
			return (
				<EmptyState
					description="勾选上方的「显示剧透角色」即可查看"
					icon={Users}
					size="sm"
					title="角色都带剧透标记"
				/>
			);
		}
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
		<div className="space-y-6">
			{spoilerCount > 0 && (
				<label className="inline-flex gap-2 items-center text-xs cursor-pointer select-none text-muted-foreground hover:text-foreground">
					<input
						checked={showSpoilers}
						className="size-3.5 rounded-sm accent-primary"
						onChange={(event) => setShowSpoilers(event.target.checked)}
						type="checkbox"
					/>
					显示剧透角色（{spoilerCount}）
				</label>
			)}
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
		</div>
	);
}
