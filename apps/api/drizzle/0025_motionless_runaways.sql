-- 0025：友情链接改为数据库表驱动（前台展示 + 后台增删 / 拖动排序）。
--
-- 关于本文件「只包含 friend-links 变更」的说明（便于追溯）：
--   drizzle-kit generate 本次还重放了 4 条 galrc_alistb 语句：
--     DROP INDEX "idx_galrc_alistb_display_id";
--     ALTER TABLE "galrc_alistb" ALTER COLUMN "display_id" SET NOT NULL;
--     CREATE UNIQUE INDEX "uq_galrc_alistb_display_id" ...;
--     CREATE UNIQUE INDEX "uq_galrc_alistb_kungal_id" ...;
--   根因：0024_melted_medusa.sql 当时被手工改过（display_id 收紧为 NOT NULL、非唯一索引
--   换成两个唯一索引），但 drizzle/meta/0024_snapshot.json 未同步更新，于是每次 generate
--   都会把这段差异重新重放一遍。其中 DROP 的目标索引 idx_galrc_alistb_display_id 在历史
--   迁移里从未创建过，原样执行会报错，故此处剔除。
--   alistb 的这些变更在 0024 的 SQL 里已经落地（线上库已有），因此剔除不影响任何环境；
--   同时 0025_snapshot.json 已把 alistb 快照修正为与 0024 实际应用后的结构一致，
--   后续 generate 不会再重复重放这 4 条。
-- DDL 一律带 IF NOT EXISTS（docs/migration-journal.md 的幂等约定）：万一某环境的
-- schema 效果已存在但 __drizzle_migrations 缺行，重放本文件也不会中断整批迁移。
CREATE TABLE IF NOT EXISTS "galrc_friend_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"avatar" text,
	"href" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_friend_links_sort" ON "galrc_friend_links" USING btree ("sort_order","id");--> statement-breakpoint
-- 初始数据：前台友情链接（后台可增删 / 拖动排序，sort_order 决定展示顺序）。
-- 幂等：仅当表为空时插入。重跑本迁移不会重复写入，也不会覆盖后台已经改过的数据。
-- 可选列用 CAST(NULL AS text) 显式标注类型，避免 PG 把 VALUES 里的 NULL 推断成 unknown。
INSERT INTO "galrc_friend_links" ("title","avatar","href","description","sort_order")
SELECT * FROM (VALUES
  ('莱茵', '/telegram.png', 'https://t.me/RhineLibrary', '一个 Telegram Galgame 资源频道', 0),
  ('Steam 上的中文 Galgame', 'https://steamgalgame.com/usr/themes/SteamGalgame/static/img/favicon.png', 'https://steamgalgame.com', CAST(NULL AS text), 1),
  ('莉斯坦 ACG', 'https://www.limulu.moe/favicon.ico', 'https://www.limulu.moe', '一个简洁美观人性化的 ACG 资源站', 2),
  ('梓澪の妙妙屋', 'https://gal.games/favicon.ico?favicon.3wygzhz2hpu11.ico', 'https://gal.games', '梓澪の妙妙屋 - Galgame 资源库', 3),
  ('鲲 Galgame 论坛', 'https://www.kungal.com/favicon.ico', 'https://www.kungal.com', '世界上最萌的 Galgame 论坛! ', 4),
  ('Hikarinagi', 'https://www.hikarinagi.org/favicon.ico', 'https://www.hikarinagi.org', 'Hikarinagi 致力于为所有ACG爱好者提供一个交流和分享的平台! ', 5),
  ('TouchGal', 'https://cloud.touchgaloss.com/2024/06/8b9411844520240614204452.webp', 'https://www.touchgal.ink', 'TouchGal 是一个一站式 Galgame 文化社区。提供Galgame 论坛、Galgame 下载等服务。承诺永久免费, 高质量。为Galgame 爱好者提供一片净土！', 6),
  ('缘汐馆', 'https://cloudflareimgbed.mrqyj.qzz.io/file/%E7%BD%91%E7%AB%99%E7%9B%B8%E5%85%B3%E5%9B%BE%E6%A0%87/1788319940785_%E5%9B%BE%E6%A0%87.png', 'https://yxggal.top', CAST(NULL AS text), 7)
) AS v(title, avatar, href, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "galrc_friend_links");