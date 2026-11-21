CREATE TABLE "galrc_ai_moderation_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"api_base" text DEFAULT 'https://api.openai.com/v1' NOT NULL,
	"api_key" text,
	"model" varchar(128) DEFAULT 'gpt-4o-mini' NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"temperature" real DEFAULT 0 NOT NULL,
	"timeout_ms" integer DEFAULT 20000 NOT NULL,
	"ban_threshold" real DEFAULT 0.85 NOT NULL,
	"auto_ban" boolean DEFAULT true NOT NULL,
	"check_comments" boolean DEFAULT true NOT NULL,
	"check_topics" boolean DEFAULT true NOT NULL,
	"max_content_length" integer DEFAULT 4000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "galrc_moderation_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_type" varchar(16) NOT NULL,
	"target_id" varchar(64) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"status" varchar(24) DEFAULT 'analyzing' NOT NULL,
	"verdict" varchar(16),
	"confidence" real,
	"reason" text,
	"model" varchar(128),
	"raw" jsonb,
	"error" text,
	"banned" boolean DEFAULT false NOT NULL,
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_galrc_moderation_queue_status_created" ON "galrc_moderation_queue" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_galrc_moderation_queue_user" ON "galrc_moderation_queue" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_galrc_moderation_queue_target" ON "galrc_moderation_queue" USING btree ("target_type","target_id");