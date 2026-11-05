import { Image } from "@unpic/react";
import { AspectRatio } from "@web/components/ui/aspect-ratio";
import { Badge } from "@web/components/ui/badge";
import { useThumbHashDataUrl } from "@web/lib/image";
import { cn } from "@web/lib/utils";
import { useState } from "react";
import { type CharacterView, spoilerLabelOf } from "./character-types";

/** 封面默认竖版比例（名册行没带 width/height 时的兜底） */
const FALLBACK_IMAGE_WIDTH = 400;
const FALLBACK_IMAGE_HEIGHT = 533;

/**
 * 剧透徽章：只留这一枚，压到右上角、缩到 10px。
 *
 * 身份（主要/次要/登场）不再逐卡打标 —— 分组标题已经写明了，
 * 卡片上重复一遍既冗余，窄屏还会占掉封面顶部一大块。
 */
const spoilerBadgeClass =
	"h-4 px-1.5 rounded-md text-[10px] bg-background/95 text-destructive ring-1 ring-border/70 shadow-sm backdrop-blur-sm pointer-events-none";

/**
 * 角色卡片：竖版封面 + 姓名（副标拉丁名）+ 剧透徽章（仅剧透角色才有）。
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
				{spoilerLabel && (
					<Badge
						className={cn(spoilerBadgeClass, "absolute top-1.5 right-1.5 z-10")}
						variant="outline"
					>
						{spoilerLabel}
					</Badge>
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
