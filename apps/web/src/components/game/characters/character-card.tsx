import { Image } from "@unpic/react";
import { AspectRatio } from "@web/components/ui/aspect-ratio";
import { Badge } from "@web/components/ui/badge";
import { useThumbHashDataUrl } from "@web/lib/image";
import { cn } from "@web/lib/utils";
import { useState } from "react";
import {
	type CharacterView,
	roleLabelOf,
	spoilerLabelOf,
} from "./character-types";

/** 封面默认竖版比例（名册行没带 width/height 时的兜底） */
const FALLBACK_IMAGE_WIDTH = 400;
const FALLBACK_IMAGE_HEIGHT = 533;

/** 卡片徽章：封面颜色不可控，统一近实底 + 发丝边，保证任何底图上都可读 */
const badgeClass =
	"h-5 rounded-lg bg-background/95 ring-1 ring-border/70 shadow-sm backdrop-blur-sm pointer-events-none";

/**
 * 角色卡片：竖版封面 + 姓名（副标拉丁名）+ 身份/剧透徽章。
 *
 * 整卡是原生 button 语义：键盘 Tab 可聚焦、Enter/Space 打开详情弹窗；
 * 不嵌套链接，避免出现「按钮里套按钮」的无障碍问题。
 */
export function CharacterCard({
	character,
	onSelect,
	className,
}: {
	character: CharacterView;
	onSelect: (character: CharacterView) => void;
	className?: string;
}) {
	const [failed, setFailed] = useState(false);
	const placeholder = useThumbHashDataUrl(character.imageThumbhash);
	const imageUrl = failed ? null : character.imageUrl;
	// 无图占位：姓名首字（CJK 一个字，拉丁名取首字母大写）
	const initial = character.name.trim().slice(0, 1) || "?";
	const roleLabel = roleLabelOf(character.rosterRole);
	const spoilerLabel = spoilerLabelOf(character.spoiler);

	return (
		<button
			type="button"
			onClick={() => onSelect(character)}
			className={cn(
				"group -m-1.5 flex flex-col gap-2 rounded-2xl p-1.5 text-left transition-colors duration-200",
				"hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
				className,
			)}
		>
			<div className="relative overflow-hidden w-full bg-muted/40 rounded-xl ring-1 ring-border/60">
				<AspectRatio ratio={3 / 4} className="overflow-hidden">
					{imageUrl ? (
						<>
							{placeholder && (
								<img
									alt=""
									aria-hidden="true"
									className="absolute inset-0 w-full h-full object-cover"
									src={placeholder}
								/>
							)}
							<Image
								alt={character.name}
								className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
								decoding="async"
								height={character.imageHeight ?? FALLBACK_IMAGE_HEIGHT}
								loading="lazy"
								onError={() => setFailed(true)}
								src={imageUrl}
								width={character.imageWidth ?? FALLBACK_IMAGE_WIDTH}
							/>
						</>
					) : (
						<span
							aria-hidden="true"
							className="absolute inset-0 flex justify-center items-center text-3xl font-semibold select-none text-muted-foreground/60"
						>
							{initial}
						</span>
					)}
				</AspectRatio>
				{(roleLabel || spoilerLabel) && (
					<div className="flex absolute top-2 left-2 z-10 flex-wrap gap-1 max-w-[calc(100%-1rem)]">
						{roleLabel && (
							<Badge className={badgeClass} variant="outline">
								{roleLabel}
							</Badge>
						)}
						{spoilerLabel && (
							<Badge
								className={cn(badgeClass, "text-destructive")}
								variant="outline"
							>
								{spoilerLabel}
							</Badge>
						)}
					</div>
				)}
			</div>
			<div className="min-w-0 px-0.5">
				<p className="text-sm font-medium truncate" title={character.name}>
					{character.name}
				</p>
				{character.latin && (
					<p
						className="text-xs truncate text-muted-foreground"
						title={character.latin}
					>
						{character.latin}
					</p>
				)}
			</div>
		</button>
	);
}
