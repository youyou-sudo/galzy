/**
 * 统计（浏览量 / 下载次数）的写时增量计数入口 + 读侧 SQL 片段工厂。
 *
 * 背景：旧的 galrc_event_views / galrc_gameDownloadStats 是「每次事件写一行明细」，
 * 线上 450 万行 / 569MB；「累计」与「本周热榜」都要在读取时聚合数十万到数百万行，
 * 只能靠 Redis 缓存掩盖。现在改成写时按 (kind, target_id, 周窗口) 自增的
 * galrc_stat_windows（见 db/schema/services.ts），读取侧全部变成小范围求和：
 *
 *   累计值 = SUM(total) WHERE kind = ? AND target_id = ?
 *   周榜   = SUM(total) GROUP BY target_id WHERE kind = ? AND window_start >= ?
 *
 * 下面两个 SQL 片段给 games / cron 的列表与 Meilisearch 索引文档复用；入参是 SQL
 * 列引用表达式（如 'vn.id'），由调用方使用内部常量拼接，不接受用户输入。
 */
import { sql } from 'drizzle-orm'
import { db } from '../db/client'
import { statWindows } from '../db/schema/services'
import { getWeekKey } from './time-window'

/** 计数维度：与 galrc_stat_windows.kind 一一对应。 */
export type StatKind = 'game_view' | 'tag_view' | 'game_download'

/** 累计事件浏览量（kind: 'game_view' | 'tag_view'）。 */
export const eventViewCountSql = (
  eventType: 'game_view' | 'tag_view',
  targetIdExpr: string,
): string =>
  `(SELECT COALESCE(SUM(total), 0)::int FROM galrc_stat_windows WHERE kind = '${eventType}' AND target_id = ${targetIdExpr})`

/** 累计下载次数。 */
export const gameDownloadCountSql = (gameIdExpr: string): string =>
  `(SELECT COALESCE(SUM(total), 0)::int FROM galrc_stat_windows WHERE kind = 'game_download' AND target_id = ${gameIdExpr})`

/**
 * 写时增量：把一次（或一批）事件累加进当前周窗口。
 *
 * - 单条语句完成，无读改写竞态：`ON CONFLICT … DO UPDATE SET total = total + excluded.total`；
 * - 同一批里的重复 target 先合并计数：一条 INSERT 里出现两行相同主键会直接报
 *   "ON CONFLICT DO UPDATE command cannot affect row a second time"；
 * - 窗口起点用 getWeekKey()（本地时区周一，周一当天仍记上一周），与排行榜读取口径
 *   完全一致，见 libs/time-window.ts。
 *
 * 调用方对写入失败的语义：浏览/下载计数属于旁路统计，业务方一律 `.catch()` 后
 * 放行，不要因为计数失败影响主流程。
 */
export async function bumpStatWindows(
  kind: StatKind,
  targetIds: string | readonly string[],
): Promise<void> {
  const ids = typeof targetIds === 'string' ? [targetIds] : targetIds
  const counts = new Map<string, number>()
  for (const id of ids) {
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  if (counts.size === 0) return
  const windowStart = getWeekKey()
  await db
    .insert(statWindows)
    .values(
      [...counts].map(([targetId, total]) => ({
        kind,
        targetId,
        windowStart,
        total,
      })),
    )
    .onConflictDoUpdate({
      target: [statWindows.kind, statWindows.targetId, statWindows.windowStart],
      set: {
        total: sql`${statWindows.total} + excluded.total`,
        updatedAt: sql`now()`,
      },
    })
}
