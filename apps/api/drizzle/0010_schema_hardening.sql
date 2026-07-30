-- #10: Prevent runaway queries from exhausting the connection pool.
-- Queries exceeding 30s are aborted, protecting other requests.
ALTER DATABASE galzy SET statement_timeout = '30s';

-- #11: Add primary keys to tables that lack them.
-- searchNodes: unique per (parent, name) — natural composite key.
ALTER TABLE "galrc_search_nodes" ADD PRIMARY KEY ("parent", "name");
-- settingItems: unique per key — each setting key appears once.
ALTER TABLE "galrc_setting_items" ADD PRIMARY KEY ("key");

-- #13: Convert timestamp-without-timezone columns to timestamptz.
-- PostgreSQL stores both as UTC internally; the conversion preserves values.
-- Only app-managed tables (not Better Auth managed) are changed.

-- App tables
ALTER TABLE "galrc_comments"
  ALTER COLUMN "createdAt" TYPE timestamptz,
  ALTER COLUMN "updatedAt" TYPE timestamptz,
  ALTER COLUMN "deletedAt" TYPE timestamptz,
  ALTER COLUMN "lastReplyAt" TYPE timestamptz;

ALTER TABLE "galrc_cloudflare"
  ALTER COLUMN "updateTime" TYPE timestamptz;

ALTER TABLE "galrc_gameDownloadStats"
  ALTER COLUMN "created_at" TYPE timestamptz;

-- Alist mirror table
ALTER TABLE "galrc_storages"
  ALTER COLUMN "modified" TYPE timestamptz;

-- Custom field on Better Auth's users table (not managed by Better Auth)
ALTER TABLE "galrc_user"
  ALTER COLUMN "ban_expires" TYPE timestamptz;
