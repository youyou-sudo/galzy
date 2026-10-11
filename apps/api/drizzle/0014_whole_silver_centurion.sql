CREATE TABLE IF NOT EXISTS "galrc_kungal_work_titles" (
	"work_id" text NOT NULL,
	"lang" text,
	"official" boolean,
	"title" text,
	"latin" text,
	"main" boolean
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "galrc_kungal_works" (
	"id" text PRIMARY KEY NOT NULL,
	"vndb_id" text,
	"olang" text,
	"medium" text,
	"content_rating" text,
	"released_first" text,
	"display_name" text,
	"localized" jsonb,
	"covers" jsonb,
	"intros" jsonb,
	"ratings" jsonb,
	"refs" jsonb,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'galrc_kungal_work_titles_work_id_galrc_kungal_works_id_fk'
      AND conrelid = 'galrc_kungal_work_titles'::regclass
  ) THEN
    ALTER TABLE "galrc_kungal_work_titles" ADD CONSTRAINT "galrc_kungal_work_titles_work_id_galrc_kungal_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."galrc_kungal_works"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_kungal_work_titles_work_id" ON "galrc_kungal_work_titles" USING btree ("work_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_galrc_kungal_work_titles_uniq" ON "galrc_kungal_work_titles" USING btree ("work_id","lang","title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_kungal_works_vndb_id" ON "galrc_kungal_works" USING btree ("vndb_id");
