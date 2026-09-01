"use client";

import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@web/lib/utils";
import {
	Bold,
	Code,
	Code2,
	Heading1,
	Heading2,
	Heading3,
	Image as ImageIcon,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
	Minus,
	Redo2,
	Strikethrough,
	TextQuote,
	Underline as UnderlineIcon,
	Undo2,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

// ---------------------------------------------------------------------------
//  Props
// ---------------------------------------------------------------------------

export interface RichTextEditorProps {
	/** 内容（HTML 字符串） */
	value: string;
	/** 内容变更回调（HTML） */
	onChange: (value: string) => void;
	/** 占位文本 */
	placeholder?: string;
	/** 最小高度 (px, 默认 300) */
	minHeight?: number;
	/** 额外的键盘事件回调（Ctrl+Enter 等） */
	onKeyDown?: (e: React.KeyboardEvent) => void;
	/** 校验状态 */
	"aria-invalid"?: boolean | "true" | "false";
	/** 额外 class */
	className?: string;
}

// ---------------------------------------------------------------------------
//  图片上传 —— 走同源代理路由，转发到 API /media/uploadimage
// ---------------------------------------------------------------------------

async function uploadImage(file: File): Promise<string> {
	const formData = new FormData();
	formData.append("image", file);
	const res = await fetch("/api/upload-image", {
		method: "POST",
		body: formData,
	});
	if (!res.ok) {
		throw new Error(`上传失败 (${res.status})`);
	}
	const data = (await res.json()) as { url?: string };
	if (!data.url) throw new Error("上传失败：未返回图片地址");
	return data.url;
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------

export function RichTextEditor({
	value,
	onChange,
	placeholder,
	minHeight = 300,
	onKeyDown,
	"aria-invalid": ariaInvalid,
	className,
}: RichTextEditorProps) {
	const lastEmitted = useRef(value);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const uploadLock = useRef(false);

	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
				link: { openOnClick: false },
			}),
			Image.configure({
				allowBase64: false,
				HTMLAttributes: { class: "rounded-md max-w-full h-auto" },
			}),
			Placeholder.configure({ placeholder }),
		],
		content: value,
		editorProps: {
			attributes: {
				class: "prose prose-sm sm:prose-base dark:prose-invert focus:outline-none max-w-none px-4 py-3",
			},
			handlePaste: (_view, event) => {
				const files = Array.from(event.clipboardData?.files ?? []);
				const img = files.find((f) => f.type.startsWith("image/"));
				if (img) {
					event.preventDefault();
					void insertImageFile(img);
					return true;
				}
				return false;
			},
			handleDrop: (_view, event) => {
				const files = Array.from(event.dataTransfer?.files ?? []);
				const img = files.find((f) => f.type.startsWith("image/"));
				if (img) {
					event.preventDefault();
					void insertImageFile(img);
					return true;
				}
				return false;
			},
		},
		onUpdate: ({ editor: ed }) => {
			const html = ed.getHTML();
			lastEmitted.current = html;
			onChange(html);
		},
	});

	// 外部 value 变化（如表单 reset / 编辑加载数据）时同步进编辑器。
	// 用户正在输入时 lastEmitted 会实时跟随，不会误覆盖光标。
	useEffect(() => {
		if (!editor) return;
		if (value !== lastEmitted.current) {
			lastEmitted.current = value;
			editor.commands.setContent(value, { emitUpdate: false });
		}
	}, [value, editor]);

	async function insertImageFile(file: File) {
		if (uploadLock.current) return;
		uploadLock.current = true;
		try {
			const url = await uploadImage(file);
			editor?.chain().focus().setImage({ src: url }).run();
		} catch (e) {
			console.error("[rich-editor] 图片上传失败:", e);
		} finally {
			uploadLock.current = false;
		}
	}

	const setLink = () => {
		if (!editor) return;
		const previous = editor.getAttributes("link").href as string | undefined;
		const url = window.prompt("输入链接地址：", previous ?? "https://");
		if (url === null) return;
		if (url === "") {
			editor.chain().focus().extendMarkRange("link").unsetLink().run();
			return;
		}
		editor
			.chain()
			.focus()
			.extendMarkRange("link")
			.setLink({ href: url, target: "_blank", rel: "noopener noreferrer" })
			.run();
	};

	return (
		<div
			className={cn(
				"w-full rounded-md border border-input overflow-hidden bg-background",
				ariaInvalid === true && "border-destructive",
				className,
			)}
		>
			{/* ── 工具栏 ─────────────────────────────────────────────────────── */}
			{editor && (
				<Toolbar
					editor={editor}
					onImage={() => fileInputRef.current?.click()}
					onLink={setLink}
				/>
			)}

			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) void insertImageFile(file);
					e.target.value = "";
				}}
			/>

			{/* ── 编辑区 ─────────────────────────────────────────────────────── */}
			<div
				className="overflow-y-auto"
				style={{ minHeight }}
				onKeyDown={onKeyDown}
			>
				<EditorContent editor={editor} />
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
//  Toolbar
// ---------------------------------------------------------------------------

