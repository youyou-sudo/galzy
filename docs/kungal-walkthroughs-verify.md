# Kungal 攻略（walkthrough）改造终验

> 终验时间：2026-11-04 22:20（Asia/Shanghai）。范围：**删除站内攻略文章 + 接入 kungal walkthrough（后端入库/同步/接口 + 前端三视图）**。
> 契约与 UI 依据见 [docs/kungal-walkthroughs-api.md](./kungal-walkthroughs-api.md)。
> 纪律：本任务只读，未改 `src`；未 commit；未起 dev server；本机 DB 不可达，**迁移未实际应用**（见 §6）。

## 0. 结论

**通过，可以提交。** 3 个改动方（后端 / 壳 / 图表）全部完成，typecheck、测试、lint 均符合预期，删除完整、迁移安全、契约与参考站语义对齐。

终验期间报出的 4 条问题，**3 条已在终验结束时修完并复跑通过**，1 条判为可选优化（不修）：

| 级别 | 数量 | 状态 | 摘要 |
| --- | --- | --- | --- |
| 必须修 | 1 | ✅ 已修 | web 任务字典缺 `kungal-walkthroughs`（显示裸 id + SLA 回落 30 分钟） |
| 建议修 | 2 | ✅ 已修 | 云缓存死代码/漏清 walkthrough；详情页 404 走通用错误页 |
| 可选 | 1 | 未采用 | 列表卡「整理自 {source}」显示上游 id（概览块已有 hostname 回退） |
| 记录 | 5 | — | 迁移未应用、registry 无需重跑、既有 lint 遗留、参考站列表页未采集、CDN s-maxage |

**修完后的复跑结果**（2026-11-04 22:28）：`tsc -p apps/web` 0 error；`bun --cwd apps/web test` **49 files / 377 tests 全过**；`bun --cwd apps/web lint` 0 error / 1 既有 warning；`tsc -p apps/api` 0 error。

---

## 1. 命令与结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| API 类型 | `bunx tsc --noEmit -p apps/api/tsconfig.json` | **0 error**（无输出，exit 0） |
| Web 类型 | `bunx tsc --noEmit -p apps/web/tsconfig.json` | **0 error**（exit 0） |
| Web 测试 | `bun --cwd apps/web test` | **49 files / 377 tests 全过**（含新增 `chart-stats.test.ts` 14、`walkthrough-list-page.test.tsx` 2、`walkthrough-page.test.tsx`、`order-view.test.tsx`、`graph-view.test.tsx`） |
| API check | `bun run --cwd apps/api check` | 「Checked 107 files，Found 1 error」→ **唯一 error 在 `apps/api/src/libs/identity/CONTRACT.md`（format，git 未修改的既有问题）**，本次改动文件 0 error |
| Web lint | `bun --cwd apps/web lint` | 「Found 1 warning and 0 errors」→ 唯一 warning 是既有 `src/pages/games/index.tsx:818 GamesPagePending` 未使用 |
| BFF registry | 复核是否需要重跑 `bun scripts/furin/gen-registry.mjs` | **不需要**：用同样的目录扫描 + 拼接逻辑在内存重算，产物与 `apps/web/src/server/registry.ts` **逐字节一致**（9118 B），新增的两个 handler id 已在表里 |

---

## 2. 必须修

### 2.1 管理端任务字典缺 `kungal-walkthroughs` —— ✅ 已修

- **文件**：`apps/web/src/lib/admin/tasks/labels.ts`（`TASK_TYPE_LABELS`）、`apps/web/src/lib/admin/tasks/sla.ts`（`SLA_MINUTES`）
- **现象**：后端已经完整支持这个任务类型（`apps/api/src/libs/queue/types.ts`、`modules/tasks/service.ts:1151` 分派、`modules/tasks/model.ts:72/92/108` 有中文名「Kungal 攻略同步」+ 优先级 P2 + **60 分钟** SLA），但 web 侧两张字典都没有它。后果：
  1. 管理端任务页把类型显示成裸的 `kungal-walkthroughs`（`taskTypeLabel` 对未知类型原样回显）；
  2. `slaMinutesFor()` 回落到 `DEFAULT_SLA_MINUTES = 30`，一次正常跑 40–60 分钟的攻略同步会被标成「已超时」（>60 分钟还会进 `stalled`）。
