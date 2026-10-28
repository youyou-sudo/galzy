-- 0029：广告能力升级为行业通用模型「广告位（Slot）+ 素材（Creative）」。
--
-- 背景（上一版 0028）：
--   只有一张单表 galrc_adverts + 一个全局公开列表（GET /adverts 返回全部启用项），
--   「展示在哪里」是硬编码在模板里的，无法支持多个位置、排期、设备定向、权重与统计。
--   本次新增广告位表 galrc_ad_slots，并把 galrc_adverts 变成归属于某个广告位的素材：
--     + slot_id（归属广告位，级联删除）
--     + weight（权重，候选多于展示位时按权重抽取）
--     + device（设备定向 all/desktop/mobile，语义取代 show_on_mobile）
--     + start_at / end_at（排期，可空 = 立即开始 / 长期投放）
--     + impressions / clicks（曝光 / 点击计数）
--     - show_on_mobile（先按「false → desktop，否则 all」回填 device 后再删列）
--   索引：idx_galrc_adverts_sort → idx_galrc_adverts_slot_sort (slot_id, sort_order)
--
-- 本次改动只有「加法 + 一次语义等价转换（show_on_mobile → device）+ 一次删列」，
-- 不触碰任何其他表。
--
-- 幂等约定（docs/migration-journal.md）：
--   * DDL 一律带 IF NOT EXISTS / IF EXISTS；ADD COLUMN 先可空、回填后再 NOT NULL；
--   * 外键用 DO 块查 pg_constraint，已存在则跳过；
--   * show_on_mobile 的回填用 DO 块先判断列是否还存在（重放时列已删 = no-op）；
--   * 默认广告位用 ON CONFLICT (key) DO NOTHING，重放不重复插入、不覆盖后台改过的配置；
--   * 重放本文件（例如日志表缺行但 schema 效果已存在）不会中断整批迁移。
--
-- 注：drizzle-kit generate 分两遍产出（一遍纯加法、一遍纯删列）后手工合并为本文件，
--     避免生成器的「重命名 or 新增」交互式提问；meta/0029_snapshot.json 为最终结构。

-- ── 1. 广告位表 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "galrc_ad_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"max_items" integer DEFAULT 1 NOT NULL,
	"mobile_mode" varchar(16) DEFAULT 'carousel' NOT NULL,
	"carousel_interval" integer DEFAULT 5 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_galrc_ad_slots_key" ON "galrc_ad_slots" USING btree ("key");--> statement-breakpoint
-- 默认广告位：首页顶部横幅（与 0028 的现状保持一致：同屏 2 条、手机端轮播 5 秒）。
-- 幂等：key 已存在时跳过，不会覆盖后台已经改过的 name / max_items 等配置。
INSERT INTO "galrc_ad_slots" ("key","name","description","max_items","mobile_mode","carousel_interval","enabled")
VALUES ('home_top', '首页顶部横幅', '首页最上方的轮播广告位：桌面并排最多 2 条，手机端轮播', 2, 'carousel', 5, true)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

-- ── 2. 素材归属广告位：先加可空列 → 回填 home_top → 收紧 NOT NULL ──
ALTER TABLE "galrc_adverts" ADD COLUMN IF NOT EXISTS "slot_id" integer;--> statement-breakpoint
-- 回填：旧数据全部属于首页顶部广告位。home_top 由上一段保证存在；
-- 若某环境曾在后台删掉过该广告位（不应发生），子查询为 NULL，下面的 NOT NULL 会明确失败，
-- 而不是把素材静默挂到一个不存在的广告位上。
UPDATE "galrc_adverts"
SET "slot_id" = (SELECT "id" FROM "galrc_ad_slots" WHERE "key" = 'home_top')
WHERE "slot_id" IS NULL;--> statement-breakpoint
ALTER TABLE "galrc_adverts" ALTER COLUMN "slot_id" SET NOT NULL;--> statement-breakpoint
-- 外键：级联删除（删广告位 → 删素材）。已存在时跳过，保证重放安全。
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'galrc_adverts_slot_id_galrc_ad_slots_id_fk'
			AND conrelid = 'galrc_adverts'::regclass
	) THEN
		ALTER TABLE "galrc_adverts"
			ADD CONSTRAINT "galrc_adverts_slot_id_galrc_ad_slots_id_fk"
			FOREIGN KEY ("slot_id") REFERENCES "galrc_ad_slots"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint

-- ── 3. 素材新列 ────────────────────────────────────────────────
ALTER TABLE "galrc_adverts" ADD COLUMN IF NOT EXISTS "device" varchar(16) DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "galrc_adverts" ADD COLUMN IF NOT EXISTS "weight" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "galrc_adverts" ADD COLUMN IF NOT EXISTS "start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "galrc_adverts" ADD COLUMN IF NOT EXISTS "end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "galrc_adverts" ADD COLUMN IF NOT EXISTS "impressions" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "galrc_adverts" ADD COLUMN IF NOT EXISTS "clicks" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint

-- ── 4. show_on_mobile → device（语义等价转换，然后删列） ─────────
-- 旧语义「手机端是否展示」在新模型里由 device 表达：
--   show_on_mobile = false → 只在桌面展示（desktop）；否则全设备（all）。
-- 用 DO 块判断列是否还存在：迁移重放时列已删 → 整段 no-op。
-- WHERE device = 'all' 只覆盖默认值行，避免重放时覆盖后台手工设置过的定向。
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema()
			AND table_name = 'galrc_adverts'
			AND column_name = 'show_on_mobile'
	) THEN
		UPDATE "galrc_adverts"
		SET "device" = CASE WHEN "show_on_mobile" THEN 'all' ELSE 'desktop' END
		WHERE "device" = 'all';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "galrc_adverts" DROP COLUMN IF EXISTS "show_on_mobile";--> statement-breakpoint

-- ── 5. 索引：按位过滤 + 排序（顶替旧的全表 sort 索引） ────────────
DROP INDEX IF EXISTS "idx_galrc_adverts_sort";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_adverts_slot_sort" ON "galrc_adverts" USING btree ("slot_id","sort_order");
