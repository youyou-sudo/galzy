---
name: kungalapi
description: NextMoe·未萌 开放 API（Kungalapi / 鲲 Galgame 数据）集成 —— 目录数据、外部 ID 反查、发售日历、游玩时长、编辑提案、Galgame 资讯。应用于查询 ACGN/Galgame 目录（works/characters/labels/tags/series/engines）、VNDB/bangumi/DLsite ID 反查、新作发售与日历、用户游玩时长上报与回拉、编辑提案、新闻源。
---

# Kungalapi — NextMoe·未萌 开放 API（鲲 Galgame 数据）

同一部作品在六个源（VNDB / Bangumi / DLsite / Getchu / ErogameScape …）各有一个页面，NextMoe 把多源记录**对齐成一条记录**，逐字段给出裁定后的标准答案，并附上答案取自哪个源。

- Base URL：`https://api.nextmoe.dev`
- 文档：https://developer.nextmoe.dev/docs
- MCP 端点：`https://mcp.nextmoe.dev/mcp`
- 免费，无付费档位，仅一层防滥用限流。
- **署名（必须）**：使用 Galgame 数据时标记 API 名为『鲲 Galgame 论坛』；使用同人游戏数据时标记为『LetMoe·一启萌』。

## When to Use

- 查询/搜索 ACGN 作品、角色、人物、厂牌、标签、系列、引擎目录
- 用外部 ID（vndb `v19658`、dlsite `RJ01234`、bangumi）反查本站作品
- 新作发售动态、按月/按年日历、待定档期
- 用户游玩时长上报、批量同步、回拉
- 提交目录编辑提案、查询提案状态
- 拉取 Galgame 资讯 feed 与来源列表

## 鉴权模型（三种凭据，别混用）

| 凭据 | 用途 | 获取方式 |
|---|---|---|
| API 密钥 `Authorization: Bearer nm_live_…` | 目录数据（`catalog:read`）、资讯（`news:read`） | https://developer.nextmoe.dev 控制台自助创建应用与密钥；自助可勾选 scope 只有 `catalog:read` |
| 用户访问令牌 `Authorization: Bearer <access token>` | 游玩时长（`playtime:read/write`）、编辑提案（`catalog:edit`）——读写的是**该用户自己的东西** | OAuth 授权码 + PKCE 授权后获得，不是 API 密钥 |
| 匿名 | `GET /v1/catalog/stats` 无需任何凭据 | — |

Scope 注意：
- `news:read` 是**授权制**：控制台提交申请并说明用途，批准后才可勾选；没有它调 `/v1/news` 一律 403。
- `catalog:edit` 准入需要两步：应用经 `user_login` 自助申请该 scope；client 还须由平台绑定目录租户（`catalog_site`）——目前人工开通，需联系平台。
- 第三方应用的令牌恒为「只提案」姿态：永远 `can_review=false`，审核/合入/撤销他人提案不可。

## 通用约定

### Keyset 分页（绝大多数列表端点）
- 请求带不透明 `cursor`（来自上一次响应的 `next_cursor`），**不是页码**。省略 = 第一页。
- 例外：`works/search` 用 `page`（1-based）；`characters/{id}` 用 `limit` + `offset`；`playtime/mine` 用 `updated_since`。
- `limit` 超上限会被 clamp（非正/非数字是 400），常见上限 100（`changes`/`redirects` 500，`news` 50，`characters` works 50，`search` 20）。

### `include=` 富化块
- works-list 行（works / works/search / calendar / releases 的父作品块）词汇：`names,intros,labels,ratings,covers,refs`（未知 token 忽略；默认都不带）。
- 详情面词汇：`relations,credits`（works/{id}）、`works`（characters/{id}、labels/{id}、tags/{id}、series/{id}）、`credits`（names/{id}）。
- `refs` = 作品在各源的**精确锚点**；`covers` 带宽高/thumbhash。

### NSFW 与内容分级（两个正交轴，别混淆）
- `nsfw=true/1`：是否包含 r18 **作品**。默认 false = 从 items、total、facets 一起剔除。`stats` 例外：r18 已计入（纯聚合，无渲染物）。
- `content_rating`：**年龄轴**（游戏本身分级）`all_ages|sensitive|r18`（r18 需同时 `nsfw=1`）。
- `content_limit`：**编辑展示轴**（封面/截图/简介是否可安全渲染）`sfw,nsfw`，CLOSED 词汇。多数 r18 游戏带编辑上安全的展示物料，按 `content_rating` 过滤会丢掉健康目录的大头——渲染素材过滤用 `content_limit`。
- `spoilers`（详情端点）：最大剧透等级 0-2，默认 0 = 安全；仅 VNDB 系词汇有剧透/性取向标记，Bangumi/DLsite folksonomy 恒为 0/false。