- **对照**：上一轮角色功能就补了 `"kungal-characters": "Kungal 角色同步"` / `60`，本次漏了同款。
- **修法**（两行）：
  ```ts
  // labels.ts → TASK_TYPE_LABELS
  "kungal-walkthroughs": "Kungal 攻略同步",
  // sla.ts → SLA_MINUTES
  "kungal-walkthroughs": 60,
  ```
- **owner**：web-walkthrough-shell。
- **修复**：`labels.ts:63` 增 `"kungal-walkthroughs": "Kungal 攻略同步"`，`sla.ts:33` 增 `"kungal-walkthroughs": 60`。复跑 web tsc / test / lint 全绿。

---

## 3. 建议修 / 可选

### 3.1 CDN 清理：死函数 + 漏清 walkthrough —— ✅ 已修（2026-11-04 22:26）

`apps/api/src/libs/cloudflare-cache.ts`

- `purgeArticlePages()` 已删除（全仓 0 引用，strategy 删除后是死代码）；
- `purgeGamePages()` 的 `/{gameId}/introduction` 已换成 `/{gameId}/walkthrough`（注释说明了「路由已不存在，继续清只白占配额」）。
- 复核：`bunx tsc --noEmit -p apps/api/tsconfig.json` → 0；`grep purgeArticlePages` → 仅本文档提及。
- **保留的取舍**：`purgeAfterSync()` 仍只清列表 + 首页，不同步精确清 `/{gameId}/walkthrough`——详情页 s-maxage=300 最坏 5 分钟自愈；而按 gameId 逐个精确 purge 会把 purge 调用量放大约 30 倍（Cloudflare 单次有 URL 上限），不划算。

### 3.2 攻略不存在的 404 走的是通用错误页 —— ✅ 已修

`apps/web/src/pages/[id]/walkthrough/[walkthroughId].tsx`

- loader 里 `if (!walkthrough) notFound({ message: "攻略不存在" })` 是**死分支**：BFF 的 `elysiaErrorF` 对 Eden 错误一律 `throw new ApiError(status, msg)`（`apps/web/src/lib/elysia-error.ts`），API 的 `Walkthrough.Info` 对不存在的 id `throw status(404, ...)`，所以 `walkthrough` 永远不会是 `null`。
- 实际表现：拿到 `ApiError(404)` → furin 错误页（`pages/error.tsx`）→ `<Errors code={404}>`，正文是「页面加载出错了，刷新或返回首页再试试喵～」，而不是「攻略不存在」。
- **修法**（二选一）：BFF 把 404 转成 `return null`（其余错误照抛），或 loader `catch` 到 `ApiError.status === 404` 时 `notFound()`。
- **owner**：web-walkthrough-shell。
- **修复**：走了第二种——loader 包 try/catch，`error instanceof ApiError && error.status === 404` → `notFound({ message: "攻略不存在" })`，其余错误继续抛。`if (!walkthrough) notFound()` 保留作为 BFF 改为返回 null 时的兜底。

### 3.3 列表卡的来源显示 id 而非站名 —— 未采用（可选）

`apps/web/src/components/walkthrough/walkthrough-list-page.tsx` 的 meta 行是 `整理自 {source}` → 显示 `整理自 seiya`；概览块的署名已经退到 `new URL(sourceUrl).hostname`（`walkthrough-overview.tsx` 的 `sourceNameOf`），列表卡没有同款回退。参考站显示的是「誠也の部屋」这类站名，但我们**有意不伪造**站名映射，所以这属于可选优化：列表卡建议复用 `sourceNameOf` 的 hostname 回退，至少不出现裸 id。
- **owner**：web-walkthrough-shell。**级别**：可选（不影响信息正确性）。
- **结论**：终验结束时未改。理由：`seiya` 本身是可读的来源标识，概览块已经给出 hostname，列表卡再显示一次域名属于重复信息；若后续有 source → 站名的权威映射（上游 `/v2/catalog/sources` 之类）再补更合适。

---

## 4. 删除完整性（重点项，逐条核过）

