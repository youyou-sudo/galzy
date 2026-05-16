import type React from "react";

type BBCodeRendererProps = {
	text: string;
};

// 解析 BBCode
const bbcodeParser = (bbcode: string): string => {
	// 解析 [b] 和 [/b] 标签 (支持大小写)
	bbcode = bbcode.replace(/\[b\](.*?)\[\/b\]/gi, "<strong>$1</strong>");

	// 解析 [i] 和 [/i] 标签 (支持大小写)
	bbcode = bbcode.replace(/\[i\](.*?)\[\/i\]/gi, "<em>$1</em>");

	// 解析 [url] 标签 (支持大小写)，智能识别四种链接类型
	bbcode = bbcode.replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, (_, url, text) => {
		// 判断是否为内部链接：/v/g/p + 数字（如 /v1、g8、/p988）
		const internalMatch = url.match(/^\/?([vgp]\d+)$/i);
		if (internalMatch) {
			const id = internalMatch[1]; // 去掉可能的前导 /，如 "p988"
			const prefix = id[0].toLowerCase();
			let href: string;
			if (prefix === "g") {
				href = `/tags/${id}`;
			} else if (prefix === "p") {
				href = `/producer/${id}`;
			} else {
				// v 前缀，直接挂载到根路径
				href = `/${id}`;
			}
			return `<a class="text-cyan-600 hover:underline" href="${href}">${text}</a>`;
		}
		// 外链：新窗口打开
		return `<a class="text-cyan-600 hover:underline" href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
	});

	// 解析 [quote] 标签 (支持大小写)
	bbcode = bbcode.replace(
		/\[quote\](.*?)\[\/quote\]/gi,
		"<blockquote>$1</blockquote>",
	);

	// 解析换行符（匹配真正的换行符 \n 以及字面量 \\n）
	bbcode = bbcode.replace(/\n/g, "<br />").replace(/\\n/g, "<br />");

	// 解析 [From ErogeShop]（这是文本，而非 BBCode 标签）
	bbcode = bbcode.replace(/\[From ErogeShop\]/g, "<i>[From ErogeShop]</i>");

	return bbcode;
};

// BBCode 渲染组件
export const BBCodeRenderer: React.FC<BBCodeRendererProps> = ({ text }) => {
	// 将 BBCode 文本解析为 HTML 并插入到 React 组件中
	const parsedText = bbcodeParser(text);

	return <div dangerouslySetInnerHTML={{ __html: parsedText }} />;
};
