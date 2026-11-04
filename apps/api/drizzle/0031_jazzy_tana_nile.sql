CREATE TABLE "galrc_kungal_character_appearances" (
	"character_id" text NOT NULL,
	"work_id" text NOT NULL,
	"roster_role" text,
	"spoiler" text,
	"sort_order" integer,
	"synced_at" timestamp with time zone,
	CONSTRAINT "galrc_kungal_character_appearances_character_id_work_id_pk" PRIMARY KEY("character_id","work_id")
);
--> statement-breakpoint
CREATE TABLE "galrc_kungal_characters" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"latin" text,
	"lang" text,
	"localized" jsonb,
	"gender" text,
	"birthday" text,
	"blood_type" text,
	"height_cm" integer,
	"weight_kg" integer,
	"measurements" jsonb,
	"image_url" text,
	"image_width" integer,
	"image_height" integer,
	"image_thumbhash" text,
	"image" jsonb,
	"figure" jsonb,
	"intro" text,
	"intros" jsonb,
	"instance_of_id" text,
	"traits" jsonb,
	"refs" jsonb,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "galrc_kungal_character_appearances" ADD CONSTRAINT "galrc_kungal_character_appearances_character_id_galrc_kungal_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."galrc_kungal_characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galrc_kungal_character_appearances" ADD CONSTRAINT "galrc_kungal_character_appearances_work_id_galrc_kungal_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."galrc_kungal_works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_galrc_kungal_character_appearances_work" ON "galrc_kungal_character_appearances" USING btree ("work_id","roster_role","sort_order");