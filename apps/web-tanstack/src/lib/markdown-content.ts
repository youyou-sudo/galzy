/**
 * 攻略内容智能渲染的检测与预处理。
 *
 * 背景：攻略文章大量直接粘贴自 txt，而 CommonMark 解析规则对纯文本不友好：
 *   - 行首 4 个半角空格 → 被解析为代码块（缩进段落变样式）
 *   - 单个换行 → 折叠成空格（txt 每行一行的排版丢失）
 *   - `<告白> <拒绝>` 这类尖括号写法 → 被 rehype-raw 当作 HTML 标签吞掉
 *
 * 平衡策略：检测内容是否含 markdown 特征 ——
 *   - 纯文本 → 走 `white-space: pre-wrap` 原样渲染，格式 100% 还原
 *   - 含 markdown → 正常 markdown 渲染，但对 txt 常见写法做兼容预处理
 */

/** 任一特征命中即视为“含 markdown” */
const MARKDOWN_FEATURES = [
	// ATX 标题：# 标题
	/^#{1,6}\s+\S/m,
	// 无序列表：- / * / + 后跟空格
	/^\s{0,3}[-*+]\s+\S/m,
	// 有序列表：1. 后跟空格
	/^\s{0,3}\d+\.\s+\S/m,
	// 引用：> 后必须跟空白（避免 >> 装饰符号误判）
	/^\s{0,3}>\s/m,
	// 代码围栏
	/^```/m,
	// 行内代码
	/`[^`\n]+`/,
	// 粗体 / 斜体
	/\*\*[^*\n]+\*\*|__[^_\n]+__/,
	// 图片 / 链接（括号内无空白，降低误判）
	/!\[[^\]]*\]\([^)\s]*\)/,
	/\[[^\]]+\]\([^)\s]+\)/,
	// GFM 表格分隔行：| --- | --- |
	/^\s*\|[\s:|-]+\|\s*$/m,
	// HTML 标签（存量富文本文章直接存了 <p> 等标签，需走 rehype-raw 渲染）
	/<[a-z][^>]*>/i,
];

/** 内容是否包含 markdown 特征（否则按纯文本渲染） */
export function isMarkdownContent(content: string): boolean {
	return MARKDOWN_FEATURES.some((re) => re.test(content));
}

/**
 * markdown 模式下的 txt 兼容预处理：
 *  1. 行首半角空格 / tab → 等量全角空格。
 *     既保留视觉缩进，又避免被 CommonMark 当作代码块或段落缩进丢弃。
 *     代码块请使用 ``` 围栏（编辑器工具栏已提供）。
 *  2. `<` 后跟非 ASCII / 字母 / / / ! → 转义为 &lt;。
 *     galgame 攻略常用 `<选项A> <选项B>` 写法，rehype-raw 会把它当 HTML 标签吞掉。
 *     合法 HTML 标签（<b>、<br>、</p>、<!-- -->、<!DOCTYPE>）不受影响。
 */
export function normalizeTxtForMarkdown(content: string): string {
	return content
		.split("\n")
		.map((line) => {
			const indent = /^[ \t]+/.exec(line)?.[0];
			if (indent) {
				const width = indent.replace(/\t/g, "    ").length;
				line = "\u3000".repeat(width) + line.slice(indent.length);
			}
			return line.replace(/<(?![a-zA-Z/!])/g, "&lt;");
		})
		.join("\n");
}
