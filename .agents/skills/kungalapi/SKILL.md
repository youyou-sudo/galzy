---
name: kungalapi
description: NextMoe·未萌 开放 API v2（Kungalapi / 鲲 Galgame 数据）集成 —— 84 个公开端点，目录数据（works/characters/companies/credit-names/persons/tags/series/engines/traits）、发售日历、变更流、游玩时长、编辑提案、认领、封面投票、资讯、审核。应用于查询 ACGN/Galgame 目录、VNDB/bangumi/DLsite 外部 ID 反查、新作发售与日历、用户游玩时长上报与回拉、编辑提案、新闻源。
---

# Kungalapi — NextMoe·未萌 开放 API v2（鲲 Galgame 数据）

同一部作品在多个源（VNDB / Bangumi / DLsite / Getchu / ErogameScape …）各有一个页面，NextMoe 把多源记录**对齐成一条记录**，逐字段给出裁定后的标准答案，并附上答案取自哪个源（`source` 字段）。

- Base URL：`https://api.nextmoe.dev/v2`
- 文档：https://developer.nextmoe.dev/docs/v2
- MCP 端点：`https://mcp.nextmoe.dev/mcp`
- **正式公开（2026-08-25）**：84 个端点，任何应用在门户（https://developer.nextmoe.dev/dashboard）**自助铸造 `nmk_live_…` 密钥即可调用，无需申请**。
- 形状按 additive-only 演进（CI 的 oasdiff 门拦破坏性变更），删除与改名只会发生在 v3。
- **署名（必须）**：使用 Galgame 数据时标记 API 名为『鲲 Galgame 论坛』；使用同人游戏数据时标记为『LetMoe·一启萌』。

## When to Use

- 查询/搜索 ACGN 作品、角色、人物、署名（credit name）、厂牌、标签、系列、引擎、trait 目录
- 用外部 ID（vndb `v19658`、dlsite `RJ01234`、bangumi、steam …）经 `refs=` 批量反查本站作品
- 新作发售动态、按月/按年日历、待定档期、发售粒度时间线
- 用户游玩时长上报、批量同步、回拉、删除
- 提交目录编辑提案、追加 amendment、撤回；查询提案/修订历史
- 作品认领（claim）生命周期管理、封面投票、编辑图片上传
- 拉取 Galgame 资讯 feed 与来源列表
- 审核侧（需平台开通角色）：提案/认领裁决、回滚修订

## 鉴权（两种凭据，别混用）

| 凭据 | 用途 | 获取方式 |
|---|---|---|
| v2 应用密钥 `Authorization: Bearer nmk_live_…` | 所有公开读面（catalog、news、problems、vocabularies） | 门户**自助铸造**，带 CRC32 校验位；`nsfw=true` 需该应用启用 NSFW 能力 |
| 用户访问令牌 `Authorization: Bearer <access token>` | `/v2/me/*`（游玩时长、提案、认领、封面投票、我的资讯）与 `/v2/moderation/*`（审核）——读写的是**该用户自己的东西** | OAuth 授权码 + PKCE；**无需任何 scope** |

注意：`/v2/catalog/stats` 与 `/v2/problems`、`/v2/vocabularies` 连密钥都不要求（文档示例无 Authorization 头）。

## 客户端契约（必须遵守）

v2 无信封、无 `code` 字段——资源直接就是 body。错误是 RFC 9457 `application/problem+json`：

- `type` URI 解析到本站 `/problems/{domain}/{kebab-code}`，domain ∈ `platform|catalog|me|moderation|news`。
- 客户端必须**忽略未知字段**（加性演进，未来会加字段）。
- 客户端必须**容忍开放词表中未见过的取值**（OPEN 词表会加 token）。
- 客户端必须为**未知的错误 `code`** 准备一个按 HTTP `status` 的兜底分支（如 429 → 退避重试、401 → 重登、其他 → 结构化报错）。
- 机器可读文本是英文；id 是**十进制字符串**；数组和 map **永不 `null`**（空数组/空对象）。
- 常见错误码：`LIMIT_TOO_LARGE`（limit>100）、`UNKNOWN_INCLUDE`、`UNKNOWN_FIELD`、`UNKNOWN_FACET`、`NOT_FOUND`（404 是契约语义，见各节）。写端点还出 `409 Conflict`、`412 Precondition Failed`、`428 Precondition Required`（缺 If-Match）。

