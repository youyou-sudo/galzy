import { Link } from "@tanstack/react-router";
import {
	TagTooltip,
	TagTooltipContent,
} from "@web/components/tags/tag-tooltip";
import { TooltipTrigger } from "@web/components/ui/tooltip";
import { cn } from "@web/lib/utils";
import { ChevronDown, MousePointerClick } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

export type FlowTag = {
	id: string;
	name?: string | null;
	zht_name?: string | null;
};

const tagLabel = (t: FlowTag) => t.zht_name || t.name || t.id;

const pill =
	"inline-flex h-5 items-center gap-0.5 rounded-4xl bg-muted px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground";

// 药丸之间的横向间距，与 mr-1.5 保持一致；测量第一行容量时要用到
const GAP = 6;

/**
 * 标签流：收起态只显示第一行，末尾跟一个「展开」；展开后显示全部，换成「收起」。
 *
 * 三个坑都要避开：
 *
 * 1. 不能靠 JS 测量后截断。首屏必须已经是收起态，否则用户会看到先展开再抖一下。
 *    这里的做法是：SSR 先渲染全部标签 + 按钮，用 `max-h-6 overflow-hidden` 把
 *    第二行及以后裁掉；useLayoutEffect 在浏览器绘制前测出第一行容量并截断。
 *    因为 state 更新发生在 paint 前，用户看不到中间态，也就没有抖动。
 *
 * 2. 「展开」按钮要和标签同一条 inline 流（用户要求：排版与前面的标签一样）。
 *    但按钮若排在全部标签之后，它会被 max-h-6 裁掉 —— DOM 里有、看不见。
 *    所以要把按钮的宽度计入第一行容量：只渲染「标签 + 按钮能同排」的那些标签，
 *    按钮作为流末尾的普通药丸，既紧贴最后一个标签，又永远不会被裁掉。
 *
 * 3. 展开态用「普通块 + 行内药丸」而不是 flex-wrap：块级 flex 容器会建立独立
 *    格式化上下文，其边框盒必须整体避开浮动封面（游戏详情页封面是
 *    sm:float-right），于是封面下方的每一行也被统一收窄到图片左侧。
 *    行内盒则会被浮动逐行缩短，这才是真正的「环绕图片」。
 *
 * 4. 容量必须基于「全量渲染」的 DOM 测量。收起态会按上次测出的容量截断，
 *    被截掉的标签不在 DOM 里、量不到宽度，于是容量只降不升：切换标签页时若
 *    上一页只放得下两三个，新页面就会一直只显示那两三个。所以 tags 内容或
 *    行宽变化时一律让旧容量作废重测（见下方的 measurement 与宽度观察）。
 */
