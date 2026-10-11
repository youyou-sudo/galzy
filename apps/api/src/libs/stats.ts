/**
 * 累计统计（浏览量 / 下载次数）的 SQL 片段工厂。
 *
 * galrc_event_views / galrc_gameDownloadStats 既是时间窗口排行榜的数据源，也是
 * 「累计」统计的数据源。TTL 任务（modules/tasks/service.ts）在删除过期明细前，
 * 会把即将删除的行按 (kind, target_id) 聚合进 galrc_stat_counters，因此
 *
 *   累计值 = galrc_stat_counters.total（已清理的历史） + 明细表剩余行数
 *
 * 用这个片段读取累计值，明细被清理后结果不会下降。
 *
 * 入参是 SQL 列引用表达式（如 'vn.id'），由调用方使用内部常量拼接，不接受用户输入。
 */

/** 累计事件浏览量（event_type: 'game_view' | 'tag_view'）。 */
export const eventViewCountSql = (
  eventType: 'game_view' | 'tag_view',
  targetIdExpr: string,
): string =>
  `(SELECT COALESCE((SELECT c.total FROM galrc_stat_counters c WHERE c.kind = '${eventType}' AND c.target_id = ${targetIdExpr}), 0) + (SELECT COUNT(*) FROM galrc_event_views e WHERE e.event_type = '${eventType}' AND e.target_id = ${targetIdExpr}))`

/** 累计下载次数。 */
export const gameDownloadCountSql = (gameIdExpr: string): string =>
  `(SELECT COALESCE((SELECT c.total FROM galrc_stat_counters c WHERE c.kind = 'game_download' AND c.target_id = ${gameIdExpr}), 0) + (SELECT COUNT(*) FROM "galrc_gameDownloadStats" d WHERE d.game_id = ${gameIdExpr}))`
