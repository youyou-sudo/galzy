import { EmptyState } from "@web/components/shared/empty-state";
import { Users } from "lucide-react";
import { useState } from "react";
import { CharacterCard } from "./character-card";
import type { CharacterRole, CharacterView } from "./character-types";

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

/** 身份排序权重：主角 → 配角 → 未知 */
const ROLE_RANK: Record<CharacterRole, number> = {
	main: 0,
	secondary: 1,
	appears: 2,
};

/** 主角靠前；sort 是稳定排序，同档保持名册原序 */
function sortByRole(list: CharacterView[]): CharacterView[] {
	return [...list].sort(
		(a, b) =>
			(a.rosterRole ? ROLE_RANK[a.rosterRole] : 3) -
			(b.rosterRole ? ROLE_RANK[b.rosterRole] : 3),
	);
}

/**
 * 角色列表：一张扁平栅格（不再按身份拆分组标题）。
 *
 * 身份与剧透都在卡片左上角用徽章表达（主角 / 配角 / 剧透），排序只是
 * 「主角靠前」这一条弱约束，用户扫视时先看到主角即可。
 *
 * 剧透角色默认隐藏：名册里的 spoiler 标记通常对应「出场即剧透」的角色
 * （身份反转、真结局角色等），直接铺在列表里就把玩点漏了。开关是组件内部
 * 状态（不依赖外部传回调），打勾后显示并恢复卡片上的剧透徽章。
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
	const visible = sortByRole(
		showSpoilers
			? characters
			: characters.filter((character) => !isSpoilerCharacter(character)),
	);

	if (visible.length === 0) {
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
		<div className="space-y-4">
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
			<div className={gridClass}>
				{visible.map((character) => (
					<CharacterCard
						character={character}
						key={character.id}
						onSelect={onSelect}
					/>
				))}
			</div>
		</div>
	);
}
