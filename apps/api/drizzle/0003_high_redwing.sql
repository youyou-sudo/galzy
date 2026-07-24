CREATE TABLE "galrc_topic_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"topicId" integer NOT NULL,
	"userId" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "galrc_topic_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"topicId" integer NOT NULL,
	"userId" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_galrc_topic_favorites_topic_id" ON "galrc_topic_favorites" USING btree ("topicId");--> statement-breakpoint
CREATE INDEX "idx_galrc_topic_favorites_user_id" ON "galrc_topic_favorites" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_galrc_topic_favorites_unique" ON "galrc_topic_favorites" USING btree ("topicId","userId");--> statement-breakpoint
CREATE INDEX "idx_galrc_topic_likes_topic_id" ON "galrc_topic_likes" USING btree ("topicId");--> statement-breakpoint
CREATE INDEX "idx_galrc_topic_likes_user_id" ON "galrc_topic_likes" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_galrc_topic_likes_unique" ON "galrc_topic_likes" USING btree ("topicId","userId");