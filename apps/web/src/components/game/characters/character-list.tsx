import { Image } from "@unpic/react";
import { EmptyState } from "@web/components/shared/empty-state";
import { Users } from "lucide-react";
import { useState } from "react";
import { CharacterCard } from "./character-card";
import { type CharacterView, spoilerLabelOf } from "./character-types";

/**
 * 角色卡比系列卡再小一档：角色封面是 3:4 竖版、名字短，
 * 同一行能放更多；手机端也从 2 列提到 3 列。
 */
const gridClass =
	"grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-x-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7";

/** 紧凑行：一行一个角色，手机 2 列、桌面 4 列 */
const rowGridClass =
	"grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-4";

/** 无图缩略图的兜底尺寸（kungal 头像是 250×300 的竖版） */
const FALLBACK_IMAGE_WIDTH = 250;
const FALLBACK_IMAGE_HEIGHT = 300;

/** 带剧透标记的角色（minor / major）：默认不展示，由开关控制 */
function isSpoilerCharacter(character: CharacterView): boolean {
	return (character.spoiler ?? "none") !== "none";
}

/** 有立绘的角色铺卡片网格；没有立绘的才单独收进「其他登场角色」紧凑行 */
function hasCharacterImage(character: CharacterView): boolean {
	return Boolean(character.imageUrl);
}

/**
 * 同一个人在上游名册里可能落成两条（一条有图、一条无图的重复条目，名字只差
 * 空格）。比较时去掉空白并忽略大小写，「其他登场角色」不再重复列出已经在
 * 卡片里出现过的名字。
 */
function normalizedName(name: string): string {
	return name.replace(/\s+/g, "").toLowerCase();
}

/**
 * 其他登场角色的紧凑行：小缩略图（无图用姓名首字）+ 姓名（副标拉丁名）。
 *
 * 这些角色都没有立绘，用行而不是 3:4 卡片，一屏能扫完几十个人，
 * 不会被大块首字占位空卡淹没；点击仍然打开同一个角色弹窗。
 */
function CharacterRow({
	character,
	onSelect,
}: {
	character: CharacterView;
	onSelect: (character: CharacterView) => void;
}) {
	const [failed, setFailed] = useState(false);
	const imageUrl = failed ? null : character.imageUrl;
	const initial = character.name.trim().slice(0, 1) || "?";
	const spoilerLabel = spoilerLabelOf(character.spoiler);

	return (
		<button
			type="button"
			onClick={() => onSelect(character)}
			className="group -m-1 flex gap-2 items-center min-w-0 p-1 rounded-xl text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
		>
			<span className="overflow-hidden relative flex justify-center items-center shrink-0 size-9 bg-muted/40 rounded-lg ring-1 ring-border/60">
				{imageUrl ? (
					<Image
						alt=""
						className="absolute inset-0 w-full h-full object-cover object-top"
						decoding="async"
						height={character.imageHeight ?? FALLBACK_IMAGE_HEIGHT}
						loading="lazy"
						onError={() => setFailed(true)}
						src={imageUrl}
						width={character.imageWidth ?? FALLBACK_IMAGE_WIDTH}
					/>
				) : (
					<span
						aria-hidden="true"
						className="text-sm font-semibold select-none text-muted-foreground/70"
					>
						{initial}
					</span>
				)}
			</span>
			<span className="flex flex-col min-w-0">
				<span
					className="block text-sm font-medium truncate"
					data-character-name={character.name}
					title={character.name}
				>
					{character.name}
				</span>
				{(character.latin || spoilerLabel) && (
					<span className="flex gap-1 items-center min-w-0">
						{character.latin && (
							<span
								className="text-xs truncate text-muted-foreground"
								title={character.latin}
							>
								{character.latin}
							</span>
						)}
						{spoilerLabel && (
							<span className="shrink-0 text-[10px] text-destructive">
								{spoilerLabel}
							</span>
						)}
					</span>
				)}
			</span>
		</button>
	);
}

/**
 * 角色列表：有立绘的统一铺卡片网格，没有立绘的才单独收进「其他登场角色」。
 *
 * 不再按名册身份（main / secondary / appears）分标题：身份只体现在卡片角标上，
 * 有立绘就一视同仁地展示。无立绘的角色铺成 3:4 大卡只会得到一整屏「首字占位」
 * 空卡，所以统一用紧凑行。两段都保持上游名册顺序。
 *
 * 剧透角色默认隐藏：名册里的 spoiler 标记通常对应「出场即剧透」的角色
 * （身份反转、真结局角色等），直接铺在列表里就把玩点漏了。开关是组件内部
 * 状态（不依赖外部传回调），打勾后显示并在卡片/行上恢复剧透标记。
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

	// 用「全部名册」算卡片名字：剧透卡片默认隐藏时，重复的无图行也不能
	// 把它的名字提前漏出来
	const cardNames = new Set(
		characters
			.filter(hasCharacterImage)
			.map((character) => normalizedName(character.name)),
	);

	const cards: CharacterView[] = [];
	const others: CharacterView[] = [];
	for (const character of visible) {
		if (hasCharacterImage(character)) {
			cards.push(character);
			continue;
		}
		if (cardNames.has(normalizedName(character.name))) continue;
		others.push(character);
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
			<div className="space-y-6">
				{cards.length > 0 && (
					<div className={gridClass}>
						{cards.map((character) => (
							<CharacterCard
								character={character}
								key={character.id}
								onSelect={onSelect}
							/>
						))}
					</div>
				)}
				{others.length > 0 && (
					<section className="space-y-3">
						<h3 className="flex gap-1.5 items-baseline text-sm font-semibold">
							其他登场角色
							<span className="text-xs font-normal text-muted-foreground">
								{others.length}
							</span>
						</h3>
						<div className={rowGridClass}>
							{others.map((character) => (
								<CharacterRow
									character={character}
									key={character.id}
									onSelect={onSelect}
								/>
							))}
						</div>
					</section>
				)}
			</div>
		</div>
	);
}
