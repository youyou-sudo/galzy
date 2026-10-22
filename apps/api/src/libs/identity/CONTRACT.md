# 冻结接口契约 · kungal 一等锚点（kg 路由 + 别名表）

> 本文件是本次改动的**唯一接口真相**。任何要改的项目先读这里；契约变更必须由 Lead 改本文件并通知所有 owner。
> 状态：FROZEN v1（Lead 维护）

## 1. 展示身份（Display Identity）—— 全站唯一路由/统计键

```
DisplayId = `v${digits}`        // VNDB 锚点（优先）
          | `kg${kungalWorkId}` // kungal 锚点（无 vndb 锚点时）
```

- 规则：**只要作品有 vndb 锚点，展示身份就是 `vNNN`**；否则 `kgX`。`kgX` 永不作为已有 vndb 锚点作品的展示身份。
- 大小写（v1.1 修正）：`vNNN` 一律小写；`kgX` 的 X **以目录里的权威写法为准**——
  已知 work（`galrc_kungal_works.id`）用其原始写法，未知 work 统一小写。
  这样 `[kungal-New1]` 与 `[kungal-new1]` 不会算出两个展示身份。
- 路由 `/kgX` 与 `/vNNN` 都合法。API 在「请求 id ≠ 当前展示身份」时返回 `canonicalId`，前端 302 到 `/$id`。
- `event_views.target_id`、`galrc_gameDownloadStats.game_id`、Meili 文档 `id`、SEO/Cache-Tag、热榜 id **一律只用展示身份**。禁止再写 `alistb.id`（除非它恰好等于展示身份）。

## 2. `galrc_alistb` 新增列（只增列，不改主键）

| 列            | 类型      | 语义                                                         |
| ------------- | --------- | ------------------------------------------------------------ |
| `anchor_kind` | text      | `'vndb' \| 'kungal' \| 'other'`，默认 `'vndb'`               |
| `kungal_id`   | text null | 锚点 X（**原样大小写**，唯一索引 `lower(kungal_id)`）        |
| `display_id`  | text      | §1 的展示身份；非空且唯一，索引 `uq_galrc_alistb_display_id` |
- `id` 保持现状语义：**等于锚点键**（`vNNN` 或 `kgX`）。存量行 backfill：`anchor_kind='vndb'`, `kungal_id=NULL`, `display_id=id`。
- 不变量：apply 完成后，同一 `display_id` 只允许一行；同一 `lower(kungal_id)` 只允许一行。
- 不变量：`(anchor_kind='vndb')` ⇒ `display_id = vid = id`。

## 3. 新表 `galrc_external_ids`

```sql
CREATE TABLE galrc_external_ids (
  kind           text NOT NULL,   -- 'vndb' | 'kungal' | 'bangumi' | 'dlsite' | 'getchu' | …
  external_id    text NOT NULL,
  canonical_kind text NOT NULL,   -- 'vndb'（多数）| 'kungal'（kungal 合并，无 vndb 锚点）
  canonical_id   text NOT NULL,   -- canonical_kind='vndb' 时是 'vNNN'；'kungal' 时为 kungal work id
  created_at     timestamp,
  updated_at     timestamp,
  PRIMARY KEY (kind, external_id)
);
CREATE INDEX … ON galrc_external_ids (canonical_id);
```

- `(kind, external_id)` 大小写语义：写入/查询前 `kind` 小写；`external_id` 在 `kind='vndb'` 时小写，
  其它 kind 原样（kungal work id 语义由 `lower(kungal_id)` 兜底匹配）。
- 用途：① kungal / bangumi / dlsite / getchu / erogamescape / curated / steam → vndb 归一；
  ② 旧 `kgX` 链接永久可解析（`kind='kungal'`, `canonical_kind='vndb'`）；
  ③ **kungal 作品被合并但没有 vndb 锚点时**（`canonical_kind='kungal'`），
  否则网盘里仍叫 `[kungal-旧id]` 的目录会解析出与收口行不同的展示身份，下次扫描多出一条重复条目。
- 写入方：`kungal-sync`（refs 展开 + redirects 消费）、`cron` apply。查询方：`libs/identity` resolver、cron diff、vndb-sync。
- `linkAlias(kind, externalId, canonicalId, canonicalKind='vndb')`；`canonicalKind='kungal'` 时
  展示身份按 `kg${canonicalId}` 派生。

## 4. 解析器 API（`@api/libs/identity`）

