CREATE TABLE "galrc_kungal_walkthroughs" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"lang" text,
	"source" text,
	"source_url" text,
	"source_author" text,
	"source_updated_on" text,
	"work_content_limit" text,
	"work_route_hints" boolean,
	"release" jsonb,
	"characters" jsonb,
	"chart" jsonb,
	"ending_count" integer,
	"save_count" integer,
	"segment_count" integer,
	"upstream_updated_at" timestamp with time zone,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "galrc_kungal_walkthroughs" ADD CONSTRAINT "galrc_kungal_walkthroughs_work_id_galrc_kungal_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."galrc_kungal_works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_galrc_kungal_walkthroughs_work" ON "galrc_kungal_walkthroughs" USING btree ("work_id","upstream_updated_at");
--> statement-breakpoint

-- 下线站内攻略文章（用户口径：现有攻略文章删除、不再提供编写渠道）。
--
-- 只删 type='strategy' 的行，**不 DROP 表**：galrc_article 同时承载论坛主题
-- （topics 全部按 type='topic' 过滤，见 modules/topics/service.ts），删表会连带
-- 把论坛数据一起删掉。
--
-- 评论：galrc_comments.target_type 是全仓口径的自由字符串，但站内攻略文章从未
-- 开过评论区 —— 全仓 grep 只有 'game' / 'topic' 两个字面量（web 组件与 admin
-- 页同为这两值），因此这里没有需要一并清理的评论行。
--
-- 幂等：已删过的库重跑不删任何行（同一文件可能在「已应用但日志缺行」的库上重跑，
-- 见 docs/migration-journal.md）。
DELETE FROM "galrc_article" WHERE "type" = 'strategy';
