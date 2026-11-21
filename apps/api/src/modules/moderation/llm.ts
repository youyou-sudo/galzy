import { aiModerationSettings, db } from '@api/libs'
import { eq } from 'drizzle-orm'
import {
  DEFAULT_MODERATION_PROMPT,
  PROMPT_CONTENT_PLACEHOLDER,
  PROMPT_TITLE_PLACEHOLDER,
} from './prompt'

/** 送审对象：评论或论坛帖子。 */
export type ModerationTargetType = 'comment' | 'topic'

/** 送审内容。title 仅帖子有；content 是纯文本（HTML 已由调用方转成文本）。 */
export type ModerationInput = {
  targetType: ModerationTargetType
  title?: string | null
  content: string
}

/** 生效的审核配置（prompt / apiBase 等都已按默认值归一化）。 */
export type ModerationSettings = {
  enabled: boolean
  apiBase: string
  apiKey: string | null
  model: string
  prompt: string
  temperature: number
  timeoutMs: number
  banThreshold: number
  autoBan: boolean
  checkComments: boolean
  checkTopics: boolean
  maxContentLength: number
}

/** 模型判定结果。 */
export type ModerationVerdict = {
  isSpam: boolean
  confidence: number
  reason: string
  category?: string
}

const SETTINGS_ID = 1
const DEFAULT_API_BASE = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'

function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/**
 * 读取生效配置。
 *
 * 表为空（尚未保存过）时返回「关闭 + 默认值」，创建评论/帖子时直接跳过，
 * 不会因为没配置就产生网络请求。
 */
export async function loadModerationSettings(): Promise<ModerationSettings> {
  const [row] = await db
    .select()
    .from(aiModerationSettings)
    .where(eq(aiModerationSettings.id, SETTINGS_ID))

  const prompt = row?.prompt?.trim() ? row.prompt : DEFAULT_MODERATION_PROMPT

  return {
    enabled: row?.enabled ?? false,
    apiBase: row?.apiBase?.trim() || DEFAULT_API_BASE,
    apiKey: row?.apiKey?.trim() || null,
    model: row?.model?.trim() || DEFAULT_MODEL,
    prompt,
    temperature: Number(row?.temperature ?? 0),
    timeoutMs: Math.min(
      120_000,
      Math.max(3_000, Number(row?.timeoutMs ?? 20_000)),
    ),
    banThreshold: clampConfidence(row?.banThreshold ?? 0.85),
    autoBan: row?.autoBan ?? true,
    checkComments: row?.checkComments ?? true,
    checkTopics: row?.checkTopics ?? true,
    maxContentLength: Math.min(
      20_000,
      Math.max(200, Number(row?.maxContentLength ?? 4_000)),
    ),
  }
}

/** 拼接 chat/completions 地址：允许填 base（…/v1）或完整端点。 */
export function resolveChatCompletionsUrl(apiBase: string): string {
  const base = apiBase.trim().replace(/\/+$/, '')
  if (!base) throw new Error('未配置大模型 API 地址')
  if (base.endsWith('/chat/completions')) return base
  return `${base}/chat/completions`
}

/** 提示词里写了占位符 → 当模板用；否则提示词做 system、内容做 user。 */
function buildMessages(prompt: string, input: ModerationInput) {
  const title = input.title?.trim() ?? ''
  const content = input.content.trim()

  if (
    prompt.includes(PROMPT_CONTENT_PLACEHOLDER) ||
    prompt.includes(PROMPT_TITLE_PLACEHOLDER)
  ) {
    const rendered = prompt
      .split(PROMPT_CONTENT_PLACEHOLDER)
      .join(content)
      .split(PROMPT_TITLE_PLACEHOLDER)
      .join(title)
    return {
      system: '你是内容安全审核模型，只输出 JSON 对象，不要输出任何其它文字。',
      user: rendered,
    }
  }

  const label = input.targetType === 'topic' ? '论坛帖子' : '评论'
  const parts = [`送审类型：${label}`]
  if (title) parts.push(`标题：${title}`)
  parts.push('内容：', content)
  return { system: prompt, user: parts.join('\n') }
}

/** 截断过长的正文，避免一次送审把上下文吃满。 */
export function truncateForPrompt(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n…（内容已截断，原文共 ${text.length} 字）`
}

/**
 * 从模型输出里抠出 JSON。
 *
 * 模型经常无视「只输出 JSON」的要求，把对象包在代码块或解释文字里；
 * 这里先剥代码块，再取第一个 { 到最后一个 } 的子串，解析失败直接抛错
 * （记 failed 入队，由后台手动重试），而不是猜一个结论。
 */
export function parseVerdict(raw: string): ModerationVerdict {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced?.[1] ?? raw).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`模型没有返回 JSON：${body.slice(0, 200)}`)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    throw new Error(`模型返回的 JSON 无法解析：${body.slice(0, 200)}`)
  }

  const spamFlag = parsed.isSpam ?? parsed.is_spam ?? parsed.spam
  if (typeof spamFlag !== 'boolean') {
    throw new Error('模型返回的 JSON 缺少布尔字段 isSpam')
  }

  const reason =
    typeof parsed.reason === 'string' ? parsed.reason.trim().slice(0, 200) : ''
  const category =
    typeof parsed.category === 'string' ? parsed.category.trim() : undefined

  return {
    isSpam: spamFlag,
    confidence: clampConfidence(parsed.confidence),
    reason,
    category,
  }
}

/** 调用 OpenAI 兼容接口做一次判定。 */
export async function moderateWithModel(
  settings: ModerationSettings,
  input: ModerationInput,
): Promise<{ verdict: ModerationVerdict; raw: unknown }> {
  if (!settings.apiKey) throw new Error('未配置大模型 API Key')

  const url = resolveChatCompletionsUrl(settings.apiBase)
  const { system, user } = buildMessages(settings.prompt, input)
  const content = truncateForPrompt(user, settings.maxContentLength)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content },
      ],
      temperature: settings.temperature,
    }),
    signal: AbortSignal.timeout(settings.timeoutMs),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(
      `大模型接口返回 HTTP ${response.status}：${text.slice(0, 300)}`,
    )
  }

  let payload: any
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`大模型接口返回了非 JSON 响应：${text.slice(0, 200)}`)
  }

  const rawContent = payload?.choices?.[0]?.message?.content
  const answer =
    typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)
  if (!answer) throw new Error('大模型接口没有返回 choices[0].message.content')

  return { verdict: parseVerdict(answer), raw: payload }
}
