CREATE TABLE "galrc_event_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" varchar(20) NOT NULL,
	"target_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_galrc_event_views_type_created" ON "galrc_event_views" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_galrc_event_views_type_target" ON "galrc_event_views" USING btree ("event_type","target_id");