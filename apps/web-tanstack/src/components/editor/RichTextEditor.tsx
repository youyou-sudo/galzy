"use client";

import { RichTextProvider } from "reactjs-tiptap-editor";
import "reactjs-tiptap-editor/style.css";
import { EditorContent, useEditor } from "@tiptap/react";
import { renderHtmlContent } from "@web/lib/rich-content-render";
import { cn } from "@web/lib/utils";
import { Loader2 } from "lucide-react";
import {
	type CSSProperties,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { RichTextBlockquote } from "reactjs-tiptap-editor/blockquote";
import { RichTextBold } from "reactjs-tiptap-editor/bold";
import {
	RichTextBubbleCodeBlock,
	RichTextBubbleImage,
	RichTextBubbleLink,
	RichTextBubbleText,
} from "reactjs-tiptap-editor/bubble";
import { RichTextBulletList } from "reactjs-tiptap-editor/bulletlist";
import { RichTextClear } from "reactjs-tiptap-editor/clear";
import { RichTextCode } from "reactjs-tiptap-editor/code";
import { RichTextCodeBlock } from "reactjs-tiptap-editor/codeblock";
import { RichTextHeading } from "reactjs-tiptap-editor/heading";
import { RichTextRedo, RichTextUndo } from "reactjs-tiptap-editor/history";
import { RichTextHorizontalRule } from "reactjs-tiptap-editor/horizontalrule";
import { RichTextImage } from "reactjs-tiptap-editor/image";
import { RichTextItalic } from "reactjs-tiptap-editor/italic";
import { RichTextLink } from "reactjs-tiptap-editor/link";
import { localeActions, useLocale } from "reactjs-tiptap-editor/locale-bundle";
import { RichTextOrderedList } from "reactjs-tiptap-editor/orderedlist";
import {
	renderCommandListDefault,
	SlashCommandList,
} from "reactjs-tiptap-editor/slashcommand";
import { RichTextStrike } from "reactjs-tiptap-editor/strike";
import { RichTextUnderline } from "reactjs-tiptap-editor/textunderline";
import { themeActions } from "reactjs-tiptap-editor/theme";
import { toast } from "sonner";
import { Progress } from "../ui/progress";
import { Separator } from "../ui/separator";
import { createRichTextExtensions } from "./extensions";

// 编辑器 UI 文案使用中文
localeActions.setLang("zh_CN");

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

/** XHR 上传图片并回调进度（走同源代理路由，转发到 API /media/uploadimage） */
function uploadImage(
	file: File,
	onProgress?: (pct: number) => void,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", "/api/upload-image");
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable && onProgress)
				onProgress(Math.round((e.loaded / e.total) * 100));
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const data = JSON.parse(xhr.responseText) as { url?: string };
					if (data.url) resolve(data.url);
					else reject(new Error("未返回图片地址"));
				} catch {
					reject(new Error("响应解析失败"));
				}
			} else {
				reject(new Error(`上传失败 (${xhr.status})`));
			}
		};
		xhr.onerror = () => reject(new Error("网络错误，请重试"));
		const formData = new FormData();
		formData.append("image", file);
		xhr.send(formData);
	});
}

/** Slash 命令菜单中只保留本项目启用的扩展对应的命令 */
const SLASH_COMMANDS = new Set([
	"headingParagraph",
	"heading1",
	"heading2",
	"heading3",
	"bulletList",
	"orderedlist",
	"blockquote",
	"codeBlock",
	"image",
	"horizontalRule",
]);

