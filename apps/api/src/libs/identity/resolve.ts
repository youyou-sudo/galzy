// 展示身份（Display Identity）解析 —— 见 CONTRACT.md §1/§4
//
// 设计要点：全站只有一种"条目身份"，即展示身份 'vNNN' 或 'kgX'。
// - 有 vndb 锚点 → 'vNNN'；无 → 'kgX'（kungal work id 原样大小写）。
// - 旧 'kgX' 链接在补到 vndb 锚点后仍可解析（走 galrc_external_ids），
//   由调用方决定是否 302 到新路由。
// - 本模块是唯一允许直接读 galrc_external_ids 的地方。

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/client'
import { alistb, externalIds } from '../../db/schema'

export type AnchorKind = 'vndb' | 'kungal' | 'other'

/** 展示身份：'vNNN'（VNDB 优先）或 'kgX'（kungal 锚点） */
export type DisplayId = string

const VNDB_RE = /^v\d+$/i
const KUNGAL_ANCHOR_RE = /^kg(.+)$/i
/** kg 前缀属于路由命名空间，kungal work id 本身不含该前缀 */
const KG_PREFIX = 'kg'

/** vndb 侧统一小写；其它锚点原样保留大小写（kungal work id 大小写敏感） */
export function normalizeAnchorId(kind: string, rawId: string): string {
  const id = rawId.trim()
  return kind.toLowerCase() === 'vndb' ? id.toLowerCase() : id
}

/** 展示身份 → 路由身份：非法形态返回 null。'vNNN' 归一为小写，'kgX' 原样。 */
export function parseDisplayId(raw: string): DisplayId | null {
  const id = raw?.trim()
  if (!id) return null
  if (VNDB_RE.test(id)) return id.toLowerCase()
  const kg = id.match(KUNGAL_ANCHOR_RE)
  if (kg && kg[1].length > 0) return `${KG_PREFIX}${kg[1]}`
  return null
}

/** 纯函数：锚点 → 展示身份。upgradedVid 为外部已知的 vndb 锚点（优先）。 */
export function displayIdOf(
  anchorKind: AnchorKind,
  anchorId: string,
  upgradedVid?: string | null,
): DisplayId {
  if (upgradedVid && VNDB_RE.test(upgradedVid)) return upgradedVid.toLowerCase()
  if (anchorKind === 'vndb' && VNDB_RE.test(anchorId))
    return anchorId.toLowerCase()
  if (anchorKind === 'kungal') return `${KG_PREFIX}${anchorId}`
  // other 锚点没有独立路由命名空间，退回锚点键本身（历史行为：id = other.id）
  return anchorId
}

/**
 * 记录一条锚点别名（幂等 upsert）。
 * 只做归一，不做反向覆盖：同一 (kind, external_id) 重复写入以最新 canonical 为准。
 */
/** 归一目标类型：vndb 锚点，或「被合并到的另一个 kungal work」（此时展示身份为 kgX） */
export type CanonicalKind = 'vndb' | 'kungal'

/** 归一目标 → 展示身份。kungal 目标补 'kg' 前缀，vndb 目标小写。 */
export function canonicalDisplayId(
  canonicalKind: string,
  canonicalId: string,
): DisplayId {
  return canonicalKind === 'kungal'
    ? `${KG_PREFIX}${canonicalId}`
    : canonicalId.toLowerCase()
}

const CANONICAL_KINDS: CanonicalKind[] = ['vndb', 'kungal']

/**
 * 记录一条锚点别名（幂等 upsert）。
 *
 * canonicalKind='vndb'（默认）：外部 id → VNDB 锚点，展示身份 vNNN。
 * canonicalKind='kungal'：kungal work 被合并到另一个 kungal work（且没有 vndb 锚点），
 *   展示身份 kgCanonicalId。不登记这种别名的话，网盘里仍叫 `[kungal-旧id]` 的目录
 *   会解析出与收口后行**不同的**展示身份，从而在扫描时新增出重复条目。
 */
export async function linkAlias(
  kind: string,
  externalIdRaw: string,
  canonicalIdRaw: string,
  canonicalKind: CanonicalKind = 'vndb',
): Promise<void> {
  const k = kind.trim().toLowerCase()
  const externalId = normalizeAnchorId(k, externalIdRaw)
  if (!k || !externalId || !CANONICAL_KINDS.includes(canonicalKind)) return
  const canonicalId =
    canonicalKind === 'vndb'
      ? canonicalIdRaw.trim().toLowerCase()
      : canonicalIdRaw.trim()
  if (!canonicalId) return
  if (canonicalKind === 'vndb' && !VNDB_RE.test(canonicalId)) return
  // 自身即同一锚点时无需登记（identity 映射恒等）
  if (k === canonicalKind && externalId === canonicalId) return

  await db
    .insert(externalIds)
    .values({ kind: k, externalId, canonicalKind, canonicalId })
    .onConflictDoUpdate({
      target: [externalIds.kind, externalIds.externalId],
      set: {
        canonicalKind,
        canonicalId,
        updatedAt: new Date(),
      },
    })
}

