-- 任务列表 V2 的关键字搜索索引（q 参数）。
-- ilike '%kw%' 属于前导通配，btree 完全用不上；数据量小的时候 seq scan 还能忍，
-- 但列表 2s 轮询 + count + 分面三条查询会把它放大成三倍成本。pg_trgm 已由 0009 启用。
--
-- 与 0009/0023 同理：gin_trgm_ops 这类自定义 operator class 不写进 drizzle schema，
-- 因此手写（以后 db:generate 也不会试图重复创建或删除它）。
--
-- 本文件幂等（IF NOT EXISTS）：可能在「已应用但日志缺行」的库上重跑，见 docs/migration-journal.md。
CREATE INDEX IF NOT EXISTS "idx_queue_job_id_trgm" ON "galrc_queue_job" USING gin ("id" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_queue_job_type_trgm" ON "galrc_queue_job" USING gin ("type" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_queue_job_error_trgm" ON "galrc_queue_job" USING gin ("error" gin_trgm_ops);