## 通用约定

### 列表端点统一形状（catalog 各族、news、proposals、revisions、problems 全共用）

公共查询参数：

| 参数 | 语义 |
|---|---|
| `cursor` | 不透明 keyset 游标，来自上次响应的 `next_cursor`，必须以 `cur_` 开头。省略 = 第一页 |
| `limit` | 1-100，默认 20。**超过 100 是 400 `LIMIT_TOO_LARGE`，不是 clamp** |
| `view` | `basic`（默认）\| `full`，CLOSED 词表 |
| `include` | 逗号分隔富化块；未知 token → 400 `UNKNOWN_INCLUDE` |
| `fields` | 逗号分隔顶层键（在 view/include 之后裁剪）；未知 → 400 `UNKNOWN_FIELD`；`object` 与 `id` 恒保留 |
| `ids` | 逗号分隔 id ≤100，**批量通道：无分页**，未命中的 id 进 `missing` |
| `refs` | 逗号分隔 `source:external_id` ≤100，批量通道；未命中进 `missing` |
| `include_total` | 传 `true` 才给 `total`（与 items 同一可见性门） |
| `facets` | 逗号分隔 facet 名；未知 → 400 `UNKNOWN_FACET`；只在请求时才出现 `facets` |
| `sort` | 每集合的 CLOSED 排序键 |
| `nsfw` | `true` 包含 r18（需 NSFW 能力）；`false`/省略剔除 r18；只接受 `true`/`false` |

响应形状（统一）：

```
{ "object": "list", "items": [...], "next_cursor": "cur_…" | 省略(末页),
  "facets"?: {...}, "total"?: int, "missing"?: string[] }
```

- `items` 恒为数组，绝不 null；`next_cursor` 在末页省略。
- 每个行对象都有 `object` 判别字段（`work` / `character` / `company` / `list` …），**用 `object` 判别，不要用 `display_name` / `latin` / `localized`**（这些「不得作为判别依据」）。

### 富化三件套：view / include / fields

- **默认瘦、按需胖**：默认只有基础字段（`display_name`、`localized`、`cover`、`release_date` 等）；`view=full` 展开人物/角色详情的次要字段（如角色的 `gender`、`birthday`、`blood_type`、`height_cm`、`weight_kg`、`measurements`、`instance_of_id`）。
- `include=` 按集合给出 token（works 面：`characters,companies,covers,credits,engines,intros,links,platforms,playtimes,popularity,ratings,refs,relations,releases,screenshots,series,tags,titles`；proposals 面：`amendments`（catalog 面唯一 token）、`patch`（仅 me/moderation 面发布）；revisions 面：`diff`）。
- `fields=` 在 view/include 之后进一步裁剪顶层键；`object` 与 `id` 恒保留。
- 每个族都有**批量通道**：`ids=`（按 id）或 `refs=`（按 `source:external_id`），≤100/次，未命中在 `missing` 里按序报告，不 404。

### NSFW 与内容分级（两个正交轴，别混淆）

- `nsfw=true`：是否包含 r18 **作品**，默认从 items/total/facets 一起剔除。
- `content_rating`：**年龄轴**（游戏本身分级）`all_ages|sensitive|r18`（r18 需同时 `nsfw=1`）。
- `content_limit`：**编辑展示轴**（封面/截图/简介是否可安全渲染）`sfw,nsfw`，CLOSED。多数 r18 游戏带编辑上安全的展示物料，按 `content_rating` 过滤会丢掉健康目录的大头——渲染素材过滤用 `content_limit`。
- 图片行带 `sexual`（`safe|suggestive|explicit`，null=未评估）与 `violence`（`tame|violent|brutal`，**当前恒 null，尚无行有评估**）。

### 词表（OPEN vs CLOSED，`/v2/vocabularies` 可发现）

