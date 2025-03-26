import React from "react";

type BBCodeRendererProps = {
  text: string;
};

// 解析 BBCode
const bbcodeParser = (bbcode: string): string => {
  // 解析 [b] 和 [/b] 标签 (支持大小写)
  bbcode = bbcode.replace(/\[b\](.*?)\[\/b\]/gi, "<strong>$1</strong>");

  // 解析 [i] 和 [/i] 标签 (支持大小写)
  bbcode = bbcode.replace(/\[i\](.*?)\[\/i\]/gi, "<em>$1</em>");

  // 解析 [url] 标签 (支持大小写)
  bbcode = bbcode.replace(
    /\[url=(.*?)\](.*?)\[\/url\]/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>'
  );

  // 解析 [quote] 标签 (支持大小写)
  bbcode = bbcode.replace(
    /\[quote\](.*?)\[\/quote\]/gi,
    "<blockquote>$1</blockquote>"
  );

  // 解析换行符
  bbcode = bbcode.replace(/\\n/g, "<br />");

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
