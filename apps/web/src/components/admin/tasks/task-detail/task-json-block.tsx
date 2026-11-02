import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { cn } from "@web/lib/utils";
import {
	BracesIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	CopyIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * 折叠的 JSON 块（详情抽屉的「结果 / 载荷」tab）。
 *
 * 任务的 payload / result 常常是几百 KB 的同步报告，整段铺开会把抽屉卡住
 * （浏览器要排版上万行）。策略：
 * - 短内容（≤ collapseAfter 字符）直接铺满；
 * - 长内容默认只露 max-h-48，点「展开全部」后到 max-h-96，仍可在块内滚动；
 * - 复制按钮永远复制完整原文，不受折叠影响。
 */

/** 超过该字符数即视为「长内容」，默认折叠。 */
const DEFAULT_COLLAPSE_AFTER = 1200;

function stringifyJson(value: unknown): string {
	if (value === null || value === undefined) return "";
	try {
		const text = JSON.stringify(value, null, 2);
		return typeof text === "string" ? text : String(value);
	} catch {
		return String(value);
	}
}

export type TaskJsonBlockProps = {
	/** 要展示的值（任意可 JSON 序列化的数据） */
	value: unknown;
	/** 块标题，默认「JSON」 */
	title?: string;
	/** 值为空时的文案 */
	emptyText?: string;
	/** 超过该字符数默认折叠 */
	collapseAfter?: number;
	className?: string;
};

export function TaskJsonBlock({
	value,
	title = "JSON",
	emptyText = "无数据",
	collapseAfter = DEFAULT_COLLAPSE_AFTER,
	className,
}: TaskJsonBlockProps) {
	const text = useMemo(() => stringifyJson(value), [value]);
	const [expanded, setExpanded] = useState(false);
	const [copied, setCopied] = useState(false);
	const isLong = text.length > collapseAfter;

	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), 1500);
		return () => window.clearTimeout(timer);
	}, [copied]);

	if (!text) {
		return (
			<p className={cn("text-xs text-muted-foreground", className)}>
				{emptyText}
			</p>
		);
	}

	const copyAll = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			toast.success("已复制");
		} catch {
			toast.error("复制失败，请手动选择文本");
		}
	};

	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<div className="flex gap-1.5 items-center">
				<BracesIcon className="size-3.5 shrink-0 text-muted-foreground" />
				<span className="text-xs font-medium">{title}</span>
				<Badge
					variant="secondary"
					className="h-4 px-1.5 text-[10px] tabular-nums"
				>
					{text.length.toLocaleString()} 字符
				</Badge>
				<Button
					variant="ghost"
					size="icon-xs"
					className="ml-auto text-muted-foreground"
					aria-label={copied ? "已复制" : "复制 JSON"}
					onClick={() => void copyAll()}
				>
					{copied ? (
						<CheckIcon className="size-3" />
					) : (
						<CopyIcon className="size-3" />
					)}
				</Button>
			</div>

			<pre
				className={cn(
					"overflow-auto p-2.5 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap bg-muted/50 rounded-xl ring-1 ring-border/40",
					isLong && !expanded ? "max-h-48" : "max-h-96",
				)}
			>
				{text}
			</pre>

			{isLong && (
				<Button
					variant="ghost"
					size="xs"
					className="self-center text-muted-foreground"
					onClick={() => setExpanded((value) => !value)}
				>
					{expanded ? (
						<ChevronUpIcon className="size-3" />
					) : (
						<ChevronDownIcon className="size-3" />
					)}
					{expanded ? "收起" : "展开全部"}
				</Button>
			)}
		</div>
	);
}
