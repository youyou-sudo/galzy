/**
 * HTML → 规范化文本行，用于跨实现比较（去掉框架属性、脚本、广告等噪声）。
 */

export type NormalizeOptions = {
  /** 把数字（浏览数/点赞数/页码等）统一成 #（默认 true） */
  normalizeNumbers?: boolean
  /** 移除广告位节点（默认 true） */
  stripAds?: boolean
  /** 移除 data-parity-ignore 标记的节点（默认 true） */
  stripMarked?: boolean
}

const BLOCK_TAGS = [
  'p','div','section','article','aside','header','footer','nav','main','ul','ol','li',
  'table','thead','tbody','tr','td','th','h1','h2','h3','h4','h5','h6','blockquote','pre',
  'figure','figcaption','form','fieldset','label','dl','dt','dd','details','summary','hr',
]

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·',
  hellip: '…', mdash: '—', ndash: '–', copy: '©', reg: '®', trade: '™',
  laquo: '«', raquo: '»', times: '×', divide: '÷', bull: '•', deg: '°',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITIES[entity] ?? match
  })
}

/** 噪声规则：时间戳 / 哈希 / 相对时间 / 计数。 */
const NOISE_RULES: Array<[RegExp, string]> = [
  [/[0-9a-f]{8,}/gi, '<hash>'],
  [/\d{4}-\d{1,2}-\d{1,2}[T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g, '<datetime>'],
  [/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/g, '<date>'],
  [/\d{1,2}:\d{2}(:\d{2})?/g, '<clock>'],
  [/\d+\s*(秒|分钟|分|小时|天|周|星期|个月|月|年)\s*前/g, '<relative-time>'],
  [/[A-Za-z0-9+/]{40,}={0,2}/g, '<blob>'],
]

export function normalizeHtml(html: string, options: NormalizeOptions = {}): string[] {
  const normalizeNumbers = options.normalizeNumbers ?? true
  let text = html

  // 1) 去掉不可见内容
  text = text.replace(/<!--[\s\S]*?-->/g, ' ')
  text = text.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  text = text.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  text = text.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
  text = text.replace(/<template\b[\s\S]*?<\/template>/gi, ' ')
  text = text.replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')

  // 2) 广告位 / 显式忽略节点
  if (options.stripAds ?? true) {
    text = text.replace(
      /<(aside|div|section)\b[^>]*(?:id=["']sidebar-ad["']|data-ad-slot=["'][^"']+["'])[^>]*>[\s\S]*?<\/\1>/gi,
      ' ',
    )
  }
  if (options.stripMarked ?? true) {
    text = text.replace(/<(\w+)\b[^>]*data-parity-ignore[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  }

  // 3) 结构换行
  text = text.replace(/<br\s*\/?>/gi, '\n')
  const blockPattern = new RegExp('</?(?:' + BLOCK_TAGS.join('|') + ')\\b[^>]*>', 'gi')
  text = text.replace(blockPattern, '\n')

  // 4) 去标签 + 实体
  text = text.replace(/<[^>]+>/g, ' ')
  text = decodeEntities(text)

  // 5) 噪声归一
  for (const [pattern, replacement] of NOISE_RULES) text = text.replace(pattern, replacement)
  if (normalizeNumbers) text = text.replace(/\d+/g, '#')

  const lines: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[ \t\u00a0]+/g, ' ').trim()
    if (line) lines.push(line)
  }
  return lines
}

export type LineDiff = {
  ratio: number
  changed: number
  total: number
  added: string[]
  removed: string[]
  /** 变化块（首尾各取若干行，便于人工判断） */
  hunks: Array<{ type: 'add' | 'remove'; lines: string[] }>
}

function lcsLength(a: string[], b: string[]): number {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return 0
  if (n * m > 8_000_000) {
    // 太大时退化为哈希集合交集，避免卡死
    const counts = new Map<string, number>()
    for (const line of a) counts.set(line, (counts.get(line) ?? 0) + 1)
    let common = 0
    for (const line of b) {
      const left = counts.get(line) ?? 0
      if (left > 0) {
        common++
        counts.set(line, left - 1)
      }
    }
    return common
  }
  let previous = new Uint32Array(m + 1)
  let current = new Uint32Array(m + 1)
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) current[j] = previous[j - 1] + 1
      else current[j] = Math.max(previous[j], current[j - 1])
    }
    const swap = previous
    previous = current
    current = swap
    current.fill(0)
  }
  return previous[m]
}

/** 行级 diff：给出差异比例和前后片段。 */
export function diffLines(a: string[], b: string[]): LineDiff {
  const common = lcsLength(a, b)
  const total = Math.max(a.length, b.length)
  const changed = total - common
  const ratio = total === 0 ? 0 : changed / total

  // 用简单的前缀/后缀裁剪 + 集合差给出样例
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++
  let suffix = 0
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++
  }
  const aMiddle = a.slice(prefix, a.length - suffix)
  const bMiddle = b.slice(prefix, b.length - suffix)
  const bSet = new Map<string, number>()
  for (const line of bMiddle) bSet.set(line, (bSet.get(line) ?? 0) + 1)
  const removed: string[] = []
  for (const line of aMiddle) {
    const count = bSet.get(line) ?? 0
    if (count > 0) bSet.set(line, count - 1)
    else removed.push(line)
  }
  const aSet = new Map<string, number>()
  for (const line of aMiddle) aSet.set(line, (aSet.get(line) ?? 0) + 1)
  const added: string[] = []
  for (const line of bMiddle) {
    const count = aSet.get(line) ?? 0
    if (count > 0) aSet.set(line, count - 1)
    else added.push(line)
  }

  const hunks: LineDiff['hunks'] = []
  if (removed.length > 0) hunks.push({ type: 'remove', lines: removed.slice(0, 8) })
  if (added.length > 0) hunks.push({ type: 'add', lines: added.slice(0, 8) })

  return {
    ratio,
    changed,
    total,
    added: added.slice(0, 20),
    removed: removed.slice(0, 20),
    hunks,
  }
}
