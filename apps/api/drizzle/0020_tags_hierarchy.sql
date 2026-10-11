-- VNDB 标签层级支持。
--
-- Kuna API 的 POST /tag 不暴露层级（parent/parents/meta/children 均返回 400），
-- 层级只能取自官方 dump（https://dl.vndb.org/dump/vndb-tags-latest.json.gz），
-- 其中 id 为裸整数，对应本项目的 gN 形式。
--
-- 层级是 DAG 而非树：2479 个标签有 1 个父标签、490 个有 2 个、37 个有 3 个、
-- 3 个有 4 个（g10 "Terrorized by Monsters" 同时挂在 g2 "Fantasy" 与 g996 之下）。
-- 因此用边表而非 parent_id 单列，复合主键 (parent, child) 天然去重；
-- 实测 3582 条边、无环（最大深度 7），递归遍历安全。
--
-- meta=true 标识 5 个根标签（Theme/Character/Setting/Plot/Style）及其子类
-- 组织节点，applicable=false，不可直接标注到作品。
-- vn_count 为 VNDB 官方全站作品数，与站内 alistb 收录数口径不同。
--
-- 本文件由 `bun run db:generate --name tags_hierarchy` 生成，勿手工编辑语句
-- （例外：为使 0011–0020 的 when 修正后本文件可安全重跑，DDL 已加 IF NOT EXISTS。
--  背景见 docs/migration-journal.md）。
CREATE TABLE IF NOT EXISTS "tags_relations" (
	"parent" text NOT NULL,
	"child" text NOT NULL,
	"synced_at" timestamp with time zone,
	CONSTRAINT "tags_relations_parent_child_pk" PRIMARY KEY("parent","child")
);
--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "meta" boolean;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "vn_count" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tags_relations_parent" ON "tags_relations" USING btree ("parent");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tags_relations_child" ON "tags_relations" USING btree ("child");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tags_meta" ON "tags" USING btree ("meta");
