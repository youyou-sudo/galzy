CREATE TABLE "galrc_external_ids" (
	"kind" varchar(32) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"canonical_kind" varchar(32) DEFAULT 'vndb' NOT NULL,
	"canonical_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "galrc_external_ids_kind_external_id_pk" PRIMARY KEY("kind","external_id")
);
--> statement-breakpoint
ALTER TABLE "galrc_alistb" ADD COLUMN "anchor_kind" text DEFAULT 'vndb' NOT NULL;--> statement-breakpoint
ALTER TABLE "galrc_alistb" ADD COLUMN "kungal_id" text;--> statement-breakpoint
ALTER TABLE "galrc_alistb" ADD COLUMN "display_id" text;--> statement-breakpoint
-- 存量 backfill：现有行全部是 'vNNN' 锚点（id = vid = 展示身份）。
-- 有 vid 的行跟随 vid（大小写归一为小写），无 vid 的旧手工行退回锚点键 id。
UPDATE "galrc_alistb"
SET "display_id" = CASE
	WHEN "vid" IS NOT NULL AND "vid" ~* '^v[0-9]+$' THEN lower("vid")
	ELSE "id"
END
WHERE "display_id" IS NULL;--> statement-breakpoint
-- 不变量：每个展示身份只允许一行；同一 kungal work id（大小写不敏感）只允许一行。
-- display_id 必须收紧为 NOT NULL：PG 唯一索引视多个 NULL 互不相等，
-- 可空会让"每个展示身份只一行"这条不变量形同虚设。
ALTER TABLE "galrc_alistb" ALTER COLUMN "display_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_galrc_alistb_display_id" ON "galrc_alistb" USING btree ("display_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_galrc_alistb_kungal_id" ON "galrc_alistb" USING btree (lower("kungal_id"));--> statement-breakpoint
CREATE INDEX "idx_galrc_external_ids_canonical_id" ON "galrc_external_ids" USING btree ("canonical_id");
