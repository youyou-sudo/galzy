CREATE INDEX "idx_queue_job_queue_created" ON "galrc_queue_job" USING btree ("queue","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_queue_job_status_created" ON "galrc_queue_job" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_queue_job_type_created" ON "galrc_queue_job" USING btree ("type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_queue_job_queue_status_created" ON "galrc_queue_job" USING btree ("queue","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_queue_job_started_at" ON "galrc_queue_job" USING btree ("started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_queue_job_finished_at" ON "galrc_queue_job" USING btree ("finished_at" DESC NULLS LAST);