| 检查 | 方法 | 结果 |
| --- | --- | --- |
| `introduction` / `strategy` / `articles` / `articleHeroStore` / `api.strategy` / `strategylist` / `articles-page` / `/admin/articles` | 全仓 grep（api/web/packages） | **零悬空引用**。仅剩 3 处无关命中：`adverts-page/friend-links-page/searchable-tab` 的 dnd-kit `strategy={verticalListSortingStrategy}`、`db/schema/content.ts` 的无关列名 `introduction`、`api/`+`markdown/` 文档串 |
| BFF registry 残留 handler | 与生成器逐字节比对 | 一致，`introduction/*`、`admin/articles` 已不在表里；`game.getGameWalkthroughs` / `game.getWalkthroughInfo` 已注册 |
| 后台导航 / 仪表盘 / 个性化路径 | grep `admin-nav.ts`、`pages/admin/index.tsx`、`lib/is-personalized-path.ts` | 无 `articles` 残留（`PERSONALIZED_PREFIXES` 只剩 `/admin /user /auth`） |
| 路由类型 | `apps/web/furin-env.d.ts` | 无 `articles`/`introduction` 残留 |
| `galrc_article` 表 | `apps/api/src/db/schema/content.ts` + `modules/topics/service.ts` | **保留**，topics 仍以 `eq(articles.type,'topic')` 过滤（L27/170/184/322/336/472），迁移只删 `type='strategy'` 行 |
| 评论是否需要清理 | 全仓 grep `targetType` 字面量 | 只有 `'topic'`（topics×3）与 `'game'`（`pages/[id]/comment.tsx`）两个值，**没有 strategy 评论可删**，作者的判断正确 |

---

## 5. 迁移审查（`apps/api/drizzle/0032_colossal_lady_ursula.sql`）

- 结构：`CREATE TABLE galrc_kungal_walkthroughs`（17 列）+ FK `work_id → galrc_kungal_works(id) ON DELETE CASCADE` + `CREATE INDEX (work_id, upstream_updated_at)`。
- 数据：手写 `DELETE FROM galrc_article WHERE type = 'strategy'`（幂等，重跑不误删）。
- **没有** `DROP TABLE` / `DROP COLUMN`；**没有**动 `type='topic'` 的行；`_journal.json` idx 30→31→32 连续，`0032_snapshot.json` 已生成。
- 与 schema 定义逐列对照：一致（`workId` FK、`jsonb` 三块 `release/characters/chart`、三个 count、`upstream_updated_at`、`synced_at`）。

---

## 6. 契约一致性（后端 DTO ↔ 前端消费）

`WalkthroughSummaryDTO`（`apps/api/src/modules/walkthroughs/service.ts`）↔ `components/walkthrough/types.ts` 的 `readSummary`：

| API 字段 | 前端读取 | 结论 |
| --- | --- | --- |
| `id / workId / lang / source / sourceUrl / sourceAuthor / sourceUpdatedOn` | 同名（`workId` 只在 detail 用） | ✅ |
| `workContentLimit` | 未消费（列表/详情都不显示「本作品 R18」） | ✅ 允许（字段透传不丢） |
| `workRouteHints` | `workRouteHints` → 概览「游戏自带路线提示」徽章 | ✅ |
| `release.releaseKind` | `readRelease` 读 `record.releaseKind` → `kind` | ✅ 后端确实把 `release_kind` 改名成 `releaseKind` |
| `characters[].* / localized` | `characterId/displayName/localized` + `zhTextOf`（只认 `zh*` 前缀） | ✅ |
| `endingCount/saveCount/segmentCount` | `asCount`，chart 在时按数组长度兜底 | ✅ |
| `upstreamUpdatedAt` | `readSummary` 读 `upstreamUpdatedAt` → 视图 `updatedAt` | ✅ |
| `chart`（snake_case 原样） | `readWalkthroughDetail` 只做空值转换，`as unknown as WalkthroughChart` | ✅ 与 `chart/types.ts` 的 snake_case 定义逐字段对得上 |
| `chart: null` | `walkthrough-page.tsx` 渲染 EmptyState「暂无流程数据」 | ✅ 有明确空态 |
| 详情 404 | BFF 抛 `ApiError(404)`（见 §3.2） | ⚠️ 见建议修 |

> chart 内层字段（`step_type / from_node / character_keys / save_key / remark_localized / condition` …）在前后端之间**完全同名直通**，没有中间改名层；`chart/types.ts` 里的闭合词表与 spec 一致。

---