- **CLOSED**（未知 token → 400；增减 token 是破坏性变更）：`medium`（`galgame,manga,novel,anime,asmr,doujin_game,music`）、`content_rating`、`sexual`、`violence`、`spoiler`（`none,minor,major`）、`gender`（`male,female,other`）、`blood_type`（`a,b,ab,o`）、`release_status`（`released,dated,announced,cancelled,unknown`）、`claim_state`（`none,live,draft,pending,declined,hidden`）、`content_limit`（`sfw,nsfw`）、`tier`（`core,longtail,hidden`）、`title_kind`（`official,alias,abbreviation`）、`alias_kind`、`roster_role`（`main,secondary,appears,unknown`）、`attribution_role`（`circle,publisher,developer,brand`）、`company_kind`（`game_brand,bunko,publisher,anime_studio,doujin_circle,group`）、`tag_kind`（`content,meta`）、`release_kind`（`default,digital,physical,trial,patch`）、`member_kind`（`unknown,main,fandisc,side_story,collection`）、`problem_domain`（`platform,catalog,me,moderation,news`）。
- **OPEN**（未知值 → 空结果/忽略，不是 400）：`sources`（19：`vndb,bangumi,dlsite,erogamescape,anilist,mal,steam,official_site,twitter,pixiv,curated,upscale,cien,dmm,web,getchu,derived,nextmoe,user`）、`relation_types`（16：`adaptation_of,sequel_of,side_story_of,fandisc_of,collects,remake_of,same_series,same_setting,crossover_with,shares_character,alternative_setting,alternative_version,imprint_of,renamed_from,subsidiary_of,member_of`）、`lang`/`olang`（BCP-47）、`site`、`platform`。
- `refs` 的 `source:external_id` 里 `web` 源的 external_id 是完整 URL；`vndb` 锚点形如 `v19658`（作品）与 `rNNN`（release）——筛作品 vndb id 时要滤掉 `rNNN`。

### 日期与发售状态

- 日期精度：`release_date_precision` = `day|month|year`；**月精度坐在 1 号、年精度坐在 1 月 1 日**。边界过滤注意 `released_after/before` 的包含关系。
- `release_status`（世界状态，区别于知识缺口）：`released|dated|announced|cancelled|unknown`；`release_date` 在 `announced/cancelled/unknown` 时为 null。
- 时间基准：日历默认 = 当前 **Asia/Tokyo** 月/年。

### 缓存与并发控制

- 列表端点带 ETag：`If-None-Match` 命中返回 **304**（表示未变，页面加载前短路）。
- 写端点（提案 patch、认领 patch、裁决）**必须带 `If-Match: <当前 ETag>`**；缺失 → 428，过期 → 412/409。

## 目录数据 API（只读）`/v2/catalog` — 45 端点

凭据：`Authorization: Bearer nmk_live_…`（`stats` 除外）。

### 检索

**`GET /v2/catalog/search`** — 跨族实体补全。`object`（**必填**，CLOSED）：`work|character|credit_name|company|tag`；`q` 空 = 该族按热度列全量；`locale`：`zh|ja`（**对 works 忽略**）。行是 `search_result`：带 `target_object`、`sources[]`；work 命中带 `content_rating`，tag 命中带 `tag_kind`/`tier`。

**`GET /v2/catalog/works`** — 作品列表/搜索两用：
- `q` 传了 = **切到搜索索引**，sort 默认 `relevance`；`q` 空 = 纯过滤浏览。VNDB-id 反查用 `refs=vndb:v19658` 批量通道表达。
- 过滤：`content_rating`、`claimed`、`claim_state`（逗号分隔取任意）、`content_limit`、`site`（租户键，OPEN，未知匹配空）、`company_id` + `company_rollup`（沿公司图谱向下一跳 imprint/subsidiary）、`tag_id`（≤10 AND）、`series_id`、`engine_id`、`platform`（OPEN）、`released_after/before`（YYYY-MM-DD 含端点，锚定每作品**最早** dated 发售）、`olang`（逗号 BCP-47 或 `all`，省略 = 不设语言门）。
- `sort`：CLOSED，`relevance`（有 q）/`popularity`/`released_desc`/`released_asc`/`updated`/`id` 等按集合定义。
- `nsfw`、`include`、`facets`、`include_total`、批量通道 `ids=`/`refs=`（≤100）。

### 作品行字段（work）