/** 批量登记别名（同 kind），一次事务多行 upsert。 */
export async function linkAliases(
  pairs: Array<{
    kind: string
    externalId: string
    canonicalVid: string
    canonicalKind?: CanonicalKind
  }>,
): Promise<void> {
  const rows = pairs
    .map(({ kind, externalId, canonicalVid, canonicalKind }) => {
      const k = kind.trim().toLowerCase()
      const external = normalizeAnchorId(k, externalId)
      const target: CanonicalKind = canonicalKind ?? 'vndb'
      const canonical =
        target === 'vndb'
          ? canonicalVid.trim().toLowerCase()
          : canonicalVid.trim()
      if (!k || !external || !canonical) return null
      if (!CANONICAL_KINDS.includes(target)) return null
      if (target === 'vndb' && !VNDB_RE.test(canonical)) return null
      if (k === target && external === canonical) return null
      return {
        kind: k,
        externalId: external,
        canonicalKind: target,
        canonicalId: canonical,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
  if (rows.length === 0) return

  // 批内同 (kind, external_id) 去重：ON CONFLICT 无法在同一 INSERT 中更新同一目标两次
  const deduped = new Map<string, (typeof rows)[number]>()
  for (const r of rows) deduped.set(`${r.kind}\u0000${r.externalId}`, r)

  await db
    .insert(externalIds)
    .values([...deduped.values()])
    .onConflictDoUpdate({
      target: [externalIds.kind, externalIds.externalId],
      set: {
        canonicalKind: sql.raw('excluded.canonical_kind'),
        canonicalId: sql.raw('excluded.canonical_id'),
        updatedAt: new Date(),
      },
    })
}

/**
 * 单条解析：任意形态 id（'vNNN' / 'kgX' / 数字 other id）→ 展示身份。
 * 不存在（既非合法路由身份、也查不到条目）返回 null。
 *
 * 查找顺序：① 外部别名表（vndb 直取 / kungal 转 canonical）
 *          ② galrc_alistb.display_id（按 id 或 lower(kungal_id)）
 *          ③ vn.id（vndb 兜底：有 vn 行但暂无资源）
 */
export async function resolveDisplayId(
  idRaw: string,
): Promise<DisplayId | null> {
  const raw = idRaw?.trim()
  if (!raw) return null

  const routeId = parseDisplayId(raw)
  if (routeId) {
    const kind = routeId.startsWith(KG_PREFIX) ? 'kungal' : 'vndb'
    const anchorId =
      kind === 'kungal' ? routeId.slice(KG_PREFIX.length) : routeId

    const alias = await db
      .select({
        canonicalId: externalIds.canonicalId,
        canonicalKind: externalIds.canonicalKind,
      })
      .from(externalIds)
      .where(
        and(
          eq(externalIds.kind, kind),
          eq(externalIds.externalId, normalizeAnchorId(kind, anchorId)),
        ),
      )
      .limit(1)
      .then((r) => r[0])
    if (alias?.canonicalId)
      return canonicalDisplayId(alias.canonicalKind, alias.canonicalId)

    const displayRow = await db
      .select({ displayId: alistb.displayId })
      .from(alistb)
      .where(displayIdWhere(routeId))
      .limit(1)
      .then((r) => r[0])
    if (displayRow?.displayId) return displayRow.displayId

    if (kind === 'vndb') return routeId
    return routeId
  }

  // 数字 = 旧 galrc_other 手工条目：其 alistb 行 vid 可能为空
  if (/^\d+$/.test(raw)) {
    const row = await db
      .select({ displayId: alistb.displayId, vid: alistb.vid })
      .from(alistb)
      .where(eq(alistb.other, Number(raw)))
      .limit(1)
      .then((r) => r[0])
    if (!row) return null
    return row.displayId ?? row.vid ?? null
  }

  return null
}

/** 批量解析（热榜 / 索引等批量场景）。返回入参 id → 展示身份的映射。 */
export async function resolveDisplayIds(
  ids: string[],
): Promise<Map<string, DisplayId>> {
  const out = new Map<string, DisplayId>()
  const unique = [...new Set(ids.map((i) => i?.trim()).filter(Boolean))]
  if (unique.length === 0) return out

  const routeIds = unique.filter((i) => parseDisplayId(i) !== null)
  const numericIds = unique.filter((i) => /^\d+$/.test(i))
  const kungalAnchors = routeIds
    .filter((i) => i.toLowerCase().startsWith(KG_PREFIX))
    .map((i) => i.slice(KG_PREFIX.length))

  // vndb 直通：vNNN 本身就是展示身份，除非别名表另有指向（kungal 合并后变 vndb 才登记）
  const vndbIds = routeIds.filter((i) => VNDB_RE.test(i))

  const [aliasRows, displayRows, otherRows] = await Promise.all([
    routeIds.length > 0
      ? db
          .select({
            kind: externalIds.kind,
            externalId: externalIds.externalId,
            canonicalId: externalIds.canonicalId,
            canonicalKind: externalIds.canonicalKind,
          })
          .from(externalIds)
          .where(
            and(
              inArray(externalIds.kind, ['vndb', 'kungal']),
              inArray(externalIds.externalId, [
                ...vndbIds.map((v) => v.toLowerCase()),
                ...kungalAnchors,
              ]),
            ),
          )
      : Promise.resolve(
          [] as Array<{
            kind: string
            externalId: string
            canonicalId: string
            canonicalKind: string
          }>,
        ),
    routeIds.length > 0
      ? db
          .select({
            id: alistb.id,
            kungalId: alistb.kungalId,
            displayId: alistb.displayId,
          })
          .from(alistb)
          .where(
            inArray(
              alistb.displayId,
              routeIds.map((r) => r as string),
            ),
          )
      : Promise.resolve(
          [] as Array<{
            id: string
            kungalId: string | null
            displayId: string | null
          }>,
        ),
    numericIds.length > 0
      ? db
          .select({
            other: alistb.other,
            displayId: alistb.displayId,
            vid: alistb.vid,
          })
          .from(alistb)
          .where(inArray(alistb.other, numericIds.map(Number)))
      : Promise.resolve(
          [] as Array<{
            other: number | null
            displayId: string | null
            vid: string | null
          }>,
        ),
  ])

  // display_id 集合命中：入参本身即展示身份（大小写归一后比较）
  const displayByLower = new Map<string, string>()
  for (const r of displayRows) {
    if (r.displayId) displayByLower.set(r.displayId.toLowerCase(), r.displayId)
  }
  const aliasByKey = new Map<string, string>()
  for (const r of aliasRows) {
    aliasByKey.set(
      `${r.kind}\u0000${r.externalId}`,
      canonicalDisplayId(r.canonicalKind, r.canonicalId),
    )
  }
  const otherById = new Map<number, string>()
  for (const r of otherRows) {
    if (r.other != null) otherById.set(r.other, r.displayId ?? r.vid ?? '')
  }

  for (const input of unique) {
    const routeId = parseDisplayId(input)
    if (routeId) {
      const kind = routeId.toLowerCase().startsWith(KG_PREFIX)
        ? 'kungal'
        : 'vndb'
      const anchorId =
        kind === 'kungal'
          ? routeId.slice(KG_PREFIX.length)
          : routeId.toLowerCase()
      const alias = aliasByKey.get(
        `${kind}\u0000${normalizeAnchorId(kind, anchorId)}`,
      )
      if (alias) {
        out.set(input, alias)
        continue
      }
      const direct = displayByLower.get(routeId.toLowerCase())
      if (direct) {
        out.set(input, direct)
        continue
      }
      out.set(input, routeId)
      continue
    }
    if (/^\d+$/.test(input)) {
      const display = otherById.get(Number(input))
      if (display) out.set(input, display)
    }
  }

  return out
}

/**
 * alistb 查询条件：'vNNN' 命中 display_id / id / vid；'kgX' 命中 display_id /
 * id，或 lower(kungal_id)（大小写不敏感匹配 kungal work id）。
 */
export function displayIdWhere(routeId: DisplayId) {
  if (VNDB_RE.test(routeId)) {
    const v = routeId.toLowerCase()
    return sql`(${alistb.displayId} = ${v} OR ${alistb.id} = ${v} OR ${alistb.vid} = ${v})`
  }
  const kg = routeId.match(KUNGAL_ANCHOR_RE)
  const anchor = kg ? kg[1] : routeId
  return sql`(${alistb.displayId} = ${routeId} OR ${alistb.id} = ${routeId} OR lower(${alistb.kungalId}) = lower(${anchor}))`
}

/** 展示身份是否属于 kungal 命名空间（决定 R18 门控走 vn 还是 kungalWorks） */
export function isKungalDisplayId(displayId: string): boolean {
  return displayId.toLowerCase().startsWith(KG_PREFIX)
}
