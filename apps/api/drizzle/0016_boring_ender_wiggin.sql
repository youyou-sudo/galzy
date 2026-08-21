CREATE TABLE "vn_relations" (
	"id" text,
	"vid" text,
	"relation" text,
	"relation_official" boolean,
	"title" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_vn_relations_id" ON "vn_relations" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_vn_relations_vid" ON "vn_relations" USING btree ("vid");--> statement-breakpoint
CREATE INDEX "idx_vn_relations_id_vid" ON "vn_relations" USING btree ("id","vid");