`object:"work"`、`id`（十进制字符串）、`display_name`（恒非空，不作判别）、`latin`（nullable）、`localized`（稀疏 BCP-47 map）、`medium`、`olang`、`content_rating`、`release_date`（nullable）、`release_date_precision`、`release_status`、`claim`（`{site, site_work_id, state: live|draft|pending|declined|hidden, content_limit}`）、`cover` + `banner`（`{hash,url,width,height,thumbhash,sexual,violence,source}`，url 恒为绝对地址）、`created_at`/`updated_at`（RFC 3339 UTC）。其余块经 `include=`：`titles`（含 `title_kind`、`is_machine`）、`intros`（含 `is_machine`）、`refs`（`{source, external_id}`）、`tags`（含 `is_sexual`、`spoiler`、`tier`、`tag_kind`）、`ratings`（`{source,score,vote_count,rank}`）、`playtimes`（`{source,minutes,vote_count}`）、`popularity`（`{source,metric,value}`）、`relations`（`{relation_type,phrase,work}`）、`releases`（行内嵌 `{id,date,lang,platform,platforms[],release_kind,title,refs}`）、`companies`（含 `attribution_role`、`company_kind`）、`characters`（含 `roster_role`、`spoiler`）、`credits`（`{role_key,role_name,credits[]}`）、`engines`、`series`（含 `member_count`）、`covers`（含 `portrait_pinned`、`vote_count`）、`screenshots`（含 `caption`）、`links`、`platforms`。

### 作品详情与子资源

**`GET /v2/catalog/works/{id}`** — 单作品；`nsfw`、`view`、`include`、`fields`。404 = 不存在/被隐藏（契约）。
**`GET /v2/catalog/works/{id}/…`** — 12 个子资源：`characters`、`covers`、`credits`、`engines`、`intros`、`links`、`ratings`、`relations`、`releases`、`screenshots`、`series`、`tags`。均走列表形状（含 `ids=`/`refs=` 批量通道）。

### 发售与日历

**`GET /v2/catalog/releases`** — 发售粒度时间线，行 = release（含移植/再版）：`{id, date(可空), lang, platform, platforms[], refs[], release_kind, title, work_id}`。`release_kind` 含 `trial`/`patch`（demo 与汉化补丁都在这里）。`sort`：`date_desc`（默认）|`date_asc`。

**`GET /v2/catalog/calendar`** — 单月/单年/待定档日历三合一：
- `month`：YYYY-MM（默认当前 Asia/Tokyo 月）；`year`：YYYY（默认当前 Asia/Tokyo 年）。
- `precision`：`day|month|year`——`year` 选年精度窗口；`day`/`month` 用 dated 月窗口。
- `status`：`released|dated|announced|cancelled|unknown`——`announced`/`unknown` 选**未定档窗口**；`cancelled` 当前为空（直到目录开始记录取消）。

### 人物族

**`GET /v2/catalog/characters`** — 角色列表；`view=full` 展开 `gender`、`birthday`（MM-DD，无年份）、`blood_type`、`height_cm`、`weight_kg`、`measurements`、`instance_of_id`。
**`GET /v2/catalog/characters/{id}`** — 角色身份；`GET /v2/catalog/characters/{id}/appearances` — 出场作品（含 `roster_role`、`spoiler`）。
**`GET /v2/catalog/persons`** — 人物列表：`{display_name, gender, primary_credit_name_id}`；`GET /v2/catalog/persons/{id}`、`GET /v2/catalog/persons/{id}/credit-names`。
**`GET /v2/catalog/credit-names`** — 署名（同人合并）列表，支持 `q` 名字搜索（空 = 按 id 列出）；行 `{display_name, latin, localized, person_id}`；`GET /v2/catalog/credit-names/{id}`、`GET /v2/catalog/credit-names/{id}/credits`（作品 + 职务）。
**`GET /v2/catalog/traits`** — trait（性格特征）词表：`{display_name, name_zh, is_sexual, vndb_tid}`（直通 VNDB trait id）；`GET /v2/catalog/traits/{id}`。

### 厂牌与标签

**`GET /v2/catalog/companies`** — 厂牌：`{id, display_name, latin, localized, company_kind, work_count}`；`GET /v2/catalog/companies/{id}`、`GET /v2/catalog/companies/{id}/graph` — 公司结构图（parent/imprint/subsidiary/renamed 连通族）。
**`GET /v2/catalog/tags`** — 规范化标签（跨源词表）：`{id, display_name, tag_kind, tier, work_count}`；`GET /v2/catalog/tags/{id}`。

### 系列与引擎

**`GET /v2/catalog/series`** — 系列列表（行只有 `id` + `display_name`）；**`GET /v2/catalog/series/{id}`** — 系列记录 + 成员（经 `include`，成员带 `member_kind`）。注意成员/系列行是简报，**不直接带 refs**——要 vndb 锚点对成员 id 走 `works?ids=<csv,≤100>&include=refs&nsfw=1` 批量水合，再从 refs 里筛 `source=vndb && /^v\d+$/`（滤掉 `rNNN` release 锚点）。
**`GET /v2/catalog/engines`** — 引擎列表（含 `work_count`）；**`GET /v2/catalog/engines/{id}`**。