### 词汇表（OPEN vs CLOSED）
- CLOSED 词汇（未知 token → **400**）：`claim_state`、`content_limit`、`kind`、`facets`、`lane`、`labels.kind`、`sort` 等枚举。
- OPEN 词汇（未知值 → **空结果，不是 400**）：`olang`（BCP-47：`ja`、`zh-Hans`、`en`…）、`lang`、`platform`、`source`。
- `olang` 默认值不对称：`works/search` 默认**不过滤**（全语言）；`calendar` / `releases` / `calendar/pending` 默认收窄到 `ja + zh*` 家族。

### 精确锚点与 404 语义
- `lookup` 是 **EXACT** 反查：work 类型接受 `v19658` 或 `19658`、DLsite `RJ/VJ` 数字；非 work 类型按注册原样逐字匹配。未命中/被隐藏 → **404**。
- `works/search` 的 `q` 若**恰好**是 VNDB work id（`v19658`）会短路到精确锚点直取（避免前缀出血 `v1965` 也匹配 `v19650`）。
- 资讯 `news/{id}` 撤回/上游消失 → **404 是契约**：不重试、不用缓存副本顶上。
- 游玩时长从未上报 → `playtime` 为 `null` 的 **200**，不是 404。

### 其他
- 时间基准：日历默认 = 当前 **Asia/Tokyo** 月/年，响应回显 `month`/`year`。
- 日期精度：月精度发售被定位在其月**起始**（`2024-06` 在 `2024-06-00`，即 `2024-06-01` 之前）——`date_from=2024-06-01` 会排除它，`date_from=2024-05-31` 会包含。
- `releases` 与 `calendar` 携带 ETag（`If-None-Match` 命中 304，页面加载前短路）。
- `changes` feed 刻意落后实时 ~5 秒（statement time 非 commit time）；**删除不流经该 feed**，镜像消费者需定期用 `works?sort=id` 对账全集，合并消失走 `redirects`。

## 目录数据 API（只读）`/v1/catalog` — 25 端点

凭据：`Authorization: Bearer nm_live_…`，scope `catalog:read`（`stats` 除外）。

### 检索与反查

**`GET /v1/catalog/search`** — 实体补全（picker/跳转框）：最多 20 条扁平命中，单一族系，无过滤无分页。
- `type`：`names|characters|labels|works|tags`（works = 按任意标题搜全部 LIVE 注册作品；tags = 规范化跨源标签词表）
- `q`：空 = 最多 credit 的实体；`locale`：`zh|ja|en`（服务端钉住查询语言）；`limit`（≤20，clamp）；`nsfw`

**`GET /v1/catalog/works/search`** — 作品搜索页（过滤 + facet + 排序 + 分页 + 完整 works-list 行）。items 是 `PublicWorkListItem` **逐字** re-hydrated（含 include）；`total`、facets、items 是**同一个过滤集**的三个视图。
- `q`：任意索引标题/别名（含搜索提示）；空 = 纯过滤浏览按热度排
- 过滤：`content_rating`、`claimed`（true/false/缺省=both）、`claim_state`（`none,live,draft,pending,declined,hidden`，逗号分隔取任意，未知 400）、`content_limit`、`label_id`、`tag_id`（≤10 个 AND）、`series_id`、`engine_id`、`released_after/before`（YYYY-MM-DD 含端点，锚定每作品**最早**发售日）、`olang`
- `sort`：`relevance`（默认；空 q 退化为 popularity）| `released_desc/asc`（无日期的排在两向末尾）| `updated` | `popularity`（log1p(max(bangumi 收藏, DLsite 下载))）
- `facets`：`content_rating,olang,claimed,tag_id,label_id,engine_id,series_id,source`，每 facet ≤100 值，计数基于同一过滤集、按可回传的过滤值键控
- 分页：`page`（1-based，越界=空页）、`limit`（1-100，默认 20）；`nsfw`；`include`；`search_intro`（true 时 q 也匹配简介，标题命中恒优先，简介索引每语言截 2000 字符）

**`GET /v1/catalog/lookup`** — 外部 ID 精确反查（killer feature）。`source`：`vndb|bangumi|dlsite|erogamescape`（拼写错误 `erogamespace` 仍接受）；`external_id`（work 接受 vndb `v19658`/`19658` 与 DLsite RJ/VJ 数字；character `c1234`、label `p129`、staff 裸数字逐字匹配）；`type`：`work|name|character|label`（默认 work，未知 type=400，未知 source=miss）；`nsfw`（type=character 时同时保留性向 trait）。404 on miss/hidden。

