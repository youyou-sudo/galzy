import { Image } from "@unpic/react";
import { EmptyState } from "@web/components/shared/empty-state";
import { Users } from "lucide-react";
import { useState } from "react";
import { CharacterCard } from "./character-card";
import {
	type CharacterRole,
	type CharacterView,
	spoilerLabelOf,
} from "./character-types";

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

/**
 * 分组只认名册的 rosterRole：main → 主角、secondary → 配角，
 * appears / unknown（以及取值缺失）统一归「其他登场角色」。
 */
type SectionKey = "main" | "secondary" | "other";

const SECTION_META: Array<{
	key: SectionKey;
	title: string;
	layout: "grid" | "list";
}> = [
	{ key: "main", title: "主角", layout: "grid" },
	{ key: "secondary", title: "配角", layout: "grid" },
	{ key: "other", title: "其他登场角色", layout: "list" },
];

function sectionKeyOf(role: CharacterRole | null | undefined): SectionKey {
	if (role === "main") return "main";
	if (role === "secondary") return "secondary";
	return "other";
}

/**
 * 同一个人在上游名册里可能落成两条（例如 secondary 有图 + unknown 无图的重复
 * 条目，名字只差空格）。比较时去掉空白并忽略大小写，「其他登场角色」不再
 * 重复列出已经在主角/配角卡片里出现过的名字。
 */
function normalizedName(name: string): string {
	return name.replace(/\s+/g, "").toLowerCase();
}

/**
 * 其他登场角色的紧凑行：小缩略图（无图用姓名首字）+ 姓名（副标拉丁名）。
 *
 * 这些角色大多没有立绘，用行而不是 3:4 卡片，一屏能扫完几十个人，
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
 * 角色列表：按名册身份分组（主角 / 配角 / 其他登场角色）。
 *
 * 分组依据是 API 数据源的名册字段 roster_role（main / secondary / appears /
 * unknown）：主角、配角用卡片网格，其他登场角色用紧凑行 —— 这批角色大多没有
 * 立绘，铺成 3:4 大卡只会得到一整屏「首字占位」空卡。组内保持上游名册顺序。
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

	// 用「全部名册」算卡片名字：剧透卡片默认隐藏时，重复的 other 行也不能
	// 把它的名字提前漏出来
	const cardNames = new Set(
		characters
			.filter((character) => sectionKeyOf(character.rosterRole) !== "other")
			.map((character) => normalizedName(character.name)),
	);

	const grouped = new Map<SectionKey, CharacterView[]>();
	for (const character of visible) {
		const key = sectionKeyOf(character.rosterRole);
		if (key === "other" && cardNames.has(normalizedName(character.name))) {
			continue;
		}
		const bucket = grouped.get(key);
		if (bucket) bucket.push(character);
		else grouped.set(key, [character]);
	}
	// 没有可见角色的组（全被剧透开关藏起、或与卡片同名被去重）不渲染标题
	const sections = SECTION_META.flatMap((meta) => {
		const list = grouped.get(meta.key);
		return list && list.length > 0 ? [{ ...meta, characters: list }] : [];
	});

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
				{sections.map((section) => (
					<section className="space-y-3" key={section.key}>
						<h3 className="flex gap-1.5 items-baseline text-sm font-semibold">
							{section.title}
							<span className="text-xs font-normal text-muted-foreground">
								{section.characters.length}
							</span>
						</h3>
						{section.layout === "grid" ? (
							<div className={gridClass}>
								{section.characters.map((character) => (
									<CharacterCard
										character={character}
										key={character.id}
										onSelect={onSelect}
									/>
								))}
							</div>
						) : (
							<div className={rowGridClass}>
								{section.characters.map((character) => (
									<CharacterRow
										character={character}
										key={character.id}
										onSelect={onSelect}
									/>
								))}
							</div>
						)}
					</section>
				))}
			</div>
		</div>
	);
}
