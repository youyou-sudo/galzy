import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { ListItem } from "@tiptap/extension-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { TextStyle } from "@tiptap/extension-text-style";
import {
	Dropcursor,
	Gapcursor,
	Placeholder,
	TrailingNode,
} from "@tiptap/extensions";
import { Blockquote } from "reactjs-tiptap-editor/blockquote";
import { Bold } from "reactjs-tiptap-editor/bold";
import { BulletList } from "reactjs-tiptap-editor/bulletlist";
import { Clear } from "reactjs-tiptap-editor/clear";
import { Code } from "reactjs-tiptap-editor/code";
import { CodeBlock } from "reactjs-tiptap-editor/codeblock";
import { Heading } from "reactjs-tiptap-editor/heading";
import { History } from "reactjs-tiptap-editor/history";
import { HorizontalRule } from "reactjs-tiptap-editor/horizontalrule";
import { Image } from "reactjs-tiptap-editor/image";
import { Italic } from "reactjs-tiptap-editor/italic";
import { Link } from "reactjs-tiptap-editor/link";
import { OrderedList } from "reactjs-tiptap-editor/orderedlist";
import { SlashCommand } from "reactjs-tiptap-editor/slashcommand";
import { Strike } from "reactjs-tiptap-editor/strike";
import { TextUnderline } from "reactjs-tiptap-editor/textunderline";

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export interface RichTextExtensionOptions {
	placeholder?: string;
	imageUpload?: (file: File) => Promise<string>;
	imageOnError?: (error: {
		type: "size" | "type" | "upload";
		message: string;
		file?: File;
	}) => void;
}

/**
 * 编辑器与静态渲染共用的扩展集合 —— 保证「所见即所得」：
 * 编辑器（useEditor）与阅读页渲染（@tiptap/static-renderer）使用同一份
 * 扩展定义，解析与输出完全一致。
 */
export function createRichTextExtensions({
	placeholder = "",
	imageUpload,
	imageOnError,
}: RichTextExtensionOptions = {}) {
	return [
		Document,
		Text,
		Paragraph,
		HardBreak,
		ListItem,
		TextStyle,
		Dropcursor,
		Gapcursor,
		TrailingNode,
		Placeholder.configure({ placeholder }),
		Bold,
		Italic,
		TextUnderline,
		Strike,
		Heading.configure({ levels: [1, 2, 3] }),
		BulletList,
		OrderedList,
		Blockquote,
		CodeBlock,
		Code,
		Link,
		Image.configure({
			upload: imageUpload,
			resourceImage: "both",
			enableAlt: true,
			multiple: false,
			acceptMimes: ["image/*"],
			maxSize: MAX_IMAGE_SIZE,
			HTMLAttributes: { class: "rounded-md" },
			onError: imageOnError,
		}),
		HorizontalRule,
		History,
		Clear,
		SlashCommand,
	];
}

/** 阅读页静态渲染用扩展（无占位符/上传等编辑态配置） */
export const RICH_TEXT_RENDER_EXTENSIONS = createRichTextExtensions();