**`POST /v1/catalog/lookup/batch`** — ≤100 对批量反查（每对可带 type），miss 按序返回 null 块。Body：`{"items":[{"external_id":"…","source":"…"}]}`。

**`POST /v1/catalog/resolve`** — 批量旧 id → canonical id（重定向展平）。Body：`{"entity_type":"…","ids":[0]}`。

**`GET /v1/catalog/redirects`** — id 收敛（merge）事件 keyset feed，用于存量 id 清理。`entity_type`：`person|name|label|character|work|release`；`cursor`；`limit`（1-500，默认 100）。

### 作品

**`GET /v1/catalog/works`** — LIVE 注册集（claimed + bodyless）keyset 浏览。`sort`：`id`（默认升序）| `updated`。
- 过滤：`content_rating`、`claimed`、`claim_state`（**live 注册谓词**，改动即时生效，无索引延迟——与 search 面相反）、`content_limit`、`status`（`live` 默认 / `pending` = 审核队列，需**双凭据**：OAuth 令牌在 Bearer + API 密钥在 `X-API-Key`，且强制作用域到自家租户，拒绝即 403 绝不降级）、`site`（租户过滤，未知 site 匹配空而非报错；search 面**不**接受此参数）、`label_id`、`label_rollup`（沿公司图谱向下一跳到 imprint/子公司，行带 `via_label`；spin-off 与 succession **不**跟随）、`tag_id`（≤10 AND）、`series_id`、`engine_id`、`platform`（vndb 平台码，release 级与 work 级行并集）、`released_after/before`、`ids`（≤100 批量水合）
- `cursor`、`limit`（1-100，默认 20）、`nsfw`、`include`

**`GET /v1/catalog/works/{id}`** — 冻结的作品记录（身份 + 标题 + 跨源精确 refs + claim 指针）。`include`：`relations,credits`；`nsfw`；`spoilers`。

### 发售与日历

**`GET /v1/catalog/releases`** — 发售粒度时间线：每条 dated release 一行（含移植/再版），`is_first` 区分真正新作 vs 老作再版（按作品全 dated 集计算，收窄 feed 不改变）。年精度与无日期发售**刻意缺席**（归 pending/tba）。
- `sort`：`date_desc`（默认）| `date_asc`；一日内 tiebreak id ASC 两向皆然；cursor 单向拒绝
- `date_from/date_to`：YYYY-MM-DD 含端点，**精度规则**见通用约定（月精度在 day 00）
- `olang`（父作品，默认 ja+zh*）、`lang`（发售语言，匹配 `COALESCE(release.lang, work.olang)`——dlsite/getchu SKU 恒命中其作品原语言）、`kind`（`default,digital,physical,trial,patch`；**默认只含前三者**——demo 与汉化补丁需显式请求；`kind=patch` 看本地化落地）、`official`（true=只显式非官方剔除；行缺 key 计为 official，false 恰好选那些行）、`platform`（主平台）
- `content_limit`、`cursor`、`limit`、`nsfw`、`include`（作用于附着作品块；release 自身 `refs[]` 恒在）
- 带 feed 级 ETag

**`GET /v1/catalog/calendar`** — 单月日历（最早 dated 发售落入该月的作品；月精度作品排月首不钉 1 号）。`month`：YYYY-MM（默认当前 Asia/Tokyo 月，回显）；`olang`（默认 ja+zh*）、`content_limit`、`cursor`、`limit`、`nsfw`、`include`。带 ETag。

**`GET /v1/catalog/calendar/pending`** — 一年内月份未知桶（最早发售仅知到年）。`year`：YYYY（默认当前 Asia/Tokyo 年）；其余同 calendar。

**`GET /v1/catalog/calendar/tba`** — 全局已宣布未定档桶（id ASC keyset）。参数同 calendar（无 month/year）。

### 角色与人物

**`GET /v1/catalog/characters/{id}`** — 角色身份。`include=works`（附作品及配音名）；`nsfw`（r18 作品 + 性向 trait）；`spoilers`；`limit`（1-50，默认 50）+ `offset`。

**`GET /v1/catalog/names/{id}`** — 署名身份（同人合并，public links）。`include=credits`（作品 + 职务）。

### 厂牌与标签

**`GET /v1/catalog/labels`** — keyset 浏览（id ASC）。`kind`：`game_brand|bunko|publisher|anime_studio|doujin_circle|group`（CLOSED）；`cursor`；`limit`；`nsfw`（影响 `work_count`，与 `works?label_id=` 可实际翻到的行一致）；`has_works`（true 只留 work_count>0，total 与过滤收敛）。

