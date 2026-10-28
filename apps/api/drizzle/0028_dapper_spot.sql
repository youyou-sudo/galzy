-- 0028：顶部广告位改为数据库表驱动（前台读取启用项 + 后台增删 / 停用 / 拖动排序）。
--
-- 关于本次 generate 的输出（便于追溯）：
--   这次 drizzle-kit 只生成了 galrc_adverts 的两条语句，没有重放任何无关表差异
--   （0025 当时重放过 galrc_alistb 的四条语句，根因见 0025 文件头；0025 的快照对齐后
--   后续 generate 不再漂移，本次即为验证）。
--
-- DDL 一律带 IF NOT EXISTS（docs/migration-journal.md 的幂等约定）：
-- 万一某环境的 schema 效果已存在但 __drizzle_migrations 缺行，重放本文件也不会中断整批迁移。
CREATE TABLE IF NOT EXISTS "galrc_adverts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"image" text NOT NULL,
	"href" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"show_on_mobile" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_adverts_sort" ON "galrc_adverts" USING btree ("sort_order","id");--> statement-breakpoint
-- 初始数据：保持上线现状（顶部只有 DZMM AI 女友一张横幅）。
-- 幂等：仅当表为空时插入。重跑本迁移不会重复写入，也不会覆盖后台已经改过的数据
-- （例如后台把这张横幅停用或改了排序，重放不会把它改回去）。
INSERT INTO "galrc_adverts" ("name","image","href","description","enabled","show_on_mobile","sort_order")
SELECT * FROM (VALUES
  ('dzmm', '/dzmm.webp', 'https://umami.galzy.moe/q/KrhnTk4vg', 'DZMM AI 女友 · 顶部横幅', true, true, 0)
) AS v(name, image, href, description, enabled, show_on_mobile, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "galrc_adverts");
