-- 0030：统计从「明细 + 读时聚合」改为「写时增量聚合」的计数窗口表。
--
-- 背景（线上只读诊断，2026-11）：
--   * galrc_event_views 4,540,104 行 / 569MB（heap 262MB + 索引 307MB）：
--     每次浏览写一行明细，「本周热榜」读时要 bitmap-scan 数十万到数百万行再聚合 30 条
--     （线上实测单次 360ms，games 列表 sortBy=views 同理），所以过去只能靠 Redis 缓存掩盖；
--   * galrc_gameDownloadStats 349,901 行 / 79MB，同样被读时聚合；
--   * galrc_stat_counters 0 行（TTL rollup 从未跑过），说明旧的两段式设计没有落地。
--
-- 新表 galrc_stat_windows 把「明细 + 读时聚合」换成「写时按 (kind, target_id, 周窗口) 自增」：
--   * 行数上限 ≈ 计数对象数 × 保留周数，不再随访问量增长；
--   * 写：INSERT … ON CONFLICT (kind, target_id, window_start) DO UPDATE SET total = total + n；
--   * 累计：SUM(total) WHERE kind = ? AND target_id = ?（主键前缀）；
--   * 周榜：SUM(total) GROUP BY target_id WHERE kind = ? AND window_start >= ?（kind_window_total）。
-- 历史数据由 scripts/backfill-stat-windows.ts 从旧明细表按周聚合回填（幂等），
-- 旧表定义暂时保留（先不删表），确认回填无误后再由后续迁移清理。
--
-- 索引取舍（本地按线上量级造数 + EXPLAIN (ANALYZE, BUFFERS) 实测）：
--   * 保留 (kind, window_start, total)：周榜与「终身累计」都走这条索引
--     （实测 viewAgg 9.5ms / hot 周榜 5ms，见报告）；
--   * 不加 (kind, target_id) INCLUDE (total)：与主键前缀重复，实测预热后
--     9.6ms vs 9.5ms（无差异），只会给每次浏览的 upsert 增加写放大；
--   * 不加 releases(id, released) / releases_vn(vid, id)：rel_agg 实测
--     13.97ms vs 13.87ms（无差异，Planner 仍选 Seq Scan + HashAggregate）。
--
-- 幂等约定（docs/migration-journal.md）：DDL 一律带 IF NOT EXISTS，重放不中止整批迁移。
CREATE TABLE IF NOT EXISTS "galrc_stat_windows" (
	"kind" varchar(32) NOT NULL,
	"target_id" varchar(255) NOT NULL,
	"window_start" date NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "galrc_stat_windows_kind_target_id_window_start_pk" PRIMARY KEY("kind","target_id","window_start")
);
--> statement-breakpoint
-- 周榜读取：WHERE kind = ? AND window_start >= ?；把 total 放进索引后，
-- 「近几周窗口」的扫描可以只读索引（index-only scan）。
CREATE INDEX IF NOT EXISTS "idx_galrc_stat_windows_kind_window_total" ON "galrc_stat_windows" USING btree ("kind","window_start","total");
