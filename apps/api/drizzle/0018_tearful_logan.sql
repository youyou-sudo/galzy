ALTER TABLE "galrc_article" ADD COLUMN IF NOT EXISTS "contentType" text DEFAULT 'markdown' NOT NULL;