**`GET /v1/catalog/labels/{id}`** — 厂牌身份。`include=works`。

**`GET /v1/catalog/labels/{id}/relation-graph`** — 公司结构图：parent/subsidiary/imprint/spin-off/succession 连通族一次取回。

**`GET /v1/catalog/tags`** — 规范化标签（跨源词表）keyset 浏览（id ASC）。`tier` / `kind` 过滤；`cursor`；`limit`；`nsfw`（`work_count` 感知）。

**`GET /v1/catalog/tags/{id}`** — 标签身份（名称/tier/kind/intros）。`include=works`。

### 系列与引擎

**`GET /v1/catalog/series`** — keyset 浏览（id ASC），行带 nsfw-aware `work_count`。
**`GET /v1/catalog/series/{id}`** — 系列记录 + 源锚点 + intros；`include=works`（按阅读顺序附成员作品）。
**`GET /v1/catalog/engines`** — keyset 浏览（id ASC），行带 nsfw-aware `work_count`。
**`GET /v1/catalog/engines/{id}`** — 引擎记录：名称 + work_count + 跨源精确 refs。

### 变更流与统计

**`GET /v1/catalog/changes`** — LIVE 作品增量变更 feed，`(updated_at, id)` ASC keyset，`next_cursor` 恒在（持续轮询）。`entity_type`（仅 `work`）；`cursor`；`limit`（1-500，默认 100）。删除不流经，见通用约定。

**`GET /v1/catalog/stats`** — 目录计数：各 medium 的 LIVE 作品数 + 身份族总数。**无凭据、无参数**。`total` = `by_medium` 之和（不会不一致）；r18 计入。

## 游玩时长 API `/v1/playtime` — 5 端点

凭据：用户访问令牌，scope `playtime:write` / `playtime:read`。

**`PUT /v1/playtime/works/{workID}`** — 上报本人某作品游玩时长。Body `{"minutes":0}`：**绝对累计分钟数，绝不是增量**；重发同数 = no-op，可安全重试。按 `(user, work, client)` 键控——同一用户的第二个应用**并存**不覆盖。`playtime:write`。

**`PUT /v1/playtime/by-ref/{source}/{externalID}`** — 用外部 ID 定位作品上报（vndb/dlsite/getchu/bangumi…）。仅 EXACT 锚点可解析；响应回显解析出的 `work_id`，**客户端应缓存**；无锚点 → 404。`playtime:write`。

**`POST /v1/playtime/batch`** — 一次上报 ≤200 部（首次登录库同步）。Body `{"items":[{…, "minutes":0}]}`；逐项接受/拒绝，单项坏数据**不**拖垮整批，响应报告每项结果。`playtime:write`。

**`GET /v1/playtime/mine`** — 分页回拉本人游玩时长行（`updated_at` 序，二设备同步腿）。`cursor` 回传为 `?updated_since=`（RFC 3339）只取变更；省略 = 全量首拉。`playtime:read`。

**`GET /v1/playtime/works/{workID}`** — 本人单作品时长，跨应用**取 MAX**（两个应用盯同一个存档 ≠ 两遍通关）。从未上报 → `playtime: null` 的 **200**。评分表单「你玩过 30h，要挂上吗？」就用它。`playtime:read`。

## 编辑提案 API `/api/v1/user/catalog/edit` — 6 端点

凭据：用户访问令牌（OAuth 授权码 + PKCE），scope `catalog:edit`。第三方应用令牌恒 `can_review=false`。

- **每人未决提案帽 20**：第三方应用创建提案时该用户 open 已达 20 → **429**。
- 引用类校验在**批准合并时**发生：保存成功 ≠ 能合入，审核者批准时可能得 422。

**`GET /api/v1/user/catalog/edit/schema/{entity_type}`** — 字段 schema + **本令牌**评估的字段级能力（`entity_type` 如 `catalog.work`；`entity_id` 查询参数，0 = 类型级投影）。无任何 actor 查询参数——调用者不能问别的用户能做什么。

**`GET /api/v1/user/catalog/edit/snapshot`** — 实体当前已注册字段值（编辑器启动读）。已鉴权但**非租户隔离**：投影的是公开读取已渲染的同一实体态。

**`POST /api/v1/user/catalog/edit/proposals`** — 以令牌用户本人身份提案。Body：`{"entity_id":0,"entity_type":"…","patch":{…}}`；提议人与提交租户**从令牌派生**，body 不带。令牌角色已具审核能力时自动合入为直接编辑；**第三方应用颁发的令牌永不自动合入**。

