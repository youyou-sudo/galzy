CREATE TABLE "galrc_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"status" varchar(255) DEFAULT 'published' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_galrc_topics_user_id" ON "galrc_topics" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_galrc_topics_status" ON "galrc_topics" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_galrc_topics_created_at" ON "galrc_topics" USING btree ("createdAt");