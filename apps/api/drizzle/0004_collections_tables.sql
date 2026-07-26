-- Replace galrc_collections and galrc_collectionsItems with new schema
DROP TABLE IF EXISTS "galrc_collectionsItems";
DROP TABLE IF EXISTS "galrc_collections";

CREATE TABLE "galrc_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(20) DEFAULT 'manual' NOT NULL,
	"producer_ids" jsonb,
	"status" varchar(255) DEFAULT 'published' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE "galrc_collection_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" integer NOT NULL,
	"vid" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_collection_entries_collection_id" ON "galrc_collection_entries" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_collection_entries_vid" ON "galrc_collection_entries" USING btree ("vid");
