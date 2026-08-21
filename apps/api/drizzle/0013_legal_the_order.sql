ALTER TABLE "galrc_account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "galrc_account" SET "issuer" = CASE
	WHEN "providerId" = 'credential' THEN 'local:credential'
	ELSE 'local:oauth:' || "providerId"
END
WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "galrc_account" ALTER COLUMN "issuer" SET NOT NULL;
