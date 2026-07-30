-- Enable pg_trgm extension for fast ILIKE search on producers
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for producers ILIKE search (producer/search.ts)
-- Replaces full table scan on producers.name / producers.latin with index scan
CREATE INDEX IF NOT EXISTS "idx_producers_name_trgm" ON "producers" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_producers_latin_trgm" ON "producers" USING gin ("latin" gin_trgm_ops);

-- Covering index for images: enables index-only scan for the common
-- SELECT id, height, width, c_sexual_avg FROM images WHERE id = $1 pattern
-- (used by game list, tag games, and MeiliSearch doc builder queries)
CREATE INDEX IF NOT EXISTS "idx_images_covering" ON "images" ("id") INCLUDE ("height", "width", "c_sexual_avg");
