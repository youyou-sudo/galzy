-- 性能索引调整：用组合索引顶替欠覆盖的索引，并加 galrc_article.title 的 pg_trgm。
-- 本文件幂等（DROP/CREATE 都带 IF [NOT] EXISTS）：本文件可能在「已应用但日志缺行」
-- 的库上重跑，见 docs/migration-journal.md。
DROP INDEX IF EXISTS "idx_galrc_comments_rootid_depth";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_galrc_topic_favorites_user_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_galrc_topic_likes_user_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_collection_entries_collection_id";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_comments_target_status_pinned_created" ON "galrc_comments" USING btree ("targetType","targetId","status","isPinned" DESC NULLS LAST,"createdAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_comments_rootid_depth_created" ON "galrc_comments" USING btree ("rootId","depth","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_topic_favorites_user_created" ON "galrc_topic_favorites" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_topic_likes_user_created" ON "galrc_topic_likes" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_collection_entries_collection_sort" ON "galrc_collection_entries" USING btree ("collection_id","sort_order");
--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- 手工补充：galrc_article.title 的前导通配检索索引。
--
-- strategy/service.ts 用 like(articles.title, '%kw%')，前导通配无法走 btree，
-- COUNT 与分页两条查询各整表扫一遍。pg_trgm 已由迁移 0009 启用，这里补 GIN。
-- 与 0009 的 idx_producers_*_trgm 同理：自定义 operator class 不写进 drizzle
-- schema，因此手写（以后 db:generate 也不会试图重复创建或删除它）。
--
-- ⚠️ 遗留重复索引（galrc_alistb_vid_index / tags_id_index 等约 20 个）**刻意不放在这里**：
-- 它们由早期的外部建库脚本创建，本仓库的迁移链（0000–0022）从未创建过它们，
-- 因此全新数据库根本不会有。把它们写进迁移会导致「在一个事务里跨 10 多张表加
-- ACCESS EXCLUSIVE 锁」，与线上流量互相等待形成 deadlock（实测已复现）。
-- 清理动作改在 apps/api/scripts/drop-legacy-indexes.ts，逐条 DROP INDEX CONCURRENTLY。
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_galrc_article_title_trgm" ON "galrc_article" USING gin ("title" gin_trgm_ops);
