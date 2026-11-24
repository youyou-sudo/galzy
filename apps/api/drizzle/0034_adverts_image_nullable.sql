-- 0034：广告素材支持「纯文字」形态（image 可空），并新增顶栏导航广告位 header_nav。
--
-- 背景：顶栏最后一个导航格是推广入口（AI女友），此前写死在 nav-config.ts 里，
-- 改链接要发版、也没法统计。现在把它并入既有「广告位 + 素材」模型：
--   * 新广告位 header_nav（同屏 1 条、纯文字），前台读取 name + href 渲染成导航按钮；
--   * galrc_adverts.image 放开 NOT NULL：文字位没有图片，横幅位仍然必须配图
--     （横幅组件会跳过 image 为 NULL 的素材），因此不会渲染出破图。
--
-- 幂等约定（docs/migration-journal.md）：
--   * DROP NOT NULL 本身幂等（已可空时是 no-op）；
--   * 默认广告位 / 初始素材都用 ON CONFLICT 或 NOT EXISTS 守卫，重放不重复插入，
--     也不覆盖后台已经改过的链接与排序。

ALTER TABLE "galrc_adverts" ALTER COLUMN "image" DROP NOT NULL;--> statement-breakpoint

-- ── 顶栏导航广告位 ─────────────────────────────────────────────
-- 纯文字位：max_items=1（顶栏只有一格），mobile_mode 对文字位无意义但保持默认值。
INSERT INTO "galrc_ad_slots" ("key","name","description","max_items","mobile_mode","carousel_interval","enabled")
VALUES ('header_nav', '顶栏导航入口', '顶栏最右侧的推广入口：纯文字素材，只使用名称与跳转链接（图片可留空）', 1, 'carousel', 0, true)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

-- 初始素材：保持上线现状（顶栏的 AI 女友入口）。
-- 仅在 header_nav 下还没有任何素材时插入，重放不会覆盖后台改过的链接。
INSERT INTO "galrc_adverts" ("slot_id","name","image","href","description","enabled","device","weight","sort_order")
SELECT
  s."id",
  'AI女友',
  NULL,
  'https://www.yyai.online/explore/app/?ranking=recommended_rank&ref=4hbq',
  '顶栏推广入口（纯文字，不配图）',
  true,
  'all',
  10,
  0
FROM "galrc_ad_slots" s
WHERE s."key" = 'header_nav'
  AND NOT EXISTS (SELECT 1 FROM "galrc_adverts" a WHERE a."slot_id" = s."id");
