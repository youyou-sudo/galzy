ALTER TABLE "galrc_kungal_works" ADD COLUMN IF NOT EXISTS "cover_url" text;--> statement-breakpoint
ALTER TABLE "galrc_kungal_works" ADD COLUMN IF NOT EXISTS "cover_width" integer;--> statement-breakpoint
ALTER TABLE "galrc_kungal_works" ADD COLUMN IF NOT EXISTS "cover_height" integer;--> statement-breakpoint
ALTER TABLE "galrc_kungal_works" ADD COLUMN IF NOT EXISTS "intro" text;