### 变更流与统计

**`GET /v2/catalog/changes`** — 增量变更 feed（`updated_at` keyset，持续轮询）；行 `{id, target_object, updated_at}`，`target_object` ∈ `work|release|character|credit_name|person|company|tag|engine`。删除不流经该 feed。
**`GET /v2/catalog/redirects`** — id 收敛（merge）事件 feed：`{old_id, current_id, target_object, merged_at}`；`object=` 可按族过滤（CLOSED）。
**`GET /v2/catalog/stats`** — 目录计数：`{works, characters, companies, credit_names, persons}`。**无凭据、无参数**；r18 计入。

### 提案 / 修订 / 模式（编辑面只读侧）

**`GET /v2/catalog/proposals`** — 编辑提案历史（只读面）。`sort` 仅 `filed_desc`；`object=`（CLOSED：`work|company|character|release|tag|engine|series`）、`entity_id`（需 object=）、`site`（OPEN 租户）、`proposer_uid`、`state`（`open|merged|declined|withdrawn`）。`include=amendments` 是此面唯一 token（`patch`/`effective_patch` **只有 me 与 moderation 面发布**）。行 `{id, entity_id, entity_type, target_object, patch?, effective_patch?, amendments?, state, site, proposer_uid, decided_by_uid, base_revision_seq, created_at, updated_at, decided_at, note}`。`GET /v2/catalog/proposals/{id}` 读单条。
**`GET /v2/catalog/revisions`** — 实体修订史。`sort`：`recorded_desc`（默认）|`recorded_asc`；`object=`、`entity_id`、`site`、`actor_uid`；`include=diff`（唯一 token）。行 `{id, seq(1-based 连续), action: created|merged|direct|reverted, entity_id, target_object, site, actor_uid, amender_uid, proposal_id, changed_fields[], diff?, diff_base?}`。`id` 就是 `reverts` 要的 `revision_id`。`GET /v2/catalog/revisions/{id}` 读单条。
**`GET /v2/catalog/schemas/{object}`** — 一族可编辑字段模式（`work|company|character|release|tag|engine|series`，未知族 404）。行 `{target_object, entity_type, fields[], include[], full_set[], creation_disabled}`；字段 `{key, field_type: text|i18nmap|enum|int|date|list|ref|imagehash, diff_hint: inline|lines|items|image, max_elements, max_suppressed, deprecated}`。`creation_disabled` 在 release 上恒 true。

## 游玩时长 `/v2/me/playtimes` — 5 端点

凭据：**用户访问令牌**（无 scope 要求）。

- **`GET /v2/me/playtimes`** — 分页回拉；`work_ids=`（≤100）批量读通道。行 `{work_id, minutes}`（绝对累计分钟）。
- **`PUT /v2/me/playtimes/{work_id}`** — 替换本人某作品游玩时长，Body `{"minutes":0}`：**绝对累计分钟数，绝不是增量**；重发同数 = no-op，可安全重试。
- **`POST /v2/me/playtimes`** — 批量上报（Body 含 `items:[{work_id, minutes}]`）。
- **`GET /v2/me/playtimes/{work_id}`** — 本人单作品时长；从未上报 → **404**（判 404 而非判空）。
- **`DELETE /v2/me/playtimes/{work_id}`** — 删除本人某作品游玩时长。

## 编辑提案 `/v2/me/proposals` — 5 端点

凭据：**用户访问令牌**。第三方应用令牌恒为「只提案」姿态（审核/合入/撤销他人提案不可，走 moderation 面才可）。

- **`POST /v2/me/proposals`** — 以令牌用户本人身份提案。Body `{"entity_id":"…","entity_type":"catalog.work","note":"…","patch":{…}}`；`entity_type` 写编辑引擎类型（如 `catalog.work`），字段键/值先查 `GET /v2/catalog/schemas/{object}`。提议人与提交租户**从令牌派生**。引用类校验在**批准合并时**发生：保存成功 ≠ 能合入，裁决者 merge 时可能得 422。每人未决提案有帽（超限 429）。
- **`GET /v2/me/proposals`** — 本人提案史；`state` 过滤（`open|pending|merged|declined|withdrawn`）。
- **`GET /v2/me/proposals/{id}`** — 读单条（含 amendments 与 effective patch，`include=patch` 此面发布）。
- **`PATCH /v2/me/proposals/{id}`** — 修改自己 open 的提案：Body `{"patch":{…}}` 追加 amendment，或 `{"state":"withdrawn"}` 撤回。**必须带 `If-Match`**。
- **`POST /v2/me/proposals/{id}/amendments`** — 追加一条 amendment。