```ts
export type AnchorKind = 'vndb' | 'kungal' | 'other'
export type DisplayId = string // 'vNNN' | 'kgX'

/** 单条：任意形态 id → 展示身份；不存在返回 null。 */
export function resolveDisplayId(id: string): Promise<string | null>

/** 批量：vndb 侧批量查 alistb/vn（保留 vndb 旧口径，读侧热路径用）。 */
export function resolveDisplayIds(ids: string[]): Promise<Map<string, string>>

/** 记录一条锚点别名（幂等 upsert）。kungal 侧大小写原样，vndb 侧小写。 */
export function linkAlias(
  kind: string,
  externalId: string,
  canonicalVid: string,
): Promise<void>

/** 纯函数：锚点 → 展示身份。upgradedVid 为外部已知的 vndb 锚点（可空）。 */
export function displayIdOf(
  anchorKind: AnchorKind,
  anchorId: string,
  upgradedVid?: string | null,
): DisplayId

/** 展示身份 → 路由身份校验（非法返回 null）。 */
export function parseDisplayId(raw: string): DisplayId | null
```

- `resolveDisplayId` 查找顺序：① `galrc_external_ids`（`kind='vndb'` 直取 / `kind='kungal'` 转 canonical）② `galrc_alistb.display_id`（按 `id` 或 `lower(kungal_id)`）③ `vn.id`（vndb 兜底）④ `null`。
- **入参 `id` 大小写**：`vNNN` 小写化；`kgX` 原样（大写 kungal id 由 `lower(kungal_id)` 索引命中）。

## 5. `/games` 响应契约新增字段

`GET /games?id=…` 的返回体新增：

| 字段          | 类型                            | 语义                                                              |
| ------------- | ------------------------------- | ----------------------------------------------------------------- |
| `canonicalId` | string                          | 本条目的展示身份（§1）。前端 `id !== canonicalId` ⇒ 302 到 `/$id` |
| `displayId`   | string                          | 同 `canonicalId`，供列表/卡片直接用作路由参数                     |
| `anchorKind`  | `'vndb' \| 'kungal' \| 'other'` | 当前锚点类型                                                      |
| `kungalOnly`  | boolean                         | `true` = 无 vndb 行，标题/封面/简介全部来自 `galrc_kungal_works`  |

kungal-only（`kungalOnly === true`）时：**`vn` 不是 null，而是由 kungal 数据合成的 vn 形状对象**
（`id` 为 null），这样详情页 / SEO / 卡片无需分支即可渲染。其余规则：`otherData` 可为 `null`；
`vn.titles` 取 `kungalWorkTitles`（按语言原样），`vn.alias` 取 `kungalWorks.displayName`，
`vn.image` 取 `kungalWorks.coverUrl/coverWidth/coverHeight/coverThumbhash`
（方向见下方「封面选取口径」），`vn.description` 取 `kungalWorks.intro`，
`released_first` 取 `kungalWorks.releasedFirst`，
`c_sexual_avg` 由 `contentRating='r18'` 映射为 1。
`Relations` 对 kungal-only 返回空数组（不 404），`OpenListFiles` 按展示身份取资源行。

**封面选取口径（全站统一，实现见 `libs/image-url` 的 `shouldUseKungalCover`）**：

```
竖版 kungal 封面  >  现有图（VNDB images）  >  横版 kungal 封面
```

- `hasUsablePortraitCover`：`url` 非空 + 宽高为正 + `height >= width`。
- `hasUsableCover`：只要求 `url` 非空 + 宽高为正（任意方向）。
- **有 VNDB 图时**只用竖版 kungal 封面覆盖（横版多为截图/横幅，属目录数据错误）。
- **没有 VNDB 图时**（kungal-only 条目、或 `vn.c_image IS NULL`）横版封面也必须采用 ——
  这里竖版门控只会让条目永远显示占位图，没有任何替代来源可回退。
- 因为横版可能被采用，消费方（web 卡片、Meili 文档）**必须按 `width/height` 自适应**，
  不能假定封面恒为竖版。

**work 行缺失时的兜底（§6.1 的水合尚未跑到时的降级路径）**：仍合成 `vn` 形状对象
（`id: null`、`image: null`、`titles: []`，或从 `alistb.path` 目录名推出一个占位标题），
**不得**省略 `vn` 键 —— 省略会让前端渲染出字面 `null`，并触发详情缓存的
「`vn` 键缺失就重建」判据导致该条目永久缓存不命中。

## 6. 扫描 / apply 契约（cron）

