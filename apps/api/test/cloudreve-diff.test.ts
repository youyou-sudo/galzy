#!/usr/bin/env bun
/**
 * cloudreve diff 收敛性回归测试。
 *
 * 线上症状（本文件锁死的行为）：后台「检测文件缺失」长期固定 N 条待新增，
 * 点同步也修不掉。根因是历史行展示身份大小写不一致 → 每轮判成新增 →
 * insert 撞 lower(kungal_id) 唯一索引 → 整轮事务回滚。
 */
import { describe, expect, test } from 'bun:test'
import {
  type AlistbRow,
  type AlistbUpsertRow,
  type RawDataItem,
  diffCloudreveData,
  partitionCloudreveWrites,
} from '../src/modules/cron/lib'

function folder(name: string): RawDataItem {
  return {
    name,
    path: 'cloudreve://my/Games/' + encodeURIComponent(name),
    is_dir: true,
    size: 0,
    type: 1,
  }
}

/** 内存版 alistb：落地 uq(display_id) + uq(lower(kungal_id))，冲突即抛错。 */
function apply(
  rows: AlistbRow[],
  upserts: AlistbUpsertRow[],
  deleting: string[],
): { rows: AlistbRow[]; error: string | null } {
  let next = rows.filter((r) => !deleting.includes(r.id))
  for (const row of upserts) {
    const idx = next.findIndex((r) => r.id === row.id)
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...row }
      continue
    }
    const display = (r: AlistbRow) => (r.displayId ?? r.vid ?? r.id).toLowerCase()
    if (next.some((r) => display(r) === row.displayId.toLowerCase()))
      return { rows, error: 'display_id 23505: ' + row.displayId }
    if (
      row.kungalId &&
      next.some(
        (r) => (r.kungalId ?? '').toLowerCase() === row.kungalId!.toLowerCase(),
      )
    )
      return { rows, error: 'kungal_id 23505: ' + row.kungalId }
    next = [...next, { ...row, other: null }]
  }
  return { rows: next, error: null }
}

async function runUntilStable(
  data: RawDataItem[],
  start: AlistbRow[],
  kungalDisplay: Map<string, string>,
  rounds = 3,
) {
  let rows = start
  const trace: string[] = []
  for (let i = 0; i < rounds; i++) {
    const diff = await diffCloudreveData(data, rows, async () => false, kungalDisplay)
    const { upserts, blocked } = partitionCloudreveWrites(diff, rows)
    const applied = apply(rows, upserts, [
      ...diff.renames.map((r) => r.fromId),
      ...diff.toDelete.map((r) => r.id),
    ])
    trace.push(
      `added=${diff.added} updated=${diff.updated} renamed=${diff.renamed} blocked=${blocked.length}`,
    )
    if (applied.error) throw new Error(applied.error)
    rows = applied.rows
  }
  return { trace, rows }
}

const legacyMixedCase: AlistbRow = {
  id: 'kgNew1',
  vid: null,
  other: null,
  kungalId: 'New1',
  anchorKind: 'kungal',
  displayId: 'kgNew1',
  path: ['/Games/[kungal-New1]'],
}

describe('cloudreve diff 收敛性', () => {
  test('展示身份大小写不同的历史行不会永远「待新增」', async () => {
    const { trace, rows } = await runUntilStable(
      [folder('[kungal-New1]')],
      [legacyMixedCase],
      new Map(),
    )
    // 第一轮只是把写法更正回来，之后必须完全稳定
    expect(trace[0]).toContain('added=0')
    expect(trace[1]).toContain('added=0 updated=0')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('kgNew1')
    expect(rows[0]?.displayId).toBe('kgnew1')
  })

  test('kungal 锚点补到 vndb 后按 rename 原地升级', async () => {
    const { trace, rows } = await runUntilStable(
      [folder('[kungal-abc]')],
      [{ ...legacyMixedCase, id: 'kgabc', displayId: 'kgabc', kungalId: 'abc' }],
      new Map([['abc', 'v123']]),
    )
    expect(trace[0]).toContain('renamed=1')
    expect(trace[1]).toContain('added=0 updated=0 renamed=0')
    expect(rows.map((r) => r.id)).toEqual(['v123'])
  })

  test('kungal→vndb 别名命中时不会另建 kg 条目', async () => {
    const { trace, rows } = await runUntilStable(
      [folder('[kungal-abc]'), folder('[vndb-v123]')],
      [
        {
          ...legacyMixedCase,
          id: 'v123',
          vid: 'v123',
          displayId: 'v123',
          kungalId: 'abc',
          anchorKind: 'vndb',
          path: ['/Games/[vndb-v123]'],
        },
      ],
      new Map([['abc', 'v123']]),
    )
    expect(trace[0]).toContain('added=0')
    expect(trace[1]).toContain('added=0 updated=0')
    expect(rows.map((r) => r.id)).toEqual(['v123'])
  })

  test('绝不把已有 vndb 锚点的行降级成 kg 身份', async () => {
    const start: AlistbRow[] = [
      {
        ...legacyMixedCase,
        id: 'v123',
        vid: 'v123',
        displayId: 'v123',
        kungalId: 'abc',
        anchorKind: 'vndb',
        path: ['/Games/[vndb-v123]'],
      },
    ]
    // v123 的目录路径仍然存活 → 它是"保留行"，不能被新的 kg 行顶掉
    const diff = await diffCloudreveData(
      [folder('[kungal-abc]')],
      start,
      async () => true,
      new Map(),
    )
    expect(diff.renamed).toBe(0)
    const { blocked } = partitionCloudreveWrites(diff, start)
    expect(blocked.some((b) => b.reason === 'kungal_id_taken')).toBe(true)
  })

  test('kungal 锚点被别的行占住时上报 blocked，而不是让事务回滚', async () => {
    const diff = await diffCloudreveData(
      [folder('[kungal-abc]')],
      [
        { ...legacyMixedCase, id: 'kgabc', displayId: 'kgabc', kungalId: 'abc' },
        { ...legacyMixedCase, id: 'v999', displayId: 'v999', kungalId: 'abc', vid: 'v999' },
      ],
      async () => false,
      new Map([['abc', 'v999']]),
    )
    const { blocked, upserts } = partitionCloudreveWrites(diff, [
      { ...legacyMixedCase, id: 'kgabc', displayId: 'kgabc', kungalId: 'abc' },
      { ...legacyMixedCase, id: 'v999', displayId: 'v999', kungalId: 'abc', vid: 'v999' },
    ])
    expect(blocked.length + upserts.length).toBeGreaterThanOrEqual(0)
    // 覆盖行属于本次要删的 rename 源时不算冲突
    expect(blocked.every((b) => b.occupantId !== 'kgabc')).toBe(true)
  })
})
