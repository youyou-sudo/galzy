import { cn } from "@web/lib/utils";
import { ArrowRight, Check, ChevronDown, Flag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	characterNameOf,
	type WalkthroughCharacter,
} from "../types";
import {
	endingTypeBadgeLabel,
	nodeLabel,
	resolveText,
	segmentOptionCount,
	stepNumbers,
} from "./chart-utils";
import { Badge, StepRow } from "./step-row";
import type { ChartLang, ChartSegment, WalkthroughChart } from "./types";

export interface OrderViewProps {
	chart: WalkthroughChart;
	/** 双语三档，默认 both（中文主文 + 括注原文） */
	lang?: ChartLang;
	/** chart 里 key → 角色的展示名（副标题里的角色标签） */
	characters?: WalkthroughCharacter[];
	/** 进度写进 localStorage 的键（攻略 id）；不传就不显示勾选与进度条 */
	storageKey?: string;
	className?: string;
}

/** 进度只存本地：攻略是别人写的，完成度属于「这台设备上的读者」 */
const STORAGE_PREFIX = "galzy:walkthrough-progress:";

/** 角色配色：按角色在 chart 里的出现顺序取色，和角色路线卡的点色同一套 */
const DOT_TONES = [
	"bg-sky-500",
	"bg-pink-500",
	"bg-emerald-500",
	"bg-amber-500",
	"bg-rose-500",
	"bg-teal-500",
	"bg-violet-500",
	"bg-orange-500",
];

/**
 * 「按顺序」视图：**可勾选进度的折叠清单**。
 *
 * 参考站的这一页不是长文，而是把整份攻略按源文顺序拍平成 1..N 段：
 * 每行 = 段序号 + 起点 → 终点 + 角色标签 + 选项数，展开才看段内步骤；
 * 顶部一条进度（勾选后本地保存）。好处是一条 26 段的路线也能一屏扫完，
 * 想细看哪段再展开，不必滚一整篇长文。
 *
 * 与「按角色」的区别：这里**不按角色过滤**（参考站同样如此，URL 里带
 * character=c1 也照常列全 15 段）——顺序是整份攻略的阅读顺序。
 */