## 认领 `/v2/me/claims` — 4 端点

凭据：**用户访问令牌**。

- **`POST /v2/me/claims`** — 认领一个目录作品：给 `work_id`（认领已有作品）；或给 `refs:[{source,external_id}]` + `display_name`（refs 未命中时铸新行，可带 `site_work_id`）。Body 至少 `work_id` 或 `refs` 之一。
- **`GET /v2/me/claims`** / **`GET /v2/me/claims/{id}`** — 列/读本人认领；行 `{id(作品 id), display_name, state}`。
- **`PATCH /v2/me/claims/{id}`** — 移动自己认领的状态（**必须带 `If-Match`**）：`{"state":"live"}` 发布草稿、`"pending"` 提交审核、`"withdrawn"` 把 live/pending 撤回为草稿（`"draft"` 是 withdrawn 的旧拼写）。

## 封面投票与编辑图片

- **`GET /v2/me/cover-votes`** / **`PUT /v2/me/cover-votes/{cover_id}`**（投一票）/ **`DELETE /v2/me/cover-votes/{cover_id}`**（撤票）。封面行带 `vote_count`（净票数）与 `portrait_pinned`。
- **`POST /v2/me/edit-images`** — 为编辑提案上传图片（先传图拿到 hash 再写进 patch 的 `imagehash` 字段）。

## 我的资讯 `/v2/me/news` — 4 端点

凭据：**用户访问令牌**。**`GET`**（列）/ **`POST`**（提交，需合作站身份）/ **`GET {id}`** / **`PATCH {id}`**（编辑或撤回）。

## 资讯 API `/v2/news` — 3 端点

凭据：API 密钥（无需申请 scope）。

- **`GET /v2/news`** — Galgame 资讯 feed，上游发布时间新→旧。这是**索引不是转载**：每条仅标题/摘要/来源块 + `source_url`，**正文不下发也不留存**；渲染必须把来源与链接一并展示。行 `{id, title, summary, published_at, source:{name, display_name}, source_url}`。
- **`GET /v2/news/sources`** — 来源注册表。
- **`GET /v2/news/{id}`** — 单条资讯。撤回/上游原文消失 → **404 是契约**：不重试、不用缓存副本顶上。

## 审核 `/v2/moderation` — 8 端点

凭据：**用户访问令牌**，需平台开通审核角色；第三方应用令牌恒 `can_review=false`。

- **`GET /v2/moderation/proposals`** / **`GET /v2/moderation/proposals/{id}`** — 提案审核队列（含 `patch`/`effective_patch`）。
- **`POST /v2/moderation/proposals/{id}/decisions`** — 裁决：`{"decision":"merge"|"decline","note":"…"}`；merge 写 effective patch 并记录 revision，decline 关闭提案。**必须带 `If-Match`**。
- **`GET /v2/moderation/claims`** / **`GET /v2/moderation/claims/{id}`** — 认领审核队列。
- **`POST /v2/moderation/claims/{id}/decisions`** — 裁决认领。
- **`POST /v2/moderation/reverts`** — 回滚到某修订：`{"revision_id":"…","reason":"…"}`；`revision_id` 取 `GET /v2/catalog/revisions` 行的 `id`。
- **`GET /v2/moderation/snapshots/{object}/{id}`** — 实体当前已注册字段值快照（编辑器启动读）。

## 注册表

- **`GET /v2/problems`** — 全部顶层错误码（`code` UPPER_SNAKE、绑定的 HTTP `status`、`domain`、`title`、`type` URI）；**`GET /v2/problems/reasons`** — 字段级错误 reason；**`GET /v2/problems/{code}`** — 单条。
- **`GET /v2/vocabularies`** — 已发布词表清单（含 CLOSED/OPEN 标记与 token 数）；**`GET /v2/vocabularies/{name}`** — 单表。

## 本项目集成

