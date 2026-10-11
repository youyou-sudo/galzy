-- #12: 将论坛主题帖表(galrc_topics)合并进文章表(galrc_article)。
-- 帖子以 type='topic' 区分，author 列存发帖人 userId。
-- 帖子 id 与既有文章 id 会冲突，故先搬数据并改写点赞/收藏/评论引用，最后删旧表。
--
-- 幂等：meta/_journal.json 里 0011–0020 的 when 被修正为严格递增
-- （原先 0011–0020 的 when 小于 0010，会被迁移器静默跳过，详见 docs/migration-journal.md），
-- 修正后「已应用但日志缺行」的库可能重跑本文件。本文件是破坏性数据搬迁，
-- 因此以 galrc_topics 是否存在作为闸门：表已不存在 = 搬迁已完成 → 整体跳过，
-- 绝不可能把帖子重复搬进 galrc_article。
DO $$
DECLARE
  t RECORD;
  new_id integer;
BEGIN
  IF to_regclass('galrc_topics') IS NULL THEN
    RAISE NOTICE '0011: galrc_topics 已不存在（数据搬迁已完成），跳过';
    RETURN;
  END IF;

  FOR t IN SELECT * FROM "galrc_topics" ORDER BY "id" LOOP
    INSERT INTO "galrc_article" ("author", "title", "content", "type", "status", "createdAt", "updatedAt")
    VALUES (t."userId", t."title", t."content", 'topic', t."status", t."createdAt", t."updatedAt")
    RETURNING "id" INTO new_id;

    UPDATE "galrc_topic_likes" SET "topicId" = new_id WHERE "topicId" = t."id";
    UPDATE "galrc_topic_favorites" SET "topicId" = new_id WHERE "topicId" = t."id";
    UPDATE "galrc_comments" SET "targetId" = new_id::text
    WHERE "targetType" = 'topic' AND "targetId" = t."id"::text;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE IF EXISTS "galrc_topics" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "galrc_topics" CASCADE;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_article_type_status_created" ON "galrc_article" USING btree ("type","status","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_comments_status_pinned_created" ON "galrc_comments" USING btree ("status","isPinned","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_comments_rootid_depth" ON "galrc_comments" USING btree ("rootId","depth");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_collections_status" ON "galrc_collections" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galrc_collections_type" ON "galrc_collections" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tags_vn_tag_vid" ON "tags_vn" USING btree ("tag","vid");