- 搜索关键词：`[vndb-` 与 `[kungal-` **两次并集**，按 `path` 去重后进 diff。同一次 lock / 同一次统计。
- 锚点提取（`cron/lib.ts`）：

  ```
  [vndb-v123]  → { kind:'vndb',  id:'v123' }
  [kungal-X]   → { kind:'kungal', id:'X' }   // 大小写不敏感匹配，id 原样
  [other-xxx]  → { kind:'other', id:'xxx' }
  ```
- 行产出：`{ id, vid, kungalId, anchorKind, displayId, path }`；`kungal` 锚点先查 `galrc_kungal_works.vndb_id`，命中则**直接产出 vndb 行**（`displayId = vndb_id`），未命中产出 `kgX`。
- apply 事务顺序（幂等，禁止"先 insert 后 delete 形成双行"）：
  1. upsert-by-anchor：按解析出的锚点**认领**已存在行（同名/改名），更新其 `path`/`vid`/`kungal_id`/`anchor_kind`/`display_id`；
  2. 对每个新 `display_id`，**删除**除被认领行之外、`display_id` 相同的旧行（改名收口，保证唯一）；
  3. 插入真正新增的行（`id = displayId`）；
  4. 最后才处理 stale/隐藏（沿用现有 `pathExists` 保守策略）。
- 升级路径（kungal → vndb）：同一行原地把 `id`/`vid`/`display_id` 从 `kgX` 改为 `vNNN`；旧的 `kgX` 先 `linkAlias('kungal', X, 'vNNN')`，解析器永久可 302。

## 6.1 kungal-only 条目的 work 行水合（`kungal-sync`）

扫描只负责落 `galrc_alistb` 行，**不**建 `galrc_kungal_works`。两者必须由 kungal-sync 对齐：
- 锚点来源两路，缺一不可：
  - `getAlistbVids()` —— `vid IS NOT NULL`，走 `refs=` 批量通道（vndb → work）；
  - `getKungalOnlyWorkIds()` —— `vid IS NULL AND kungal_id IS NOT NULL`，走 `ids=` 批量通道（kungal work id → work）。
- 不变量：**每个 `alistb.kungal_id` 都应有对应 `galrc_kungal_works` 行**。
  只有前者时，网盘先出现 `[kungal-X]` 目录、VNDB 侧尚无对应作品的条目永远拿不到行，
  详情页/列表/搜索全部降级为空壳（历史故障 `kg218897`）。
- 写库后必须同时刷新两个搜索文档通道：`syncGameBatchToMeili`（vn 驱动）+ `syncKungalOnlyBatchToMeili`（`kgX` 驱动）。后者以 `vn` 为主键的增量路径永远覆盖不到 kungal-only 条目。
- delta 口径：work 行缺失，或 `cover_url`/封面尺寸/`thumbhash` 不全时重新水合；齐全则跳过。

## 7. 读取侧统一规则

- 凡按 id 查条目：**先 `resolveDisplayId(id)`**，再按 `alistb.display_id = 展示身份` 查；`null` ⇒ 404。
- 凡列出条目：以 `alistb` 为驱动表，`leftJoin(vn, eq(vn.id, alistb.vid))`，`vn` 为空时回退 `kungalWorks`（按 `kungal_id` 或 `vndb_id`）。
- 凡做"有资源"判断（Meili 差集删除、计数、标签/厂商统计）：口径是 `display_id` 集合，不是 `vid` 集合。
- R18 门控：`vn` 缺失时用 `galrc_kungal_works.content_rating = 'r18'`；无法判定时按"非 R18"放行（与现网 `c_sexual_avg >= 1` 语义对齐）。

## 8. 写作用域归属（避免同文件双写）

| 文件 / 目录                                                                                                                         | 唯一 owner     |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `apps/api/drizzle/**`, `apps/api/src/db/schema/*`                                                                                   | Lead           |
| `apps/api/src/libs/identity/**`                                                                                                     | Lead           |
| `apps/api/src/modules/cron/**`                                                                                                      | Lead           |
| `apps/api/src/modules/vndb-sync/service.ts`（vid 口径）                                                                             | Lead           |
| `apps/api/src/modules/games/**`, `apps/api/src/modules/views/**`                                                                    | Lead           |
| `apps/api/src/modules/kungal-sync/**`, `apps/api/src/libs/kungal-api/**`                                                            | kungal-anchors |
| `apps/web-tanstack/src/routes/$id/**`, `apps/web-tanstack/src/server/game/index.ts`, `apps/web-tanstack/src/lib/game-id.ts`（新建） | web-route      |
| `apps/api/src/modules/tasks/**`（扫描文案/统计展示）                                                                                | tasks-panel    |

写入他人作用域前必须先发消息给 owner。
