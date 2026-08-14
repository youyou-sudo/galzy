CREATE TABLE "galrc_queue_job" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"queue" varchar(64) NOT NULL,
	"type" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galrc_queue_job_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"level" varchar(8) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_queue_job_queue" ON "galrc_queue_job" USING btree ("queue");--> statement-breakpoint
CREATE INDEX "idx_queue_job_type" ON "galrc_queue_job" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_queue_job_status" ON "galrc_queue_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_queue_job_created_at" ON "galrc_queue_job" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_queue_job_log_job_created" ON "galrc_queue_job_log" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_queue_job_log_created_at" ON "galrc_queue_job_log" USING btree ("created_at");