- 本项目 kungal 调用封装在 `apps/api/src/libs/kungal-api/`（`client.ts` 请求封装 + `types.ts` 类型 + `normalize.ts` 归一化），密钥 env 为 `KUNGALAPI_KEY`（`nmk_live_…`），内置 20 req/s 令牌桶限流（平台免费但有防滥用限流，保持温和节奏）。
- 消费方：`apps/api/src/modules/kungal-sync/service.ts`（vndb 锚点 → kungal work 解析、批量水合、alistb vid 对照）。全量同步按 vid 走 `works?refs=vndb:<vid>` 批量通道（≤100/次），命中后核对 refs 锚点再入库。

## 典型用法

```bash
# 作品列表 + 搜索（含 r18，带 titles 与封面）
curl "https://api.nextmoe.dev/v2/catalog/works?q=素晴らしき日々&nsfw=true&include=titles,refs,covers&include_total=true" \
  -H "Authorization: Bearer nmk_live_<YOUR_KEY>"

# VNDB ID 批量反查（≤100/次；未命中在 missing，不 404）
curl "https://api.nextmoe.dev/v2/catalog/works?refs=vndb:v19658,vndb:v17&include=refs&nsfw=true" \
  -H "Authorization: Bearer nmk_live_<YOUR_KEY>"

# 本月日历（Asia/Tokyo），翻页
curl "https://api.nextmoe.dev/v2/catalog/calendar?month=2026-08&include=titles,refs" \
  -H "Authorization: Bearer nmk_live_<YOUR_KEY>"

# 上报游玩时长（绝对累计分钟，幂等）
curl -X PUT "https://api.nextmoe.dev/v2/me/playtimes/42" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"minutes":1800}'

# 提交编辑提案（先 GET /v2/catalog/schemas/work 查字段）
curl -X POST "https://api.nextmoe.dev/v2/me/proposals" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"entity_id":"42","entity_type":"catalog.work","patch":{"intro_zh":"…"}}'

# 认领作品（refs 未命中时铸新行）
curl -X POST "https://api.nextmoe.dev/v2/me/claims" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"refs":[{"source":"vndb","external_id":"v19658"}],"display_name":"…"}'
```

```typescript
// Bun / TypeScript（本项目栈）
const KEY = process.env.KUNGALAPI_KEY! // nmk_live_…
const base = 'https://api.nextmoe.dev/v2'

const r = await fetch(`${base}/catalog/works?refs=vndb:v19658&include=refs&nsfw=true`, {
  headers: { Authorization: `Bearer ${KEY}` },
})
if (!r.ok) {
  // RFC 9457：type 解析到 /problems/{domain}/{kebab-code}；未知 code 按 status 兜底
  const problem = await r.json()
  if (r.status === 429) return retryBackoff()
  throw new Error(`${problem.code} (${r.status}): ${problem.detail}`)
}
const list = await r.json() // { object:"list", items, missing?, next_cursor? }
```

## 关键坑速查

- 分页用 `cursor`/`next_cursor`，**不要自造页码**；limit>100 是 400 不是 clamp。
- 错误是 RFC 9457 `application/problem+json`，**没有信封、没有 code=0**；客户端必须忽略未知字段、容忍 OPEN 词表新值、按 status 兜底未知错误码。
- id 是**字符串**；判别类型用 `object` 字段，别用 `display_name`/`latin`/`localized`。
- `content_limit`（展示轴）≠ `content_rating`（年龄轴）；渲染安全过滤用前者。图片 `violence` 恒 null。
- 月精度日期坐在 1 号、年精度坐在 1 月 1 日：`released_after/before` 边界按此算。
- `works?refs=` 批量反查：未命中进 `missing`，**不是 404**；`works/{id}` 的 404 与 `news/{id}` 的 404 才是契约（不重试、不缓存顶上）。
- `changes` feed 无删除事件；合并（merge）走 `redirects`；镜像需定期对账全集。
- 游玩时长 body 是**绝对分钟**（幂等），不是增量；用用户令牌、无 scope。
- 编辑提案保存 ≠ 能合入（引用校验在 merge 时）；改/撤提案、认领状态、裁决都要 `If-Match`（428/412/409）。
- 系列/公司成员的 refs 拿不到——对成员 id 走 `works?ids=` 批量水合再筛 `source=vndb && /^v\d+$/`。
- 日历默认 Asia/Tokyo 月；待定档用 `precision=year` 或 `status=announced|unknown`。