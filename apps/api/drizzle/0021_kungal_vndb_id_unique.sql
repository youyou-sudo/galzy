-- vndb_id 是对齐锚点，必须唯一：Meili 索引构建 / 列表排序 / 详情合并都用
-- `(SELECT … FROM galrc_kungal_works WHERE vndb_id = vn.id)` 标量子查询消费，
-- 一旦同一锚点出现多行会抛 21000 并整体打断索引构建。
--
-- 先做防御性去重（幂等）：同一 vndb_id 只保留 synced_at 最新的一行
-- （其次按 id 取较大者），其余删除（其 galrc_kungal_work_titles 由 FK 级联删除）。
-- 已干净的库此语句不删除任何行；NULL 锚点不参与去重（唯一索引允许多个 NULL）。
DELETE FROM "galrc_kungal_works" a
USING "galrc_kungal_works" b
WHERE a."vndb_id" IS NOT NULL
	AND a."vndb_id" = b."vndb_id"
	AND a."id" <> b."id"
	AND (COALESCE(a."synced_at", '-infinity'::timestamptz), a."id")
		< (COALESCE(b."synced_at", '-infinity'::timestamptz), b."id");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_galrc_kungal_works_vndb_id";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_galrc_kungal_works_vndb_id" ON "galrc_kungal_works" USING btree ("vndb_id");