function SlashList() {
	const { t } = useLocale();
	const commandList = useMemo(() => {
		const lists = renderCommandListDefault({ t });
		return lists
			.map((l) => ({
				...l,
				commands: l.commands.filter((c) => SLASH_COMMANDS.has(c.name)),
			}))
			.filter((l) => l.commands.length > 0);
	}, [t]);
	return <SlashCommandList commandList={commandList} />;
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
	const uploadLock = useRef(false);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [isDark, setIsDark] = useState(false);

	// 跟随站点明暗主题（html.dark class），同步编辑器自身主题
	useEffect(() => {
		const el = document.documentElement;
		const apply = () => {
			const dark = el.classList.contains("dark");
			setIsDark(dark);
			themeActions.setTheme(dark ? "dark" : "light");
		};
		apply();
		const observer = new MutationObserver(apply);
		observer.observe(el, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);

	const editor = useEditor({
		immediatelyRender: false,
		extensions: createRichTextExtensions({
			placeholder,
			imageUpload: (file) => uploadImage(file),
			imageOnError: ({ type, message }) => {
				toast.error(type === "upload" ? "图片上传失败" : "图片无效", {
					description: message,
				});
			},
		}),
		content: value,
		editorProps: {
			attributes: {
				class:
					"galzy-prose prose prose-sm sm:prose-base dark:prose-invert focus:outline-none max-w-none",
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

	// 挂载前/SSR 占位用的静态渲染内容（与编辑器同构）
	const staticHtml = useMemo(
		() => (value ? renderHtmlContent(value) : ""),
		[value],
	);

	async function insertImageFile(file: File) {
		if (uploadLock.current) {
			toast.info("已有图片正在上传，请稍候");
			return;
		}
		uploadLock.current = true;
		setIsUploading(true);
		setUploadProgress(0);
		try {
			const url = await uploadImage(file, setUploadProgress);
			editor?.chain().focus().setImageBlock({ src: url }).run();
			setUploadProgress(100);
		} catch (e) {
			console.error("[rich-editor] 图片上传失败:", e);
			toast.error("图片上传失败", {
				description: e instanceof Error ? e.message : "请重试",
			});
		} finally {
			uploadLock.current = false;
			setIsUploading(false);
		}
	}

	return (
		<div
			className={cn(
				"w-full rounded-md border border-input overflow-hidden bg-background",
				ariaInvalid === true && "border-destructive",
				className,
			)}
		>
			{editor ? (
				<RichTextProvider editor={editor} dark={isDark}>
					<Toolbar />

					<SlashList />
					<RichTextBubbleText />
					<RichTextBubbleLink />
					<RichTextBubbleImage />
					<RichTextBubbleCodeBlock />

					{/* ── 编辑区 ─────────────────────────────────────────────────── */}
					<div
						className="flex overflow-y-auto"
						style={
							{
								minHeight,
								"--galzy-editor-min-height": `${minHeight}px`,
							} as CSSProperties
						}
						onKeyDown={onKeyDown}
					>
						<EditorContent editor={editor} className="min-h-full flex-1" />
					</div>
				</RichTextProvider>
			) : (
				/* ── SSR / 挂载前占位 ────────────────────────────────────────────
				   编辑器实例需客户端创建（immediatelyRender: false），首屏先用静态
				   渲染器输出内容（与编辑器同构），挂载后无缝切换，避免空白等待。 */
				<EditorFallback
					html={staticHtml}
					placeholder={placeholder}
					minHeight={minHeight}
				/>
			)}

			{/* ── 粘贴/拖拽图片上传指示 ──────────────────────────────────────── */}
			{isUploading && (
				<div className="flex items-center gap-2 border-t border-input px-4 py-1.5">
					<Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
					<Progress value={uploadProgress} className="h-1.5 flex-1" />
					<span className="shrink-0 text-xs text-muted-foreground">
						上传中 {uploadProgress}%
					</span>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
//  SSR 占位
// ---------------------------------------------------------------------------

function EditorFallback({
	html,
	placeholder,
	minHeight,
}: {
	html: string;
	placeholder?: string;
	minHeight: number;
}) {
	return (
		<div
			className="flex flex-col"
			style={
				{
					minHeight,
					"--galzy-editor-min-height": `${minHeight}px`,
				} as CSSProperties
			}
		>
			<div
				className="galzy-prose prose prose-sm sm:prose-base dark:prose-invert focus:outline-none max-w-none w-full"
				style={{ minHeight: `${minHeight}px` }}
			>
				{html ? (
					<div dangerouslySetInnerHTML={{ __html: html }} />
				) : (
					<p className="text-muted-foreground select-none">
						{placeholder || "编辑器加载中…"}
					</p>
				)}
			</div>
			<div className="mt-auto flex items-center gap-2 border-t border-input px-4 py-1.5 text-xs text-muted-foreground">
				<Loader2 className="size-3.5 shrink-0 animate-spin" />
				编辑器加载中…
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
//  Toolbar
// ---------------------------------------------------------------------------

function Toolbar() {
	return (
		<div className="flex items-center gap-0.5 flex-wrap px-1 py-1 border-b border-input bg-muted/30">
			<RichTextBold />
			<RichTextItalic />
			<RichTextUnderline />
			<RichTextStrike />

			<Separator orientation="vertical" className="mx-1 h-5" />

			<RichTextHeading />

			<Separator orientation="vertical" className="mx-1 h-5" />

			<RichTextBulletList />
			<RichTextOrderedList />
			<RichTextBlockquote />
			<RichTextCodeBlock />
			<RichTextCode />

			<Separator orientation="vertical" className="mx-1 h-5" />

			<RichTextLink />
			<RichTextImage />
			<RichTextHorizontalRule />
			<RichTextClear />

			<Separator orientation="vertical" className="mx-1 h-5" />

			<RichTextUndo />
			<RichTextRedo />
		</div>
	);
}