## 7. 同步正确性（`apps/api/src/modules/kungal-sync/service.ts` 的 `runWalkthroughStage`）

| 风险 | 代码事实 | 结论 |
| --- | --- | --- |
| 列表/详情的字段切分 | 列表只给标量，chart 只在详情 | ✅ 与 spec 一致 |
| 漏拉详情 | `needDetail` 三条：① `!prev`（本地无行）② `prev.updatedAt !== nextTs` ③ `!prev.hasChart`（上次详情失败） | ✅ 覆盖「新行/上游改过/历史上只写了列表行」 |
| `updated_at` 解不出 | 上游异常时 `nextTs = NaN`，与任何数比较都为不等 → 按「变了」处理 | ✅ 宁多拉不漏更 |
| **详情失败覆盖 chart** | 没有 chart 的行走**独立的 `plainValues` upsert**，`set` 里**没有 `chart`** | ✅ 关键点正确，不会把库里已有整棵树清成 NULL |
| 上游下线清理 | 只对本批 **listings 里成功返回的 work** 做 `delete ... where workId = ? and id not in (keep)` | ✅ 只作用本 work；某 work 拉列表失败时它不在 listings 里 → **不会误删** |
| 批内重复 id | `seen` 集合去重后再 upsert | ✅ 避免 `ON CONFLICT` 同语句二次命中 21000 |
| 单 work / 单批失败隔离 | 列表用 `Promise.allSettled`；详情也用 `allSettled`；外层 `try/catch` 只计数 | ✅ 一个作品超时不拖垮同批另外 9 个 |
| jsonb 二次编码 | `jsonbTextOrNull` → `JSON.stringify(...)::text::jsonb`；null 原样透传 | ✅ 与 works/characters 同口径 |
| 锁 | `kungal-sync-walkthroughs` 独立锁，与 works/characters 可并行、两次攻略同步不重叠 | ✅ 注释里也写了原因（否则互相删行） |
| 队列入口 | `POST /kungal-sync/walkthroughs`（isAdmin）→ `enqueue('kungal-walkthroughs')` → `tasks/service.ts` 分派 `syncWalkthroughs` | ✅ 全链路通 |

---

## 8. 页面语义对齐参考站（对照 `.tmp-wt/page2.txt` / `page3.txt` / `page4.txt`）

| 参考站 | 我们的实现 | 结论 |
| --- | --- | --- |
| 概览：制作会社 / 发售日期 | `walkthrough-overview.tsx`，制作会社取 **game.producers**（不是 release.companies） | ✅ 口径正确 |
| `13 个结局 · 7 个存档点 · 6 名角色` | `countItemsOf`，0 的项不显示 | ✅ |
| 返回游戏页面 / 查看原攻略页面 | 有；`sourceUrl` 为 null 时不渲染外链 | ✅ |
| 署名与「只保留了选项与存档结构，原文说明请查看原页面」+「中文为机器翻译」 | `attributionOf`（nextmoe/无 sourceUrl → 站内整理文案；zh 正文 → 不加机翻声明） | ✅ 文案对齐，语义更严谨 |
| 角色路线卡 `3 个结局 · 5 段` | `walkthrough-routes.tsx` + `chartStats.characters` | ✅ |
| 三视图「按角色 / 按顺序 / 流程图」 | `WALKTHROUGH_VIEWS` + `WalkthroughToolbar`，`?view=` | ✅ |
| 语言三档「双语 / 原文 / 中文」 | `WALKTHROUGH_LANGS` + `resolveText`（双语=中文主文+括注原文） | ✅ |
| 符号说明（legend，双语带原文） | `walkthrough-legend.tsx`「符号说明」 | ✅ |
| 路线概览条「本路线分 N 段, 点击跳到对应段落」+ 段号+起止+N 个选项 | `walkthrough-segments.tsx`（含 `segmentAnchorId` 滚动） | ✅ |
| 段落头三态：从【START】开始 / 读取「◆存档05」/ 接在「芳乃END」之后 | `chart-utils.nodeStartPhrase` | ✅ |
| 存档标记「在这里存档:「◆存档01」」不编号 | `order-view.tsx` | ✅ |
| 差分 CG 备选「差分 CG 回收时改选」不编号 | `order-view.tsx` | ✅ |
| heading（`■芳乃线`）后编号归零重排，编号跳过 heading/note/save | `chart-utils.stepNumbers` | ✅ 与实测 g1 的 1-8 → ■芳乃线 → 1-8 一致 |
| 结局徽章 个人线 / 后日谈 / 坏结局 | `endingTypeBadgeLabel`（只给实测过的三种上徽章） | ✅ |
| 段尾「回收 CG / 场景后结束」 | `order-view` / `nodeLabel` | ✅ |
| 流程图：「显示全部路线」开关、点边看选项、点节点看到达/去向、底部提示 | `graph-view.tsx` + `walkthrough-toolbar.tsx` + `walkthrough-page.handleGraphSegment`（先切到顺序视图再滚动，因为锚点只存在于 OrderView） | ✅ 语义对齐；**泳道几何未实测**（参考站 graph 是客户端渲染），按自己的实现走 |
| 「按角色」与「按顺序」共用段落卡片 | 两者都走 `WalkthroughSegments + OrderView`，仅 `characterKey` 过滤不同 | ✅ 与实测「两页 DOM 一致」吻合 |