**`GET /api/v1/user/catalog/edit/proposals`** — 列提案。`mine=true` = 本人提交史（无需权限）；省略 = **审核队列**，需该 entity_type 的审核权限（否则 403）。`site` 与 `proposer_uid` 都不是参数。

**`GET /api/v1/user/catalog/edit/proposals/{id}`** — 读单条提案（含 amendments 与 effective patch）；拒绝他租户的提案。

**`POST /api/v1/user/catalog/edit/proposals/{id}/withdraw`** — 撤回**自己**的 open 提案。无 body；引擎拒绝任何非本人提案。

## 资讯 API（授权制）`/v1/news` — 3 端点

凭据：API 密钥，**必须带 `news:read`**（授权制 scope，控制台申请批准后自助勾选；没有它一律 403）。

**`GET /v1/news`** — 合作站转载的 Galgame 资讯 feed，上游发布时间新→旧。这是**索引不是转载**：每条仅标题/摘要/题图 + 恒带的来源块与 `source_url`，**正文不下发也不留存**；渲染必须把来源与链接一并展示。两条 lane：`news`（短讯）/ `column`（长文），每条声明所属。
- `source`：逗号分隔来源键（`ymgal,galgame_hihyou`），省略或 `all` = 全部
- `lane`：`news,column`，未知 lane 拒绝（不静默空）
- `work_id`：只留锚定到该目录作品的条目
- `published_after/before`：RFC 3339，上游发布时间界
- `cursor`、`limit`（1-50，默认 20）

**`GET /v1/news/sources`** — 来源注册表：显示名、主页、专栏入口、发布者 uid、需渲染的署名文本。

**`GET /v1/news/{id}`** — 单条资讯。撤回/上游原文消失 → **404 是契约**：不重试、不用缓存副本顶上。

## 典型用法

```bash
# 作品搜索（含 r18，带名字与封面）
curl "https://api.nextmoe.dev/v1/catalog/works/search?q=素晴らしき日々&nsfw=1&include=names,covers&sort=popularity" \
  -H "Authorization: Bearer nm_live_<YOUR_KEY>"

# VNDB ID 反查
curl "https://api.nextmoe.dev/v1/catalog/lookup?source=vndb&external_id=v19658&type=work&nsfw=1" \
  -H "Authorization: Bearer nm_live_<YOUR_KEY>"

# 本月日历（Asia/Tokyo），翻页
curl "https://api.nextmoe.dev/v1/catalog/calendar?month=2026-08&include=names,covers" \
  -H "Authorization: Bearer nm_live_<YOUR_KEY>"

# 上报游玩时长（绝对累计分钟）
curl -X PUT "https://api.nextmoe.dev/v1/playtime/works/42" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"minutes":1800}'

# 提交编辑提案
curl -X POST "https://api.nextmoe.dev/api/v1/user/catalog/edit/proposals" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"entity_id":42,"entity_type":"catalog.work","patch":{"intro_zh":"…"}}'
```

```typescript
// Bun / TypeScript（本项目栈）
const KEY = process.env.NEXTMOE_API_KEY! // nm_live_…
const base = 'https://api.nextmoe.dev'

const r = await fetch(`${base}/v1/catalog/lookup?source=vndb&external_id=v19658&type=work`, {
  headers: { Authorization: `Bearer ${KEY}` },
})
if (r.status === 404) {
  // 未锚定或被隐藏——契约行为，不是查询失败
}
const work = await r.json()
```

## 关键坑速查

- 分页用 `cursor`/`next_cursor`，不要自造页码（除 `works/search`）。
- `content_limit`（展示轴）≠ `content_rating`（年龄轴）；渲染安全过滤用前者。
- 月精度日期在 day 00：边界过滤注意 `date_from`/`date_to` 的包含关系。
- `changes` 无删除事件、滞后 5 秒；`redirects` 管 merge；镜像需 `works?sort=id` 对账。
- `news/{id}` 与 `lookup` 的 404 是**契约**：不重试、不缓存顶上。
- 游玩时长 body 是**绝对分钟**（幂等），不是增量；batch 单败不毁整批。
- 编辑提案保存 ≠ 能合入（引用校验在批准时）；第三方令牌永不自动合入、恒 can_review=false。
- 日历/发售默认 `olang` 收窄到 ja+zh*；`works/search` 默认全语言——查询时显式传 `olang=all` 或具体值。
- 需要站点真实目录而非未发布草稿时传 `claim_state=live`（`claimed=true` 分不出 LIVE 与 DRAFT）。
