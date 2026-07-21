CREATE TABLE "galrc_account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"idToken" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galrc_session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp with time zone DEFAULT now(),
	"ipAddress" text,
	"userAgent" text,
	"impersonatedBy" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "galrc_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "galrc_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" varchar(10) DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "galrc_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "galrc_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galrc_alistb" (
	"id" varchar(512) PRIMARY KEY NOT NULL,
	"vid" varchar(255),
	"other" bigint,
	"path" jsonb
);
--> statement-breakpoint
CREATE TABLE "galrc_article" (
	"id" serial PRIMARY KEY NOT NULL,
	"vid" varchar(255),
	"otherid" bigint,
	"author" text,
	"title" varchar(255),
	"content" text,
	"copyright" text,
	"type" varchar(255),
	"status" varchar(255) DEFAULT 'published' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "galrc_comments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"targetType" varchar(255) NOT NULL,
	"targetId" varchar(255) NOT NULL,
	"userId" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"type" varchar(255) NOT NULL,
	"parentId" varchar(255) NOT NULL,
	"rootId" varchar(255),
	"depth" integer NOT NULL,
	"replyToUserId" varchar(255),
	"status" varchar(255) NOT NULL,
	"feedbackStatus" varchar(255),
	"isPinned" boolean NOT NULL,
	"isWhispers" boolean NOT NULL,
	"lastReplyAt" timestamp,
	"meta" jsonb,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "galrc_media" (
	"hash" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"size" bigint NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"type" varchar(255) NOT NULL,
	"cover" boolean DEFAULT false NOT NULL,
	"thumb_hash" text
);
--> statement-breakpoint
CREATE TABLE "galrc_other_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"other_id" integer NOT NULL,
	"media_hash" text NOT NULL,
	"sort_order" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	"cover" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galrc_other" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" jsonb,
	"alias" text,
	"introduction" text,
	"description" text,
	"status" text
);
--> statement-breakpoint
CREATE TABLE "galrc_zhtag" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text,
	"alias" text,
	"description" text,
	"exhibition" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text,
	"width" integer,
	"height" integer,
	"c_votecount" integer,
	"c_sexual_avg" real,
	"c_sexual_stddev" real,
	"c_violence_avg" real,
	"c_violence_stddev" real,
	"c_weight" real,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "producers" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text,
	"lang" text,
	"name" text,
	"latin" text,
	"original" text,
	"alias" text,
	"description" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "producers_relations" (
	"id" text,
	"pid" text,
	"relation" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" text PRIMARY KEY NOT NULL,
	"gtin" bigint,
	"olang" text,
	"released" text,
	"voiced" integer,
	"reso_x" integer,
	"reso_y" integer,
	"minage" smallint,
	"ani_story" smallint,
	"ani_ero" smallint,
	"ani_story_sp" smallint,
	"ani_story_cg" smallint,
	"ani_cutscene" smallint,
	"ani_ero_sp" smallint,
	"ani_ero_cg" smallint,
	"ani_bg" boolean,
	"ani_face" boolean,
	"has_ero" boolean,
	"patch" boolean,
	"freeware" boolean,
	"uncensored" boolean,
	"official" boolean,
	"catalog" text,
	"engine" text,
	"notes" text,
	"title" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "releases_producers" (
	"id" text,
	"pid" text,
	"developer" boolean,
	"publisher" boolean,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "releases_titles" (
	"id" text,
	"lang" text,
	"mtl" boolean,
	"title" text,
	"latin" text,
	"main" boolean
);
--> statement-breakpoint
CREATE TABLE "releases_vn" (
	"id" text,
	"vid" text,
	"rtype" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"cat" text,
	"defaultspoil" smallint,
	"searchable" boolean,
	"applicable" boolean,
	"name" text,
	"alias" text,
	"description" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tags_vn" (
	"tag" text,
	"vid" text,
	"uid" text,
	"vote" integer,
	"spoiler" integer,
	"ignore" boolean,
	"lie" boolean,
	"notes" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vn" (
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"c_image" text,
	"image_url" text,
	"olang" text,
	"c_votecount" integer,
	"c_rating" real,
	"c_average" real,
	"length" smallint,
	"devstatus" smallint,
	"alias" text,
	"description" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vn_titles" (
	"id" text,
	"lang" text,
	"official" boolean,
	"title" text,
	"latin" text,
	"main" boolean,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "galrc_cloudflare" (
	"id" serial PRIMARY KEY NOT NULL,
	"a_email" text NOT NULL,
	"a_key" text NOT NULL,
	"account_id" text NOT NULL,
	"woker_name" varchar(255) NOT NULL,
	"url_endpoint" text,
	"state" boolean DEFAULT true NOT NULL,
	"enable" boolean DEFAULT false NOT NULL,
	"duration" real DEFAULT 0 NOT NULL,
	"errors" bigint DEFAULT 0 NOT NULL,
	"requests" bigint DEFAULT 0 NOT NULL,
	"responseBodySize" bigint DEFAULT 0 NOT NULL,
	"subrequests" bigint DEFAULT 0 NOT NULL,
	"updateTime" timestamp
);
--> statement-breakpoint
CREATE TABLE "galrc_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"alias" varchar(255) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "galrc_collectionsItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" bigint NOT NULL,
	"game_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galrc_gameDownloadStats" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galrc_siteConfig" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"config" jsonb
);
--> statement-breakpoint
CREATE TABLE "galrc_search_nodes" (
	"parent" text,
	"name" text,
	"is_dir" boolean,
	"size" bigint
);
--> statement-breakpoint
CREATE TABLE "galrc_setting_items" (
	"key" text,
	"value" text,
	"help" text,
	"type" text,
	"options" text,
	"group" bigint,
	"flag" bigint,
	"index" bigint
);
--> statement-breakpoint
CREATE TABLE "galrc_storages" (
	"id" bigint PRIMARY KEY NOT NULL,
	"mount_panth" text,
	"order" bigint,
	"driver" text,
	"cache_expiration" bigint,
	"status" text,
	"addition" text,
	"remark" text,
	"modified" timestamp DEFAULT now(),
	"disabled" boolean,
	"disable_index" boolean,
	"enable_sign" boolean,
	"order_by" text,
	"order_direction" text,
	"extract_folder" text,
	"web_proxy" boolean,
	"webdav_policy" text,
	"proxy_range" boolean,
	"down_proxy_url" text
);
--> statement-breakpoint
ALTER TABLE "galrc_account" ADD CONSTRAINT "galrc_account_userId_galrc_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."galrc_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galrc_session" ADD CONSTRAINT "galrc_session_userId_galrc_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."galrc_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galrc_other_media" ADD CONSTRAINT "galrc_other_media_other_id_galrc_other_id_fk" FOREIGN KEY ("other_id") REFERENCES "public"."galrc_other"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galrc_other_media" ADD CONSTRAINT "galrc_other_media_media_hash_galrc_media_hash_fk" FOREIGN KEY ("media_hash") REFERENCES "public"."galrc_media"("hash") ON DELETE cascade ON UPDATE no action;