function Toolbar({
	editor,
	onImage,
	onLink,
}: {
	editor: Editor;
	onImage: () => void;
	onLink: () => void;
}) {
	const btn = (active: boolean) =>
		cn(
			"inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
			active
				? "bg-accent text-accent-foreground"
				: "hover:bg-accent/50 hover:text-foreground",
		);

	return (
		<div className="flex items-center gap-0.5 flex-wrap px-1 py-1 border-b border-input bg-muted/30">
			<ToolbarButton
				className={btn(editor.isActive("bold"))}
				onClick={() => run(editor, (c) => c.toggleBold())}
				title="粗体 (Ctrl+B)"
			>
				<Bold className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(editor.isActive("italic"))}
				onClick={() => run(editor, (c) => c.toggleItalic())}
				title="斜体 (Ctrl+I)"
			>
				<Italic className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(editor.isActive("underline"))}
				onClick={() => run(editor, (c) => c.toggleUnderline())}
				title="下划线 (Ctrl+U)"
			>
				<UnderlineIcon className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(editor.isActive("strike"))}
				onClick={() => run(editor, (c) => c.toggleStrike())}
				title="删除线"
			>
				<Strikethrough className="size-4" />
			</ToolbarButton>

			<Separator orientation="vertical" className="mx-1 h-5" />

			<ToolbarButton
				className={btn(editor.isActive("heading", { level: 1 }))}
				onClick={() => run(editor, (c) => c.toggleHeading({ level: 1 }))}
				title="标题 1"
			>
				<Heading1 className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(editor.isActive("heading", { level: 2 }))}
				onClick={() => run(editor, (c) => c.toggleHeading({ level: 2 }))}
				title="标题 2"
			>
				<Heading2 className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(editor.isActive("heading", { level: 3 }))}
				onClick={() => run(editor, (c) => c.toggleHeading({ level: 3 }))}
				title="标题 3"
			>
				<Heading3 className="size-4" />
			</ToolbarButton>

			<Separator orientation="vertical" className="mx-1 h-5" />

			<ToolbarButton
				className={btn(editor.isActive("bulletList"))}
				onClick={() => run(editor, (c) => c.toggleBulletList())}
				title="无序列表"
			>
				<List className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(editor.isActive("orderedList"))}
				onClick={() => run(editor, (c) => c.toggleOrderedList())}
				title="有序列表"
			>
				<ListOrdered className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(editor.isActive("blockquote"))}
				onClick={() => run(editor, (c) => c.toggleBlockquote())}
				title="引用"
			>
				<TextQuote className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(editor.isActive("codeBlock"))}
				onClick={() => run(editor, (c) => c.toggleCodeBlock())}
				title="代码块"
			>
				<Code2 className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(editor.isActive("code"))}
				onClick={() => run(editor, (c) => c.toggleCode())}
				title="行内代码"
			>
				<Code className="size-4" />
			</ToolbarButton>

			<Separator orientation="vertical" className="mx-1 h-5" />

			<ToolbarButton
				className={btn(editor.isActive("link"))}
				onClick={onLink}
				title="链接 (Ctrl+K)"
			>
				<LinkIcon className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(false)}
				onClick={onImage}
				title="插入图片"
			>
				<ImageIcon className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(false)}
				onClick={() => run(editor, (c) => c.setHorizontalRule())}
				title="分隔线"
			>
				<Minus className="size-4" />
			</ToolbarButton>

			<Separator orientation="vertical" className="mx-1 h-5" />

			<ToolbarButton
				className={btn(false)}
				onClick={() => run(editor, (c) => c.undo())}
				title="撤销"
			>
				<Undo2 className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				className={btn(false)}
				onClick={() => run(editor, (c) => c.redo())}
				title="重做"
			>
				<Redo2 className="size-4" />
			</ToolbarButton>
		</div>
	);
}

function run(
	editor: Editor,
	fn: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>,
) {
	fn(editor.chain().focus()).run();
}

function ToolbarButton({
	className,
	onClick,
	title,
	children,
}: {
	className?: string;
	onClick: () => void;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			className={cn(className, "h-7 w-7")}
			onClick={onClick}
			title={title}
			aria-label={title}
		>
			{children}
		</Button>
	);
}