export function CollapsibleTagList({
	className,
	label,
	tags,
	preload,
}: {
	className?: string;
	label?: string;
	tags: FlowTag[];
	preload?: false | "intent" | "viewport" | "render";
}) {
	const [expanded, setExpanded] = useState(false);
	// 已完成的第一行容量测量。sig 标记它对应哪一批标签；行宽变化时整体置空重测。
	// null / sig 不匹配 = 尚未测量 → 先全量渲染，再由 layout effect 裁决。
	const [measurement, setMeasurement] = useState<{
		sig: string;
		count: number;
	} | null>(null);
	const rowWidthRef = useRef(0);
	const rowRef = useRef<HTMLDivElement>(null);
	const btnRef = useRef<HTMLButtonElement>(null);

	// 标签内容指纹：父组件每次都新建数组，用引用比对会误判，这里按内容判断。
	const tagSig = tags
		.map((t) => `${t.id}\u0002${t.zht_name ?? t.name ?? ""}`)
		.join("\u0001");
	const fitCount =
		measurement && measurement.sig === tagSig ? measurement.count : null;

	// 行宽变化（响应式断点、侧栏开合）会让旧容量作废，回到全量渲染重新测量。
	useLayoutEffect(() => {
		if (expanded) return;
		const row = rowRef.current;
		if (!row) return;

		const check = () => {
			const width = row.clientWidth;
			if (width === 0 || width === rowWidthRef.current) return;
			rowWidthRef.current = width;
			setMeasurement(null);
		};

		check();
		const ro = new ResizeObserver(check);
		ro.observe(row);
		return () => ro.disconnect();
	}, [expanded]);

	// 只在「尚未测量」（fitCount === null，此刻 DOM 是全量渲染）时量第一行容量。
	useLayoutEffect(() => {
		if (expanded || fitCount !== null) return;
		const row = rowRef.current;
		const btn = btnRef.current;
		if (!row || !btn) return;

		const limit = row.clientWidth;
		// 容器尚未布局（例如父级还在隐藏），先不裁决
		if (limit === 0) return;

		const btnOuter = btn.offsetWidth + GAP;
		let used = 0;
		let count = 0;
		for (const child of row.children) {
			if (child === btn) break;
			const el = child as HTMLElement;
			const outer = el.offsetWidth + GAP;
			// 末尾按钮必须也能落在第一行，否则它会被 max-h-6 裁掉
			if (used + outer + btnOuter > limit) break;
			used += outer;
			count++;
		}
		rowWidthRef.current = limit;
		setMeasurement({ sig: tagSig, count });
	}, [expanded, fitCount, tagSig]);

	// 展开态显示全部；收起态才按第一行容量截断（fitCount === null 时先全量渲染，
	// 交给 CSS max-h-6 裁剪兜住首屏，useLayoutEffect 在 paint 前完成测量）。
	// 全部标签 + 按钮都放得下时，按钮无意义，隐藏但保留占位以免布局跳动。
	const shown = expanded || fitCount === null ? tags : tags.slice(0, fitCount);
	const overflows = fitCount !== null && fitCount < tags.length;

	const toggle = expanded ? (
		<button
			type="button"
			onClick={() => setExpanded(false)}
			aria-expanded={expanded}
			className={cn(pill, "mr-1.5 mb-1.5 cursor-pointer")}
		>
			<MousePointerClick className="size-3" />
			收起
			<ChevronDown className="size-3 rotate-180 transition-transform" />
		</button>
	) : (
		<button
			type="button"
			ref={btnRef}
			onClick={() => setExpanded(true)}
			aria-expanded={expanded}
			aria-hidden={!overflows}
			tabIndex={overflows ? 0 : -1}
			className={cn(
				pill,
				"mr-1.5 mb-1.5 cursor-pointer",
				!overflows && "pointer-events-none invisible",
			)}
		>
			<MousePointerClick className="size-3" />
			展开
			<ChevronDown className="size-3 transition-transform" />
		</button>
	);

	return (
		<div className={className}>
			{label !== undefined && (
				<div className="mb-2 flex items-baseline gap-1.5">
					<span className="text-xs text-muted-foreground">{label}</span>
					<span className="text-xs tabular-nums text-muted-foreground">
						{tags.length}
					</span>
				</div>
			)}
			<div
				ref={rowRef}
				className={cn(
					"leading-5",
					// 收起态靠 max-height 兜住首屏；展开态要完整显示，不裁剪
					!expanded && "max-h-6 overflow-hidden",
				)}
			>
				{shown.map((t) => (
					<TagTooltip key={t.id}>
						<TooltipTrigger
							render={
								<Link
									to="/tags/$tagId"
									params={{ tagId: t.id }}
									preload={preload}
									className={cn(pill, "mr-1.5 mb-1.5 max-w-full")}
								>
									<span className="truncate">#{tagLabel(t)}</span>
								</Link>
							}
						/>
						<TagTooltipContent>{tagLabel(t)}</TagTooltipContent>
					</TagTooltip>
				))}
				{toggle}
			</div>
		</div>
	);
}
