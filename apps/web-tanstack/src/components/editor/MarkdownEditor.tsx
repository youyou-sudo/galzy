"use client";

import { Button } from "@web/components/ui/button";
import { ScrollArea } from "@web/components/ui/scroll-area";
import { Separator } from "@web/components/ui/separator";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@web/components/ui/tabs";
import { Textarea } from "@web/components/ui/textarea";
import { cn } from "@web/lib/utils";
import {
	Bold,
	Code,
	Columns2,
	Eye,
	Heading1,
	Heading2,
	Heading3,
	Italic,
	Link,
	List,
	ListOrdered,
	TextQuote,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

// ---------------------------------------------------------------------------
//  Props
// ---------------------------------------------------------------------------

export interface MarkdownEditorProps {
	/** 编辑器内容 */
	value: string;
	/** 内容变更回调 */
	onChange: (value: string) => void;
	/** 输入框占位文本 */
	placeholder?: string;
	/** 最小高度 (px, 默认 250) */
	minHeight?: number;
	/** 额外的键盘事件回调（Ctrl+Enter 等） */
	onKeyDown?: (e: React.KeyboardEvent) => void;
	/** 校验状态 */
	"aria-invalid"?: boolean | "true" | "false";
	/** 额外 class */
	className?: string;
}

// ---------------------------------------------------------------------------
//  Utility – 在光标/选区周围插入格式化标记
// ---------------------------------------------------------------------------

function insertAround(
	textarea: HTMLTextAreaElement,
	before: string,
	after: string,
	placeholder: string,
	value: string,
	onChange: (v: string) => void,
) {
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const selected = value.slice(start, end);

	const insertion = selected
		? `${before}${selected}${after}`
		: `${before}${placeholder}${after}`;
	const newValue = value.slice(0, start) + insertion + value.slice(end);

	onChange(newValue);

	// 在 React commit 后恢复光标位置
	requestAnimationFrame(() => {
		textarea.focus();
		if (selected) {
			textarea.setSelectionRange(
				start + before.length,
				start + before.length + selected.length,
			);
		} else {
			textarea.setSelectionRange(
				start + before.length,
				start + before.length + placeholder.length,
			);
		}
	});
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------

export function MarkdownEditor({
	value,
	onChange,
	placeholder,
	minHeight = 250,
	onKeyDown,
	"aria-invalid": ariaInvalid,
	className,
}: MarkdownEditorProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [mode, setMode] = useState<string>("source");

	// ---- 取 textarea DOM（仅 source / split 模式存在） ---------------------
	const getTextarea = () => textareaRef.current;

	// ---- 插入格式化（自动根据当前 mode 决定插入方式） -----------------------
	const withMode = useCallback(
		(before: string, after: string, placeholderText: string) => {
			if (mode === "visual") {
				// 可视化模式：统一追加到末尾
				const insertion = `${before}${placeholderText}${after}`;
				onChange(value ? `${value}\n\n${insertion}` : insertion);
				return;
			}
			// 源代码 / 分屏模式：在光标 / 选区处插入
			const ta = getTextarea();
			if (ta) insertAround(ta, before, after, placeholderText, value, onChange);
		},
		[value, onChange, mode],
	);

	const bold = useCallback(() => withMode("**", "**", "粗体文字"), [withMode]);
	const italic = useCallback(() => withMode("*", "*", "斜体文字"), [withMode]);
	const heading1 = useCallback(() => withMode("# ", "", "标题"), [withMode]);
	const heading2 = useCallback(() => withMode("## ", "", "标题"), [withMode]);
	const heading3 = useCallback(() => withMode("### ", "", "标题"), [withMode]);
	const unorderedList = useCallback(
		() => withMode("- ", "", "列表项"),
		[withMode],
	);
	const orderedList = useCallback(
		() => withMode("1. ", "", "列表项"),
		[withMode],
	);
	const blockquote = useCallback(
		() => withMode("> ", "", "引用内容"),
		[withMode],
	);
	const codeBlock = useCallback(
		() => withMode("```\n", "\n```", "代码"),
		[withMode],
	);
	const link = useCallback(
		() => withMode("[", "](url)", "链接文字"),
		[withMode],
	);

	// ---- 键盘快捷键（仅 source / split 模式有效） -------------------------
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const ctrl = e.ctrlKey || e.metaKey;
		if (ctrl && !e.shiftKey) {
			switch (e.key.toLowerCase()) {
				case "b":
					e.preventDefault();
					bold();
					return;
				case "i":
					e.preventDefault();
					italic();
					return;
				case "k":
					e.preventDefault();
					link();
					return;
			}
		}
		onKeyDown?.(e);
	};

	// ---- 共享的预览渲染函数（与 production 页面使用完全相同的组件） -----------
	const renderPreview = () =>
		value ? (
			<div className="overflow-x-auto">
				<Markdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
					{value}
				</Markdown>
			</div>
		) : (
			<p className="py-8 text-center text-sm text-muted-foreground">暂无内容</p>
		);

	// ---- render -----------------------------------------------------------

	return (
		<Tabs
			value={mode}
			onValueChange={setMode}
			className={cn(
				"w-full rounded-md border border-input overflow-hidden",
				className,
			)}
		>
			{/* ── 工具栏 ─────────────────────────────────────────────────────── */}
			<div className="flex items-center gap-0.5 px-1 py-1 border-b border-input bg-muted/30 overflow-x-auto flex-nowrap">
				<ToolbarButton icon={Bold} label="粗体 (Ctrl+B)" onClick={bold} />
				<ToolbarButton icon={Italic} label="斜体 (Ctrl+I)" onClick={italic} />

				<Separator orientation="vertical" className="mx-0.5 h-5" />

				<ToolbarButton icon={Heading1} label="标题 1" onClick={heading1} />
				<ToolbarButton icon={Heading2} label="标题 2" onClick={heading2} />
				<ToolbarButton icon={Heading3} label="标题 3" onClick={heading3} />

				<Separator orientation="vertical" className="mx-0.5 h-5" />

				<ToolbarButton icon={List} label="无序列表" onClick={unorderedList} />
				<ToolbarButton
					icon={ListOrdered}
					label="有序列表"
					onClick={orderedList}
				/>
				<ToolbarButton icon={TextQuote} label="引用" onClick={blockquote} />
				<ToolbarButton icon={Code} label="代码块" onClick={codeBlock} />
				<ToolbarButton icon={Link} label="链接 (Ctrl+K)" onClick={link} />

				{/* ── 视图切换 ── */}
				<div className="ml-auto">
					<TabsList className="h-7">
						<TabsTrigger value="source" className="gap-1 px-2 py-0.5 text-xs">
							<Code className="size-3" />
							源代码
						</TabsTrigger>
						<TabsTrigger value="visual" className="gap-1 px-2 py-0.5 text-xs">
							<Eye className="size-3" />
							可视化
						</TabsTrigger>
						<TabsTrigger value="split" className="gap-1 px-2 py-0.5 text-xs">
							<Columns2 className="size-3" />
							分屏
						</TabsTrigger>
					</TabsList>
				</div>
			</div>

			{/* ── 源代码编辑 ─────────────────────────────────────────────────── */}
			<TabsContent value="source" className="mt-0">
				<Textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					aria-invalid={ariaInvalid}
					className="min-h-62.5 resize-y rounded-none border-0 focus-visible:ring-0"
					style={{ minHeight }}
				/>
			</TabsContent>

			{/* ── 可视化编辑 ─────────────────────────────────────────────────── */}
			<TabsContent value="visual" className="mt-0">
				<ScrollArea className="p-4" style={{ minHeight }}>
					{renderPreview()}
				</ScrollArea>
			</TabsContent>

			{/* ── 分屏（左编辑 / 右预览） ────────────────────────────────────── */}
			<TabsContent value="split" className="mt-0">
				<div
					className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border"
					style={{ minHeight }}
				>
					<Textarea
						ref={textareaRef}
						value={value}
						onChange={(e) => onChange(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						aria-invalid={ariaInvalid}
						className="h-full min-h-62.5 resize-none rounded-none border-0 focus-visible:ring-0"
					/>
					<ScrollArea className="p-4">{renderPreview()}</ScrollArea>
				</div>
			</TabsContent>
		</Tabs>
	);
}

// ---------------------------------------------------------------------------
//  ToolbarButton – 小封装，避免重复的 Button + aria-label
// ---------------------------------------------------------------------------

function ToolbarButton({
	icon: Icon,
	label,
	onClick,
}: {
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	label: string;
	onClick: () => void;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			onClick={onClick}
			title={label}
			aria-label={label}
		>
			<Icon />
		</Button>
	);
}
