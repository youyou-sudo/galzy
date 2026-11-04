import { Image } from "@unpic/react";
import { AspectRatio } from "@web/components/ui/aspect-ratio";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@web/components/ui/dialog";
import { Skeleton } from "@web/components/ui/skeleton";
import { getImageRatio, useThumbHashDataUrl } from "@web/lib/image";
import { Link } from "@web/lib/nav";
import { cn } from "@web/lib/utils";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import {
	type CharacterInfoView,
	type CharacterView,
	formatBirthday,
	formatBloodType,
	formatGender,
	formatMeasurements,
	roleLabelOf,
	spoilerLabelOf,
} from "./character-types";

/** 立绘兜底尺寸（没有 width/height 时给 unpic 的比例参考） */
const FALLBACK_IMAGE_WIDTH = 400;
const FALLBACK_IMAGE_HEIGHT = 533;

/** 角色信息弹窗：左侧立绘 + 右侧资料表（详情按需拉取，列表字段先渲染） */
export function CharacterDialog({
	character,
	info,
	isDetailLoading = false,
	isDetailError = false,
	onRetry,
	open,
	onOpenChange,
}: {
	/** 列表（名册）里的角色；关闭后保留，避免退场动画期间内容被清空 */
	character: CharacterView | null;
	/** /characters/info 的详情（到了就覆盖列表字段并补齐出演作品） */
	info?: CharacterInfoView | null;
	isDetailLoading?: boolean;
	isDetailError?: boolean;
	onRetry?: () => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open && character !== null}>
			<DialogContent
				className="p-0 gap-0 overflow-hidden sm:max-w-3xl"
				showCloseButton={false}
			>
				<DialogClose
					render={
						<Button
							aria-label="关闭角色信息"
							className="absolute top-2.5 right-2.5 z-20 bg-background/90 rounded-lg backdrop-blur-sm"
							size="icon-sm"
							variant="ghost"
						/>
					}
				>
					<X aria-hidden="true" className="size-4" />
				</DialogClose>
				{character && (
					<CharacterDialogBody
						character={character}
						info={info ?? null}
						isDetailError={isDetailError}
						isDetailLoading={isDetailLoading}
						onRetry={onRetry}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

/** 详情字段是否已有内容（列表接口没水合时用它决定骨架/重试提示） */
function hasDetailFields(view: CharacterView): boolean {
	return Boolean(
		view.gender ||
			view.birthday ||
			view.bloodType ||
			view.heightCm != null ||
			view.weightKg != null ||
			view.measurements ||
			view.intro ||
			view.traits?.length,
	);
}

function CharacterDialogBody({
	character,
	info,
	isDetailLoading,
	isDetailError,
	onRetry,
}: {
	character: CharacterView;
	info: CharacterInfoView | null;
	isDetailLoading: boolean;
	isDetailError: boolean;
	onRetry?: () => void;
}) {
	// 详情未到之前先用名册字段渲染，避免白屏；到了以后整份替换
	const view: CharacterView = info ?? character;
	// 记录「哪张图加载失败」，换角色时自动失效（不需要额外的重置 effect）
	const [failedId, setFailedId] = useState<string | null>(null);
	const placeholder = useThumbHashDataUrl(view.imageThumbhash);
	const imageUrl = failedId === view.id ? null : view.imageUrl;
	// 立绘画幅可能不是 3:4（kungal 头像是 250×300，无头像时回退全身 figure），
	// 弹窗按图片自身比例展示，避免把全身立绘裁成半身
	const portraitRatio = getImageRatio(view.imageWidth, view.imageHeight, 3 / 4);
	const initial = view.name.trim().slice(0, 1) || "?";
	const roleLabel = roleLabelOf(view.rosterRole);
	const spoilerLabel = spoilerLabelOf(view.spoiler);

	const rows: Array<{ label: string; value: string }> = [];
	const gender = formatGender(view.gender);
	if (gender) rows.push({ label: "性别", value: gender });
	const birthday = formatBirthday(view.birthday);
	if (birthday) rows.push({ label: "生日", value: birthday });
	const bloodType = formatBloodType(view.bloodType);
	if (bloodType) rows.push({ label: "血型", value: bloodType });
	if (view.heightCm != null) {
		rows.push({ label: "身高", value: `${view.heightCm} cm` });
	}
	if (view.weightKg != null) {
		rows.push({ label: "体重", value: `${view.weightKg} kg` });
	}
	const measurements = formatMeasurements(view.measurements);
	if (measurements) rows.push({ label: "三围", value: measurements });

	const appearances = info?.appearances ?? [];
	// 名册行缺资料字段：详情在路上的时候出骨架，失败的时候出重试
	const needsDetail = !info && !hasDetailFields(view);

	return (
		<div className="grid overflow-y-auto max-h-[85dvh] sm:max-h-[min(85vh,46rem)] sm:grid-cols-[15rem_minmax(0,1fr)]">
			{/* 左：立绘。移动端缩成小图居中，桌面端占满左栏 */}
			<div className="flex justify-center p-3 bg-muted/30 sm:justify-start sm:p-0">
				<div className="overflow-hidden relative w-32 bg-muted/40 rounded-xl ring-1 ring-border/60 sm:w-full sm:rounded-none sm:ring-0">
					<AspectRatio ratio={portraitRatio} className="overflow-hidden">
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
									alt={view.name}
									className="absolute inset-0 w-full h-full object-cover"
									decoding="async"
									height={view.imageHeight ?? FALLBACK_IMAGE_HEIGHT}
									onError={() => setFailedId(view.id)}
									src={imageUrl}
									width={view.imageWidth ?? FALLBACK_IMAGE_WIDTH}
								/>
							</>
						) : (
							<span
								aria-hidden="true"
								className="absolute inset-0 flex justify-center items-center text-4xl font-semibold select-none text-muted-foreground/60"
							>
								{initial}
							</span>
						)}
					</AspectRatio>
				</div>
			</div>

			<div className="flex flex-col gap-4 p-4 min-w-0 sm:p-5">
				<DialogHeader className="gap-1.5 pe-8">
					<div className="flex flex-wrap gap-1.5 items-center">
						<DialogTitle className="text-lg">{view.name}</DialogTitle>
						{roleLabel && (
							<Badge className="h-5 rounded-lg" variant="outline">
								{roleLabel}
							</Badge>
						)}
						{spoilerLabel && (
							<Badge
								className="h-5 rounded-lg text-destructive"
								variant="outline"
							>
								{spoilerLabel}
							</Badge>
						)}
					</div>
					{view.latin && (
						<DialogDescription className="text-xs">
							{view.latin}
						</DialogDescription>
					)}
				</DialogHeader>

				{rows.length > 0 && (
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
						{rows.map((row) => (
							<div className="contents" key={row.label}>
								<dt className="shrink-0 w-10 text-muted-foreground">
									{row.label}
								</dt>
								<dd className="min-w-0 break-words">{row.value}</dd>
							</div>
						))}
					</dl>
				)}

				{needsDetail && isDetailLoading && (
					<div aria-hidden className="flex flex-col gap-2">
						{["性别", "生日", "身高"].map((label) => (
							<div className="flex gap-4 items-center" key={label}>
								<span className="shrink-0 w-10 text-sm text-muted-foreground">
									{label}
								</span>
								<Skeleton className="w-16 h-4" />
							</div>
						))}
					</div>
				)}

				{isDetailError && (
					<div className="flex gap-2 items-center p-2 text-xs rounded-lg bg-destructive/5 ring-1 ring-destructive/20">
						<AlertTriangle
							aria-hidden="true"
							className="shrink-0 size-4 text-destructive"
						/>
						<span className="flex-1 min-w-0 text-muted-foreground">
							角色详情加载失败
						</span>
						{onRetry && (
							<Button onClick={onRetry} size="xs" variant="outline">
								<RefreshCw aria-hidden="true" />
								重试
							</Button>
						)}
					</div>
				)}

				{view.intro && (
					<section className="flex flex-col gap-1.5">
						<h3 className="text-xs font-medium tracking-wide text-muted-foreground">
							角色简介
						</h3>
						<p className="overflow-y-auto max-h-48 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
							{view.intro}
						</p>
					</section>
				)}

				{view.traits && view.traits.length > 0 && (
					<section className="flex flex-col gap-1.5">
						<h3 className="text-xs font-medium tracking-wide text-muted-foreground">
							属性
						</h3>
						<div className="flex flex-wrap gap-1.5">
							{view.traits.map((trait, index) => (
								<Badge
									className={cn(
										"h-6 rounded-lg bg-muted/40",
										trait.isSexual && "border-dashed text-muted-foreground",
									)}
									key={trait.id ?? `${trait.displayName ?? "trait"}-${index}`}
									title={trait.isSexual ? "含性相关属性" : undefined}
									variant="outline"
								>
									{trait.nameZh ?? trait.displayName ?? "未知属性"}
								</Badge>
							))}
						</div>
					</section>
				)}

				<section className="flex flex-col gap-1.5">
					<h3 className="text-xs font-medium tracking-wide text-muted-foreground">
						出演作品
					</h3>
					{isDetailLoading && !info ? (
						<div aria-hidden className="flex flex-col gap-1.5">
							<Skeleton className="w-2/3 h-4" />
							<Skeleton className="w-1/2 h-4" />
						</div>
					) : info ? (
						appearances.length > 0 ? (
							<ul className="flex flex-wrap gap-1.5">
								{appearances.map((appearance) => (
									<li className="min-w-0" key={appearance.displayId}>
										<Link
											className="inline-flex gap-1.5 items-center px-2 h-7 max-w-full text-xs rounded-lg bg-muted/40 ring-1 ring-border/60 transition-colors duration-200 hover:bg-muted/70 hover:text-foreground"
											params={{ id: appearance.displayId }}
											resetScroll={false}
											to="/:id"
										>
											<span className="truncate">{appearance.displayName}</span>
											{roleLabelOf(appearance.rosterRole) && (
												<span className="shrink-0 text-muted-foreground">
													{roleLabelOf(appearance.rosterRole)}
												</span>
											)}
										</Link>
									</li>
								))}
							</ul>
						) : (
							<p className="text-sm text-muted-foreground">暂无出演记录</p>
						)
					) : null}
				</section>
			</div>
		</div>
	);
}
