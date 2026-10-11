-- #10: Prevent runaway queries from exhausting the connection pool.
-- Queries exceeding 30s are aborted, protecting other requests.
-- 库名不再写死（原为 `ALTER DATABASE galzy`：库名不同会让迁移直接失败、阻断启动）。
-- ALTER DATABASE 只对之后新建的会话生效，应用侧另在 src/db/client.ts 设置了 statement_timeout。
DO $$ BEGIN
  EXECUTE format('ALTER DATABASE %I SET statement_timeout = %L', current_database(), '30s');
EXCEPTION WHEN others THEN
  RAISE WARNING 'statement_timeout 设置失败（已忽略）：%', SQLERRM;
END $$;--> statement-breakpoint

-- #11: Add primary keys to tables that lack them.
-- searchNodes: unique per (parent, name) — natural composite key.
-- settingItems: unique per key — each setting key appears once.
-- 幂等 + 先去重 + 失败降级为告警：老库可能既缺主键又含重复行/空值，
-- 直接 ADD PRIMARY KEY 一旦失败会让整批迁移回滚、阻断启动。
DELETE FROM "galrc_search_nodes" a
USING "galrc_search_nodes" b
WHERE a.ctid < b.ctid
  AND a."parent" IS NOT DISTINCT FROM b."parent"
  AND a."name" IS NOT DISTINCT FROM b."name";--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'galrc_search_nodes_pkey'
  ) THEN
    ALTER TABLE "galrc_search_nodes" ADD PRIMARY KEY ("parent", "name");
  END IF;
EXCEPTION WHEN others THEN
  RAISE WARNING 'galrc_search_nodes 主键创建失败（已跳过）：%', SQLERRM;
END $$;--> statement-breakpoint
DELETE FROM "galrc_setting_items" a
USING "galrc_setting_items" b
WHERE a.ctid < b.ctid
  AND a."key" IS NOT DISTINCT FROM b."key";--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'galrc_setting_items_pkey'
  ) THEN
    ALTER TABLE "galrc_setting_items" ADD PRIMARY KEY ("key");
  END IF;
EXCEPTION WHEN others THEN
  RAISE WARNING 'galrc_setting_items 主键创建失败（已跳过）：%', SQLERRM;
END $$;--> statement-breakpoint

-- #13: Convert timestamp-without-timezone columns to timestamptz.
-- PostgreSQL stores both as UTC internally; the conversion preserves values.
-- Only app-managed tables (not Better Auth managed) are changed.

-- App tables
ALTER TABLE "galrc_comments"
  ALTER COLUMN "createdAt" TYPE timestamptz,
  ALTER COLUMN "updatedAt" TYPE timestamptz,
  ALTER COLUMN "deletedAt" TYPE timestamptz,
  ALTER COLUMN "lastReplyAt" TYPE timestamptz;--> statement-breakpoint

ALTER TABLE "galrc_cloudflare"
  ALTER COLUMN "updateTime" TYPE timestamptz;--> statement-breakpoint

ALTER TABLE "galrc_gameDownloadStats"
  ALTER COLUMN "created_at" TYPE timestamptz;--> statement-breakpoint

-- Alist mirror table
ALTER TABLE "galrc_storages"
  ALTER COLUMN "modified" TYPE timestamptz;--> statement-breakpoint

-- Custom field on Better Auth's users table (not managed by Better Auth)
ALTER TABLE "galrc_user"
  ALTER COLUMN "ban_expires" TYPE timestamptz;
