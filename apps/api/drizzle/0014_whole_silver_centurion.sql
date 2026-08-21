CREATE TABLE "galrc_kungal_work_titles" (
	"work_id" text NOT NULL,
	"lang" text,
	"official" boolean,
	"title" text,
	"latin" text,
	"main" boolean
);
--> statement-breakpoint
CREATE TABLE "galrc_kungal_works" (
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
ALTER TABLE "galrc_kungal_work_titles" ADD CONSTRAINT "galrc_kungal_work_titles_work_id_galrc_kungal_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."galrc_kungal_works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_galrc_kungal_work_titles_work_id" ON "galrc_kungal_work_titles" USING btree ("work_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_galrc_kungal_work_titles_uniq" ON "galrc_kungal_work_titles" USING btree ("work_id","lang","title");--> statement-breakpoint
CREATE INDEX "idx_galrc_kungal_works_vndb_id" ON "galrc_kungal_works" USING btree ("vndb_id");