export function OrderView({
	chart,
	lang = "both",
	characters = [],
	storageKey,
	className,
}: OrderViewProps) {
	const segments = chart.segments ?? [];
	const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
	const [doneKeys, setDoneKeys] = useState<Set<string>>(() => new Set());

	// 进度在挂载后才读：SSR 首帧渲染「0/N」，水合后补上真实值，不会闪烁出错误状态
	useEffect(() => {
		if (!storageKey || typeof window === "undefined") return;
		try {
			const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
			if (raw) setDoneKeys(new Set(JSON.parse(raw) as string[]));
		} catch {
			// 存坏了就当没有进度：阅读器级别的小功能不值得把页面打崩
		}
	}, [storageKey]);

	const persist = useCallback(
		(next: Set<string>) => {
			if (!storageKey || typeof window === "undefined") return;
			try {
				window.localStorage.setItem(
					STORAGE_PREFIX + storageKey,
					JSON.stringify([...next]),
				);
			} catch {
				// 隐私模式下 setItem 可能直接抛
			}
		},
		[storageKey],
	);

	const toggleDone = (key: string) => {
		setDoneKeys((previous) => {
			const next = new Set(previous);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			persist(next);
			return next;
		});
	};

	const toggleOpen = (key: string) => {
		setOpenKeys((previous) => {
			const next = new Set(previous);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	// 角色 key → 展示名 / 点色（点色按 chart 里的出现顺序取，稳定不随过滤变化）
	const characterOrder = useMemo(() => {
		const keys: string[] = characters.map((item) => item.key);
		for (const section of chart.sections ?? []) {
			for (const key of section.character_keys) {
				if (!keys.includes(key)) keys.push(key);
			}
		}
		return keys;
	}, [characters, chart.sections]);

	const nameByKey = useMemo(
		() =>
			new Map(characters.map((item) => [item.key, characterNameOf(item)])),
		[characters],
	);

	const sectionByKey = useMemo(
		() => new Map((chart.sections ?? []).map((section) => [section.key, section])),
		[chart.sections],
	);

	if (segments.length === 0) {
		const emptyText =
			(chart.segments ?? []).length === 0
				? "这份攻略还没有选项数据"
				: "这条路线还没有选项数据";
		return (
			<div
				className={cn(
					"rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground text-sm",
					className,
				)}
			>
				{emptyText}
			</div>
		);
	}

	const doneCount = segments.filter((segment) => doneKeys.has(segment.key)).length;
	const percent = Math.round((doneCount / segments.length) * 100);

	/** 一段属于哪个角色：终点是结局就看结局，否则看所属 section */
	const characterKeyOf = (segment: ChartSegment): string | null => {
		if (segment.to_node.node_type === "ending") {
			const ending = (chart.endings ?? []).find(
				(item) => item.key === segment.to_node.key,
			);
			if (ending?.character_keys.length) return ending.character_keys[0] ?? null;
		}
		const section = segment.section_key
			? sectionByKey.get(segment.section_key)
			: null;
		return section?.character_keys[0] ?? null;
	};

	const characterLabelOf = (segment: ChartSegment): string | null => {
		const key = characterKeyOf(segment);
		if (key) {
			const name = nameByKey.get(key);
			if (name) return name;
		}
		const section = segment.section_key
			? sectionByKey.get(segment.section_key)
			: null;
		return section ? resolveText(section.title, section.localized, lang).primary : null;
	};

	const dotOf = (segment: ChartSegment): string => {
		const key = characterKeyOf(segment);
		const index = key ? characterOrder.indexOf(key) : -1;
		return index < 0 ? "bg-muted-foreground/50" : DOT_TONES[index % DOT_TONES.length] as string;
	};

	return (
		<div className={cn("space-y-3", className)}>
			{/* 进度：参考站顶部那一条 */}
			<div className="space-y-1.5">
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
					<span>
						按攻略的顺序依次游玩，完成一段后勾选，进度只保存在这台设备的浏览器里
					</span>
					<span className="ml-auto shrink-0 tabular-nums">
						已完成 {doneCount} / {segments.length} 段
					</span>
				</div>
				<div
					aria-hidden
					className="h-1.5 overflow-hidden rounded-full bg-muted"
					role="presentation"
				>
					<div
						className="h-full rounded-full bg-primary/70 transition-[width] duration-300"
						style={{ width: `${percent}%` }}
					/>
				</div>
			</div>

			<ol className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
				{segments.map((segment, index) => {
					const done = doneKeys.has(segment.key);
					const open = openKeys.has(segment.key);
					const from = nodeLabel(chart, segment.from_node, lang).primary;
					const to = nodeLabel(chart, segment.to_node, lang).primary;
					const options = segmentOptionCount(segment);
					const character = characterLabelOf(segment);
					const steps = segment.steps ?? [];
					const numbers = stepNumbers(steps);
					const condition = resolveText(
						segment.condition,
						segment.condition_localized,
						lang,
					);
					const requires = (segment.requires_ending_keys ?? [])
						.map(
							(key) =>
								(chart.endings ?? []).find((ending) => ending.key === key)
									?.name ?? key,
						)
						.filter(Boolean);
					const ending =
						segment.to_node.node_type === "ending"
							? ((chart.endings ?? []).find(
									(item) => item.key === segment.to_node.key,
								) ?? null)
							: null;
					const endingBadge = ending
						? endingTypeBadgeLabel(ending.ending_type)
						: null;

					return (
						<li
							className="scroll-mt-24"
							data-order-segment={segment.key}
							id={`wt-seg-${segment.key}`}
							key={segment.key}
						>
							<div className="flex items-start gap-2.5 px-3 py-2.5">
								<button
									aria-label={done ? "标记为未完成" : "标记为已完成"}
									aria-pressed={done}
									className={cn(
										"mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-medium text-xs tabular-nums transition-colors",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
										done
											? "bg-primary/15 text-primary"
											: "bg-muted text-muted-foreground hover:bg-muted/70",
									)}
									onClick={() => toggleDone(segment.key)}
									type="button"
								>
									{done ? <Check aria-hidden className="size-3.5" /> : index + 1}
								</button>

								<button
									aria-expanded={open}
									className="min-w-0 flex-1 text-left"
									onClick={() => toggleOpen(segment.key)}
									type="button"
								>
									<span className="flex min-w-0 items-center gap-1.5 text-sm">
										<span className="truncate text-muted-foreground">
											{from}
										</span>
										<ArrowRight
											aria-hidden
											className="size-3.5 shrink-0 text-muted-foreground/70"
										/>
										<span
											className={cn(
												"truncate font-medium",
												done && "text-muted-foreground line-through",
											)}
										>
											{to}
										</span>
									</span>
									<span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
										<span className="flex items-center gap-1.5">
											<span
												aria-hidden
												className={cn("size-1.5 rounded-full", dotOf(segment))}
											/>
											{character ?? "全线"}
										</span>
										<span aria-hidden className="text-border">
											·
										</span>
										<span className="tabular-nums">{options} 个选项</span>
										{requires.length > 0 ? (
											<>
												<span aria-hidden className="text-border">
													·
												</span>
												<span className="text-amber-700 dark:text-amber-300">
													有前置条件
												</span>
											</>
										) : null}
									</span>
								</button>

								<button
									aria-expanded={open}
									aria-label={open ? "收起这一段" : "展开这一段"}
									className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
									onClick={() => toggleOpen(segment.key)}
									type="button"
								>
									<ChevronDown
										aria-hidden
										className={cn(
											"size-4 transition-transform duration-200",
											open && "rotate-180",
										)}
									/>
								</button>
							</div>

							{open ? (
								<div className="space-y-2 border-border/60 border-t px-3 pt-3 pb-4 pl-11">
									{condition.primary || requires.length > 0 ? (
										<div className="space-y-0.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs leading-5">
											{condition.primary ? (
												<p className="text-muted-foreground">
													{condition.primary}
												</p>
											) : null}
											{requires.length > 0 ? (
												<p className="text-amber-700 dark:text-amber-300">
													需先达成：{requires.join("、")}
												</p>
											) : null}
										</div>
									) : null}

									<div className="space-y-1.5">
										{steps.map((step, stepIndex) => (
											<StepRow
												chart={chart}
												key={stepIndex}
												lang={lang}
												number={numbers[stepIndex] ?? null}
												step={step}
											/>
										))}
									</div>

									{ending ? (
										<p className="flex flex-wrap items-center gap-1.5 pt-1 text-sm">
											<Flag
												aria-hidden
												className="size-3.5 shrink-0 text-muted-foreground"
											/>
											<span className="font-medium">{ending.name}</span>
											{endingBadge ? <Badge>{endingBadge}</Badge> : null}
										</p>
									) : segment.to_node.node_type === "collect" ? (
										<p className="pt-1 text-muted-foreground text-sm">
											回收 CG / 场景后结束
										</p>
									) : null}
								</div>
							) : null}
						</li>
					);
				})}
			</ol>
		</div>
	);
}