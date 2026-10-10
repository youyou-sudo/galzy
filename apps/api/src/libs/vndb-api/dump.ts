import type { TagDumpEntry } from './types'

/**
 * VNDB 官方 tag dump —— 标签层级的唯一数据来源。
 *
 * Kuna API 的 `POST /tag` 不暴露层级：`parent` / `parents` / `meta` / `children`
 * 都不在 `GET /schema` 的 `/tag` 字段列表里，请求这些字段会返回 400。
 * 只有每日 dump 带 `parents`（整数 id 数组）与 `meta`。
 *
 * dump 与 API 的 id 对应关系为 `g${id}`（dump 的 1 → API 的 g1）。
 */
const TAG_DUMP_URL = 'https://dl.vndb.org/dump/vndb-tags-latest.json.gz'

/** dump 裸整数 id → 项目统一的 gN 形式 */
export function dumpIdToTagId(id: number): string {
  return `g${id}`
}

export async function fetchTagDump(): Promise<TagDumpEntry[]> {
  console.log('🌐 VNDB tag dump 下载中...')
  const res = await fetch(TAG_DUMP_URL, {
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    throw new Error(`VNDB tag dump ${res.status}: ${await res.text()}`)
  }

  const gz = await res.arrayBuffer()
  // Bun 内置 zlib 解压，无需外部依赖
  const raw = new TextDecoder().decode(Bun.gunzipSync(Buffer.from(gz)))
  const entries = JSON.parse(raw) as TagDumpEntry[]
  console.log(`✅ VNDB tag dump → ${entries.length} tags`)
  return entries
}

export const VndbTagDump = { fetchTagDump, dumpIdToTagId }
