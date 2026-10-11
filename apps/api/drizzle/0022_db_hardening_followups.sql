-- 数据库加固后续：累计计数表 + 若干列类型/约束修正。
-- 由 `bun run db:generate --name db_hardening_followups` 生成，手工补充了
-- 「迁移前清理」语句（幂等，老库脏数据不会阻断迁移）。

-- galrc_stat_counters：明细表（galrc_event_views / galrc_gameDownloadStats）被 TTL
-- 清理后，累计计数落在这里，保证「累计浏览量 / 累计下载次数」不因清理明细而下降。
CREATE TABLE "galrc_stat_counters" (
	"kind" varchar(32) NOT NULL,
	"target_id" varchar(255) NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "galrc_stat_counters_kind_target_id_pk" PRIMARY KEY("kind","target_id")
);--> statement-breakpoint

-- galrc_session.expiresAt 去掉 default now()：漏传时会退化成「创建即过期」。
ALTER TABLE "galrc_session" ALTER COLUMN "expiresAt" DROP DEFAULT;--> statement-breakpoint

-- galrc_user.role 放宽到 32：better-auth admin 插件支持逗号拼接的多角色。
ALTER TABLE "galrc_user" ALTER COLUMN "role" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "galrc_user" ALTER COLUMN "role" SET DEFAULT 'user';--> statement-breakpoint

-- galrc_alistb.other / galrc_article.otherid 由 bigint 收敛为 integer（= galrc_other.id
-- 的 serial/int4 类型），避免 int4 = int8 比较导致 galrc_other.id 索引失效。
-- 防御：超出 int4 范围的脏值不可能是合法关联，置空，避免 ALTER TYPE 失败阻断迁移。
UPDATE "galrc_alistb"
	SET "other" = NULL
	WHERE "other" > 2147483647 OR "other" < -2147483648;--> statement-breakpoint
ALTER TABLE "galrc_alistb" ALTER COLUMN "other" SET DATA TYPE integer;--> statement-breakpoint
UPDATE "galrc_article"
	SET "otherid" = NULL
	WHERE "otherid" > 2147483647 OR "otherid" < -2147483648;--> statement-breakpoint
ALTER TABLE "galrc_article" ALTER COLUMN "otherid" SET DATA TYPE integer;--> statement-breakpoint

-- galrc_queue_job_log.jobId 加外键（ON DELETE CASCADE），杜绝孤儿日志。
-- 防御：先删掉历史孤儿行，否则 ADD CONSTRAINT 会因既有脏数据失败、阻断启动。
DELETE FROM "galrc_queue_job_log" l
	WHERE NOT EXISTS (
		SELECT 1 FROM "galrc_queue_job" j WHERE j."id" = l."job_id"
	);--> statement-breakpoint
ALTER TABLE "galrc_queue_job_log" ADD CONSTRAINT "galrc_queue_job_log_job_id_galrc_queue_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."galrc_queue_job"("id") ON DELETE cascade ON UPDATE no action;