未对齐但**有意为之**：参考站的「攻略评论」区没有做（站内文章下线后不再提供攻略编写/评论入口）——符合用户口径。

---

## 9. 上线后抽查 SQL

```sql
-- 1) 新表是否有行、chart 是否都落成真 jsonb（不是 jsonb 字符串）
SELECT count(*) AS rows,
       count(*) FILTER (WHERE chart IS NULL)               AS no_chart,
       count(*) FILTER (WHERE jsonb_typeof(chart) = 'object') AS chart_ok,
       count(*) FILTER (WHERE jsonb_typeof(chart) <> 'object') AS chart_bad
FROM galrc_kungal_walkthroughs;

-- 2) 列表字段与 chart 的计数是否自洽（上游 *_count 与数组长度应相等）
SELECT id,
       ending_count,  jsonb_array_length(chart->'endings')  AS endings_in_chart,
       save_count,    jsonb_array_length(chart->'saves')    AS saves_in_chart,
       segment_count, jsonb_array_length(chart->'segments') AS segments_in_chart
FROM galrc_kungal_walkthroughs
WHERE chart IS NOT NULL
  AND (ending_count <> jsonb_array_length(chart->'endings')
    OR save_count   <> jsonb_array_length(chart->'saves')
    OR segment_count<> jsonb_array_length(chart->'segments'));

-- 3) 站内攻略文章是否清干净（应为 0），论坛主题不受影响（应 > 0）
SELECT type, count(*) FROM galrc_article GROUP BY type;
SELECT count(*) FROM galrc_article WHERE type = 'strategy';   -- 期望 0

-- 4) 孤儿攻略（FK 应已拦住；DB 里若出现说明外键没建上）
SELECT w.id FROM galrc_kungal_walkthroughs w
LEFT JOIN galrc_kungal_works g ON g.id = w.work_id
WHERE g.id IS NULL;

-- 5) 本轮同步是否真的拉了详情（chart 覆盖率），以及最近的同步时间
SELECT count(*) FILTER (WHERE chart IS NOT NULL)::float / NULLIF(count(*),0) AS chart_ratio,
       max(synced_at) AS last_synced
FROM galrc_kungal_walkthroughs;
```

---

## 10. 记录项

1. **迁移未实际应用**：本机 DB 不可达，`0032` 只做了静态审查。上线前必须在目标库 `bun --cwd apps/api db:up`（bun-sql migrator，与启动自动迁移同一实现）；应用后跑 §9 的前两条 SQL。
2. **`gen-registry.mjs` 不需要重跑**：内存重算与现文件逐字节相同（见 §1）。
3. **既有遗留**（与本次无关，未处理）：`apps/api/src/libs/identity/CONTRACT.md` biome format 报错；`apps/web/src/pages/games/index.tsx` 未使用函数 `GamesPagePending`。
4. **参考站「攻略」页签列表未采集**（`.tmp-wt/page1` 只有站点头部），列表页是按我们自己的风格实现的，不与参考站逐像素对齐。
5. **CDN**：`/[id]/walkthrough(/[walkthroughId])` 命中详情页规则 `s-maxage=300`（`lib/cdn-cache.ts` L95-99，测试已覆盖），符合「详情 300s」口径；写后主动清的缺口见 §3.1。
