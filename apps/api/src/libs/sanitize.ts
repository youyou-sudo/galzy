import { rehype } from 'rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

/**
 * 富文本（TipTap 输出的 HTML）入库前的服务端净化。
 *
 * 帖子正文渲染走 dangerouslySetInnerHTML，不能信任编辑器输出，
 * 这里基于 rehype-sanitize 的默认 allowlist，并额外收紧：
 * - 保留默认 `*` 属性（alt/width/height 等），额外放行 className
 * - img 仅允许 http/https src（默认 schema 已如此）
 * - 清除所有 style 属性（allowlist 中不包含即被丢弃，防止 CSS 注入）
 * - a 标签强制 rel/target，防 tabnabbing
 * - 补上 TipTap Underline 输出用的 `<u>` 标签
 * - 默认 schema 已拒绝 script/iframe/on* 事件属性
 */
const defaultAttrs = defaultSchema.attributes ?? {}
const defaultTags = defaultSchema.tagNames ?? []

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultAttrs,
    '*': [...(defaultAttrs['*'] ?? []), 'className'],
    a: [
      ...(defaultAttrs.a ?? []),
      ['rel', 'noopener noreferrer'],
      ['target', '_blank'],
    ],
    img: [...(defaultAttrs.img ?? [])],
  },
  tagNames: [...defaultTags, 'u'],
  // style 属性整体移除（allowlist 中不包含即被丢弃）
  // strip: ['script', 'style'] 由默认 schema 处理
} satisfies NonNullable<Parameters<typeof rehypeSanitize>[0]>

export function sanitizeHtml(html: string): string {
  const file = rehype()
    .data('settings', { fragment: true })
    .use(rehypeSanitize, schema)
    .processSync(html)
  return String(file)
}

/** 从 HTML 中剥离标签，得到纯文本（用于列表摘要 / 前端 meta description） */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
