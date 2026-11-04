# Kungal 攻略（walkthrough）契约调研 + 参考站三视图 UI 语义

> 目标：把 NextMoe·未萌 开放 API v2 **walkthrough（攻略流程图）** 的数据模型、参考站（kungal.com）三种视图的 UI 语义，以及落库/消费建议写清，供后端建表/同步与前端渲染共用。
>
> 取证时间：2026-11-04。每条结论都标注来源：
>
> - **spec**：`OpenAPI 3.1.0 · NextMoe Public API v2 2.82.0`（`.tmp-wt/openapi.json`，978,328 字节，152 条 path / 297 个 schema，**未入库**）。
> - **实测**：参考站 kungal.com 的真实页面快照 `.tmp-wt/page1..4.html|txt`（**未入库**），以及从 `page2.html` 的 Nuxt `__NUXT_DATA__`（devalue）payload 里还原出的**真实 chart JSON**（`work_id=15 · 千恋＊万花 · walkthrough id=2804`，还原脚本见 §3.3）。样本全文另存 `.tmp-wt/walkthrough-2804.json`（临时文件）。
> - **推断**：既无 spec 也无实测支撑、只能从参考站交互文案反推的部分，单独标注，**别当契约用**。

---

## 0. 结论速查

| 问题 | 结论 | 依据 |
| --- | --- | --- |
| 只有哪个端点带 chart | **只有 `GET /v2/catalog/walkthroughs/{id}`**；列表 `GET /v2/catalog/walkthroughs` 的每个 item 都不含 chart | spec（chart 字段描述原文：*Present on GET /v2/catalog/walkthroughs/{id} only; absent on the collection*） |
| 一次拿一部作品全部攻略 | `GET /v2/catalog/walkthroughs?work_id=<kungal work id>&nsfw=true&limit=100`，游标翻页 | spec + 现有 client 已这么实现 |
| 详情怎么拿 | 只能逐条 `GET /v2/catalog/walkthroughs/{id}?nsfw=true`，**没有批量详情通道**（`ids=`/`refs=` 只走列表，照样不带 chart） | spec + **实测**（站点自身也是逐条水合） |
| r18 闸门 | `nsfw` 是**年龄轴**（content_rating）；`content_limit` 是**展示轴**（作品 editorial 分级）。二者独立，**大多数 r18 作品在 content_limit 上是 sfw**。所以「不给读者看成人内容」要传 `nsfw=true&content_limit=sfw`，**不是** `nsfw=false` | spec（原文明确写了这条） |
| 同步要不要传 nsfw | **传 `nsfw=true`**。否则 r18 作品的攻略整批 404/不出现 | spec + 现有 client 注释 |
| `localized` 的形状 | `{ "<BCP-47>": { value: string, is_machine: boolean } }`（`LocalizedText`），**不是** `{ zh: "文本" }` | spec（`LocalizedText` 定义）+ **实测**（样本逐字段一致） |
| 节点类型 | `node_type: entry \| save \| ending \| collect \| open`；`key` 在 `collect`/`open` 时**为 null** | spec + **实测** |
| 步骤类型 | `step_type: choice \| action \| save \| heading \| note`；`text` 只在 `save` 时为 null；`save_key` 只在 `save` 时非 null | spec + **实测**（样本 81 choice / 7 save / 13 heading，无 action/note） |
| key 的命名空间 | `sections[].key` / `segments[].key` / `saves[].key` / `endings[].key` / `entries[].key` / `characters[].key` 全是**chart 局部 key**（`s1`/`g1`/`sv01`/`e1`/`c1`），跨攻略不通用，**不能当全局 id 用** | spec + **实测** |
| chart 该不该拆表 | **不拆**。单表 + `chart jsonb` 原样透传（仓库里 `galrc_kungal_walkthroughs` 已按这个口径建好） | 见 §7 |
| 计数从哪来 | `ending_count` / `save_count` / `segment_count` 上游直接给标量，**不要**每次从 chart 现算 | spec + **实测**（13 / 7 / 15，与数组长度逐一吻合） |
| 参考站站点内部 DTO ≠ 公开 API | 站点自己的 payload 用 `route_sections / step_type→step_text / node_key / ending_name / text_lang / chart_segments…`，**公开 API 用的是另一套名字**。写代码一律以公开 API 为准 | **实测**（见 §4.1 对照表）——这是最容易踩的坑 |

---

## 1. 端点契约

### 1.1 `GET /v2/catalog/walkthroughs`（列表，**无 chart**）

| 名字 | 位置 | 必填 | 说明（spec 原文要点） |
| --- | --- | --- | --- |
| `work_id` | query | — | 目录作品 id（十进制字符串）。只要该作品的攻略 |
| `character_id` | query | — | 目录角色 id。只要 **chart 路由到该角色**的攻略 |
| `content_limit` | query | — | 逗号分隔的展示轴 `sfw,nsfw`，按**作品的** content_limit 过滤；不传则不过滤 |
| `nsfw` | query | — | `true` 才包含 r18；`false`/不传则隐藏 |
| `cursor` | query | — | 上一页的 `next_cursor`，必须以 `cur_` 开头 |
| `limit` | query | — | 1–100，默认 20；>100 是 **400 LIMIT_TOO_LARGE，不 clamp** |
| `ids` | query | — | 逗号分隔 ≤100。**批量通道，不分页** |
| `refs` | query | — | `source:external_id`，逗号分隔 ≤100，同样批量、不分页 |
| `view` | query | — | `basic`（默认）/`full` |
| `include` | query | — | 逗号分隔的块；未知 token → 400 UNKNOWN_INCLUDE |
| `fields` | query | — | 顶层字段裁剪；`object` `id` 恒保留；未知 → 400 UNKNOWN_FIELD |
| `include_total` | query | — | `true` 才回 total |
| `facets` | query | — | 分面；未知 → 400 UNKNOWN_FACET |
| `sort` | query | — | 每个 collection 的闭合排序键 |

- 排序：**按 id 升序**（keyset 分页）。
- 响应 `ListWalkthrough`：`{ object: "list", items: Walkthrough[], next_cursor?: string, total?: number, total_relation?: "eq"|"gte", missing?: string[], facets?: object }`。**`next_cursor` 在最后一页整体缺省**（不是 null）——判空要用 `if (!next_cursor) break`。
- 鉴权：匿名可用（按 IP 限流）；带 `Authorization: Bearer <KUNGALAPI_KEY>` 或 `catalog:read` 的 user token 限额更高。
- 304：表示表示未变，可用于条件请求（`If-None-Match`）；我们目前没存 ETag，不做。

### 1.2 `GET /v2/catalog/walkthroughs/{id}`（详情，**带 chart**）

| 名字 | 位置 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | path | ✅ | 十进制目录 id |
| `nsfw` | query | — | 同上；**r18 作品不传 `nsfw=true` 直接 404** |
| `view` / `include` / `fields` | query | — | 同上 |

- 200 → `Walkthrough`（含 `chart`）。
- **404 的两种含义**：攻略不存在，或**作品不可见**（r18 + 没开 nsfw）。对同步来说：`nsfw=true` 下仍 404 = 这条攻略被上游下线/合并了。
- spec 明确：`work_content_limit` 随行返回，正是为了让站点**自己决定要不要给读者看**，而不是让上游替你答 404。

---

## 2. 字段表（spec 权威 + 实测校验）

### 2.1 `Walkthrough`（顶层标量）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `object` | `"walkthrough"` | 类型判别 |
| `id` | string | 目录攻略 id（十进制字符串） |
| `work_id` | string | 目录作品 id |
| `lang` | string | **chart 里所有 text 字段的语言**（BCP-47）。导入的攻略是 `ja`；平台自写可能是 `ja`/`zh-Hans`。**`zh-Hans` 的 chart 不会在 localized 里出现 zh-Hans 条目** |
| `source` | string | 开放词汇：来源站名，或 `nextmoe`（平台自写）。**禁止当判别字段**（spec 反复强调） |
| `source_url` | string \| null | 原攻略页 URL（署名外链）。平台自写为 null |
| `source_author` | string \| null | 原页面署名作者，可能为 null |
| `source_updated_on` | string \| null | 原页面自称的最后更新**日期**（YYYY-MM-DD，不是时间戳） |
| `work_content_limit` | `"sfw"\|"nsfw"` | 作品的展示轴分级（与 `nsfw` 年龄轴独立，见 §0） |
| `work_route_hints` | boolean | 游戏**自带路线提示**。前端应先告诉读者这件事（否则读者可能不需要看攻略） |
| `release` | `WalkthroughRelease \| null` | 该攻略跟随的发行版（官方/汉化补丁，选项文本可能不同）。null = 不针对特定版本 |
| `characters` | `WalkthroughCharacter[]` | chart 路由到的角色，**按 chart 顺序**，恒为数组 |
| `ending_count` | integer | chart 里的结局数 |
| `save_count` | integer | 存档点数 |
| `segment_count` | integer | 段数 |
| `updated_at` | string | 该行上游最后变化时间（ISO 8601） |
| `chart` | `WalkthroughChart` | **只在详情端点出现** |
| `import_review` | `WalkthroughImportReview` | **只在 `/v2/me/walkthrough-backlog` 出现**，目录端点不返回，别建模 |

### 2.2 `WalkthroughChart`（六块，恒为数组，绝非 null）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sections` | `WalkthroughSection[]` | 原页面的分组标题，**通常一条路线一个** |
| `legend` | `WalkthroughLegendLine[]` | 原页面**对自己记号的定义**（如「★の選択肢は…」），按源顺序 |
| `entries` | `WalkthroughEntry[]` | 游玩起点：标题画面，或某结局解锁后的续玩入口 |
| `saves` | `WalkthroughSave[]` | 存档点声明（save 步骤建立、segment 从这里续） |
| `endings` | `WalkthroughEnding[]` | 结局，**每个出现位置一条**（同名重复算多个结局，key 才是身份） |
| `segments` | `WalkthroughSegment[]` | **边**：从一个节点走到另一个节点的一串步骤，按源顺序 |

### 2.3 六块子结构

```ts
WalkthroughSection { key, title, localized, character_keys: string[] }
WalkthroughLegendLine { text, localized }
WalkthroughEntry { key, label, localized, unlocked_by_ending_key: string | null }
WalkthroughSave { key, label, localized }
WalkthroughEnding { key, name, localized, ending_type, character_keys: string[] }
WalkthroughSegment {
  key, section_key: string | null,
  from_node: WalkthroughNode, condition: string | null, condition_localized,
  requires_ending_keys: string[], steps: WalkthroughStep[], to_node: WalkthroughNode
}
WalkthroughNode { node_type: "entry"|"save"|"ending"|"collect"|"open", key: string | null }
WalkthroughStep {
  step_type: "choice"|"action"|"save"|"heading"|"note",
  text: string | null, localized,
  alternatives: WalkthroughAlternative[],
  remark: string | null, remark_localized,
  achievement: boolean,
  save_key: string | null
}
WalkthroughAlternative { text, localized }
WalkthroughRelease { id, title: string|null, release_kind: "default"|"digital"|"physical"|"trial"|"patch", lang: string|null, companies: string[] }
WalkthroughCharacter { key, name, character_id: string|null, display_name: string|null, localized }
```

**闭合词表**（spec 标了 `x-vocabulary-closed`，新增值属破坏性变更，但读侧仍应容错）：

- `ending_type`: `heroine` | `harem` | `true` | `normal` | `bad` | `after` | `other`
- `node_type`: `entry` | `save` | `ending` | `collect` | `open`
- `step_type`: `choice` | `action` | `save` | `heading` | `note`
- `release_kind`: `default` | `digital` | `physical` | `trial` | `patch`（`patch` 含汉化补丁）
- `work_content_limit`: `sfw` | `nsfw`

**共享的 `LocalizedText`**（所有 `localized` / `condition_localized` / `remark_localized` 的值类型）：

```ts
type LocalizedText = { value: string; is_machine: boolean }   // 两个键都 required
type LocalizedMap = Record<string /* BCP-47 */, LocalizedText>  // 空对象表示「没有译文」
```

---

## 3. 真实 chart 样本

### 3.1 样本身份

| 项 | 值 |
| --- | --- |
| 作品 | `work_id = "15"`（千恋＊万花） |
| 攻略 | `id = "2804"`，`lang = "ja"`，`source = "seiya"`（誠也の部屋） |
| 规模 | 13 结局 / 7 存档点 / 15 段 / 6 名角色 / 步骤 101 条（81 choice、7 save、13 heading） |
| 原页面 | `https://seiya-saiga.com/game/yuzu-soft/senrenbanka.html`，`source_updated_on = 2020-02-15` |
| 上游 `updated_at` | `2026-10-31T22:40:45Z` |

### 3.2 提取方法（重要：站点内部 DTO 与公开 API **不同名**）

参考站是 Nuxt，页面数据在 `<script id="__NUXT_DATA__">` 里，用的是 **devalue** 扁平数组编码（`[{...}, "str", 12, ...]`，容器里出现的小整数是**下标引用**，标量元素才是字面量）。还原步骤：

1. 从 `page2.html` 取出 `__NUXT_DATA__` 的 JSON 文本（`page2.html` 是**部分下载**，尾部被截断，但 chart 在下标 259、很靠前，完整）；
2. 按「字符串感知的括号配平」把外层数组拆成元素，逐个 `JSON.parse`；
3. 下标解引用（Nuxt 的 `["ShallowReactive", n]` / `["Reactive", n]` 等 reducer 包装层剥掉）；
4. `payload.data["api:walkthrough:2804"].data` 就是 chart。

**关键发现**：站点自己的 DTO 用的是**另一套字段名**，与公开 API 不是一一对应（见 §3.3）。所以：**写我们自己的后端/前端一律以公开 API 的 spec 名字为准**，站点内部名字只能用来读参考站、理解 UI。

### 3.3 站点内部 DTO ↔ 公开 API 字段对照（实测）

| 站点内部（`__NUXT_DATA__`） | 公开 API（spec） | 备注 |
| --- | --- | --- |
| `chart.route_sections` | `chart.sections` | |
| `chart.chart_legend` | `chart.legend` | |
| `chart.entry_points` | `chart.entries` | |
| `chart.save_points` | `chart.saves` | |
| `chart.chart_endings` | `chart.endings` | |
| `chart.chart_segments` | `chart.segments` | |
| `steps[].step_text` | `steps[].text` | |
| `steps[].is_achievement_only` | `steps[].achievement` | 语义同为「该步给成就/奖杯」，**不是**「只用来做成就」 |
| `from_node.node_key` / `to_node.node_key` | `from_node.key` / `to_node.key` | |
| `endings[].ending_name` | `endings[].name` | |
| `walkthrough.text_lang` | `walkthrough.lang` | |
| `walkthrough.source_site` | `walkthrough.source` | |
| `walkthrough.source_page_url` | `walkthrough.source_url` | |
| `walkthrough.source_updated_date` | `walkthrough.source_updated_on` | |
| `walkthrough.has_in_game_route_hints` | `walkthrough.work_route_hints` | |
| `walkthrough.followed_release` | `walkthrough.release` | |
| `walkthrough.is_nsfw` | `walkthrough.work_content_limit` | **推断**（站点用布尔，公开 API 用 `sfw`/`nsfw` 词表；样本 `is_nsfw:false` ↔ `sfw`，但布尔↔词表的映射未经正向实测） |
| `walkthrough.chart_characters[]` `{key, source_name, catalog_character:{object,id,catalog_name:{display_name,latin,localized}}}` | `walkthrough.characters[]` `{key, name, character_id, display_name, localized}` | 站点是**嵌套**的，公开 API 是**拍平**的：`character_id = catalog_character.id`、`display_name = catalog_character.catalog_name.display_name`、`localized = catalog_character.catalog_name.localized`、`name = source_name`（**推断**，由字段描述对齐） |

### 3.4 样本（已按公开 API 命名对齐，裁剪）

> 完整原始样本在 `.tmp-wt/walkthrough-2804.json`（站点内部命名，临时文件）。下面这份是对齐公开 API 名字后的**裁剪版**：段只留 2 条（`g1` 的步骤截断到前 5 步），其余块完整。

```jsonc
{
  "object": "walkthrough",
  "id": "2804",
  "work_id": "15",
  "lang": "ja",
  "source": "seiya",
  "source_url": "https://seiya-saiga.com/game/yuzu-soft/senrenbanka.html",
  "source_author": null,
  "source_updated_on": "2020-02-15",
  "work_content_limit": "sfw",
  "work_route_hints": false,
  "release": null,
  "ending_count": 13,
  "save_count": 7,
  "segment_count": 15,
  "updated_at": "2026-10-31T22:40:45Z",

  "characters": [
    { "key": "c1", "name": "朝武 芳乃", "character_id": "39099", "display_name": "朝武 芳乃",
      "localized": { "zh-Hans": { "value": "朝武芳乃", "is_machine": false } } },
    { "key": "c2", "name": "常陸 茉子", "character_id": "39100", "display_name": "常陸 茉子",
      "localized": { "zh-Hans": { "value": "常陆茉子", "is_machine": false } } },
    { "key": "c3", "name": "ムラサメ", "character_id": "4477", "display_name": "ムラサメ",
      "localized": { "zh-Hans": { "value": "丛雨", "is_machine": false } } },
    { "key": "c4", "name": "レナ・リヒテナウアー", "character_id": "4478", "display_name": "レナ・リヒテナウアー",
      "localized": { "zh-Hans": { "value": "蕾娜·莉希特娜瓦", "is_machine": false } } },
    { "key": "c5", "name": "鞍馬 小春", "character_id": "39103", "display_name": "鞍馬 小春",
      "localized": { "zh-Hans": { "value": "鞍马小春", "is_machine": false } } },
    { "key": "c6", "name": "馬庭 芦花", "character_id": "39104", "display_name": "馬庭 芦花",
      "localized": { "zh-Hans": { "value": "马庭芦花", "is_machine": false } } }
  ],

  "chart": {
    "sections": [
      { "key": "s1", "title": "朝武 芳乃",
        "localized": { "zh-Hans": { "value": "朝武 芳乃", "is_machine": true } },
        "character_keys": ["c1"] },
      { "key": "s2", "title": "常陸 茉子",
        "localized": { "zh-Hans": { "value": "常陆 茉子", "is_machine": true } },
        "character_keys": ["c2"] },
      { "key": "s3", "title": "ムラサメ",
        "localized": { "zh-Hans": { "value": "丛雨", "is_machine": true } },
        "character_keys": ["c3"] },
      { "key": "s4", "title": "レナ・リヒテナウアー",
        "localized": { "zh-Hans": { "value": "蕾娜·莉希特娜瓦", "is_machine": true } },
        "character_keys": ["c4"] },
      { "key": "s5", "title": "鞍馬 小春、馬庭 芦花",
        "localized": { "zh-Hans": { "value": "鞍馬 小春、马庭 芦花", "is_machine": true } },
        "character_keys": ["c5", "c6"] }
    ],

    "legend": [
      { "text": "( )の選択肢は差分CG回収の為にQ.SAVE&Q.LOADまたはバックジャンプ等で両方共回収してください。",
        "localized": { "zh-Hans": { "value": "( )的选项是为了回收差分CG，请用Q.SAVE&Q.LOAD或回跳等把两个都回收。", "is_machine": true } } }
    ],

    "entries": [
      { "key": "start", "label": "START",
        "localized": { "zh-Hans": { "value": "START", "is_machine": true } },
        "unlocked_by_ending_key": null }
    ],

    "saves": [
      { "key": "sv01", "label": "◆セーブ01", "localized": { "zh-Hans": { "value": "◆存档01", "is_machine": true } } },
      { "key": "sv02", "label": "◆セーブ02", "localized": { "zh-Hans": { "value": "◆存档02", "is_machine": true } } },
      { "key": "sv03", "label": "◆セーブ03", "localized": { "zh-Hans": { "value": "◆存档03", "is_machine": true } } },
      { "key": "sv04", "label": "◆セーブ04", "localized": { "zh-Hans": { "value": "◆存档04", "is_machine": true } } },
      { "key": "sv05", "label": "◆セーブ05", "localized": { "zh-Hans": { "value": "◆存档05", "is_machine": true } } },
      { "key": "sv06", "label": "◆セーブ06", "localized": { "zh-Hans": { "value": "◆存档06", "is_machine": true } } },
      { "key": "sv07", "label": "◆セーブ07", "localized": { "zh-Hans": { "value": "◆存档07", "is_machine": true } } }
    ],

    "endings": [
      { "key": "e1", "name": "芳乃END", "localized": { "zh-Hans": { "value": "芳乃END", "is_machine": true } },
        "ending_type": "heroine", "character_keys": ["c1"] },
      { "key": "e2", "name": "芳乃AFTEREND", "localized": { "zh-Hans": { "value": "芳乃AFTEREND", "is_machine": true } },
        "ending_type": "after",   "character_keys": ["c1"] },
      { "key": "e3", "name": "俺たちの戦いは以下略END",
        "localized": { "zh-Hans": { "value": "我们的战斗以下略END", "is_machine": true } },
        "ending_type": "bad",     "character_keys": ["c1"] }
      // … e4..e13：c2/c3/c4/c5/c6 各 heroine + after，共 13 条
    ],

    "segments": [
      {
        "key": "g1",
        "section_key": "s1",
        "from_node": { "node_type": "entry", "key": "start" },
        "condition": null,
        "condition_localized": {},
        "requires_ending_keys": [],
        "steps": [
          { "step_type": "choice", "text": "正直に言う",
            "localized": { "zh-Hans": { "value": "老实说", "is_machine": true } },
            "alternatives": [
              { "text": "誤魔化す", "localized": { "zh-Hans": { "value": "蒙混过去", "is_machine": true } } }
            ],
            "remark": "サブ+1",
            "remark_localized": { "zh-Hans": { "value": "副+1", "is_machine": true } },
            "achievement": false, "save_key": null },
          { "step_type": "choice", "text": "どうだろ？",
            "localized": { "zh-Hans": { "value": "怎么样？", "is_machine": true } },
            "alternatives": [
              { "text": "都会の方かな", "localized": { "zh-Hans": { "value": "大概是城市那边吧", "is_machine": true } } }
            ],
            "remark": "茉子+1",
            "remark_localized": { "zh-Hans": { "value": "茉子+1", "is_machine": true } },
            "achievement": false, "save_key": null },
          { "step_type": "choice", "text": "可愛いと思う", /* … */ "achievement": false, "save_key": null },
          { "step_type": "save", "text": null,
            "localized": {}, "alternatives": [], "remark": null, "remark_localized": {},
            "achievement": false, "save_key": "sv01" },
          { "step_type": "choice", "text": "釣り",
            "localized": { "zh-Hans": { "value": "钓鱼", "is_machine": true } },
            "alternatives": [], "remark": null, "remark_localized": {},
            "achievement": false, "save_key": null }
          // …共 22 步（含 heading「■芳乃ルート」、save 共 4 次）
        ],
        "to_node": { "node_type": "ending", "key": "e1" }
      },
      {
        "key": "g2",
        "section_key": "s1",
        "from_node": { "node_type": "ending", "key": "e1" },   // 从结局续玩
        "condition": null,
        "condition_localized": {},
        "requires_ending_keys": [],
        "steps": [
          { "step_type": "heading", "text": "■アフターストーリー：芳乃",
            "localized": { "zh-Hans": { "value": "■AFTER故事:芳乃", "is_machine": true } },
            "alternatives": [], "remark": null, "remark_localized": {},
            "achievement": false, "save_key": null },
          { "step_type": "save", "text": null, /* … */ "save_key": "sv06" },
          { "step_type": "choice", "text": "破くしかない！", /* … */ "save_key": null },
          { "step_type": "choice", "text": "このまま奥深くで搾り取られる", /* … */ "save_key": null },
          { "step_type": "choice", "text": "このまま奥深くで搾り取られる", /* … */ "save_key": null }
        ],
        "to_node": { "node_type": "ending", "key": "e2" }
      }
    ]
  }
}
```

### 3.5 这条攻略的图骨架（15 段全览，实测）

```
g1  entry:start        → ending:e1    s1  22 步（choice/save/heading）   ← 主线 8 个选项 + ■芳乃线 8 个
g2  ending:e1          → ending:e2    s1   5 步（heading/save/choice）
g3  save:sv05          → collect:null s1   2 步（choice）                 ← 差分 CG 回收支线
g4  save:sv06          → collect:null s1   3 步（choice）
g5  save:sv03          → ending:e3    s1   2 步（choice）                 ← 坏结局
g6  save:sv01          → ending:e4    s2  12 步
g7  ending:e4          → ending:e5    s2   4 步
g8  save:sv01          → ending:e6    s3  13 步
g9  ending:e6          → ending:e7    s3   5 步
g10 save:sv02          → ending:e8    s4  10 步
g11 ending:e8          → ending:e9    s4   3 步
g12 save:sv04          → ending:e10   s5   9 步，condition = "※誰か１人クリア後に"
g13 ending:e10         → ending:e11   s5   3 步
g14 save:sv07          → ending:e12   s5   6 步
g15 ending:e12         → ending:e13   s5   2 步
```

**这张图直接解释了 `from_node` 的三种形态**：`entry`（从头玩）、`save`（读某个存档续玩）、`ending`（结局后接 AFTER 故事）。

---

## 4. 语义解释（写代码前必读）

### 4.1 `node_type`

| 值 | 含义 | `key` | 参考站渲染 |
| --- | --- | --- | --- |
| `entry` | 起点：标题画面 / 重开 | 指 `entries[].key`，非 null | 节点标签 `START`；段落头「从【START】开始」 |
| `save` | 存档点 | 指 `saves[].key`，非 null | 节点标签 `◆存档05`；段落头「读取「◆存档05」」 |
| `ending` | 结局 | 指 `endings[].key`，非 null | 结局名 + 类型徽章；下一段头「接在「芳乃END」之后」 |
| `collect` | 只为回收 CG / 场景就停下的终点 | **null** | 段尾「回收 CG / 场景后结束」；节点标签「回收 CG / 场景」 |
| `open` | 就是断了，没有终结点 | **null** | 未观测（推断：不加任何终点标记） |

> `collect`/`open` 的 `key` 为 null 是**契约的一部分**，前端必须判空；别拿 `key` 当 React key。

### 4.2 `step_type`

| 值 | 含义 | `text` | 是否参与编号 |
| --- | --- | --- | --- |
| `choice` | 从**游戏内菜单**里选的选项 | 非 null | ✅ |
| `action` | 其它玩家操作（小游戏、地图移动等） | 非 null | ✅（spec：`heading`/`note` 之外都是「被选/被做的」） |
| `save` | 在这里建立 `save_key` 存档 | **null** | ❌ |
| `heading` | 原页面用来分组后续步骤的行（日期 / 游戏内第几天 / 章节 / 楼层），**作用域到下一个 heading 或段尾** | 非 null | ❌ |
| `note` | 给读者的说明/备注，原文通常带 ※ | 非 null | ❌ |

spec 原文还提到：**站点做编号时跳过 heading 与 note**；遇到**未知 step_type 时应只显示文本、不编号**（向前兼容）。

### 4.3 `alternatives`（差分 CG 回收的备选）

- `steps[].text` 是**主路径**的选择；`alternatives[]` 是原页面为**回收差分 CG** 额外列出的同屏选项，各带自己的 `localized`。
- 参考站的呈现：主文本一行，下面用小标签「差分 CG 回收时改选」+ 备选文本（备选**不单独编号**）。
- 与 `legend` 的关系：原页面用「( )」括注这类记号标记，`legend` 里给出记号的定义（本例 legend 那条就是讲「( ) 的选项请用 Q.SAVE/Q.LOAD 两边都回收」）。**记号的含义只由 `legend` 定义，不同页面不同**——不要在代码里硬编码 ★/⇒ 的语义。

### 4.4 `remark` / `remark_localized`

「选了之后的结果」或「效果」，**不是游戏内文本**：如 `推理正解` / `不正解`、`芳乃+1`（好感度）。可空；有 `localized` 时是机翻。

### 4.5 `achievement`

「这一步给成就/奖杯」——原文可能写在步骤上，也可能写在「定义该记号」的 legend 行里（spec 的原话）。**不是**「这步只为了成就」。样本里 0 条为 true（千恋＊万花这页源站没标）。

### 4.6 `save_key` 与 `saves[]` 的关系

- `steps[]` 里 `step_type === "save"` 的那一步**创建**一个存档点，`save_key` 指向 `chart.saves[].key`；
- 其它任何 `step_type` 的 `save_key` 恒为 `null`；
- `chart.saves[]` 是**声明表**（key + label + localized），供节点/段落头引用；一个存档点可能被**多条 segment** 作为 `from_node` 复用（本例 `sv01` 同时是 g6 与 g8 的起点 —— 同一个存档能分叉出两条路线，这正是流程图的意义）；
- 因此 **`saves` 不能按「每个 save 步骤唯一」来推断**：`chart.saves` 与「save 步骤」是一对一，但一个 save 节点可以有多条出边。

### 4.7 `section_key` ↔ `sections[].character_keys`

- `segments[].section_key` 指向 `sections[].key`（`null` = 该段在源页面不属于任何标题下）；
- `sections[].character_keys` 指向 `characters[].key`，说明「这个标题讲的是哪个/哪些角色」；
- **角色 → 段落** 必须走两步：`characters[].key` → `sections[].character_keys` → `sections[].key` → `segments[].section_key`。**没有** `segments[].character_keys` 这个字段；
- 一个 section 可以挂多个角色（本例 `s5` 同时挂 `c5`+`c6`，因为小春线与芦花线共用一段前置），所以「角色路线卡」的「N 段」是**包含重复**的（同一段可能同时算进两个角色）。

### 4.8 `requires_ending_keys`

- 「必须先看过这些结局」的前置条件，值是 `endings[].key`；
- **导入的 chart 只在「condition 里点名的结局全都是本 chart 的」时才填**；`condition` 保留完整原话，所以 `requires_ending_keys` 为空**不代表没有前置**，只代表「没解析出来」；
- 所以展示前置要 **`condition` 优先、`requires_ending_keys` 补充**。本例 g12：`condition = "※誰か１人クリア後に"`（机翻「※任意一人通关后」），而 `requires_ending_keys = []`（因为「谁」没指名）—— 完美印证这条规则。

### 4.9 `source` 与署名

- `source` 是**开放词汇**（`seiya`、`nextmoe`…），spec 反复写「Must not be used as a discriminant」——**不能用来判断「是不是平台自写」**，要判断就判 `source_url === null`；
- 参考站署名行：`选项流程整理自 {作者/来源站}，原页面更新于 {source_updated_on}。只保留了选项与存档结构，原文说明请查看原页面。选项的中文为机器翻译，游戏内显示的是日文原文；没有可靠译名的人名保持原文。`
- 本例 `source_author = null`，站点**回退显示来源站名**「誠也の部屋」（即 `source=seiya` 的展示名）。这层 source → 展示名映射是站点私有的，**我们这边建议：`source_author` 为空时，外链的 host 或 `source` 原样显示**，不要伪造中文站名。

### 4.10 语言与 `localized`

- `lang` 是**正文语言**；`localized` 是**机翻映射**，键是 BCP-47。**`lang` 对应的语言不会出现在 `localized` 里**（`ja` 的 chart，`localized` 只有 `zh-Hans`）；
- 样本里所有 `localized` 只有 `zh-Hans` 一个键，且 `is_machine` 全为 `true`——即「中文是机翻」；
- 人名可能**没有译文**（spec：*Personal names without a sourced catalog translation stay in the original script*），此时 localized 里给的值就是原文。

---

## 5. 参考站 UI 逐屏说明（前端实现依据）

素材：`page3`（默认「按角色」视图，`?character=c1`）、`page2`（`?character=c1&view=order` 顺序视图）、`page4`（`?character=c1&view=graph` 流程图视图）。三页共享同一套外壳。

### 5.1 页面外壳（三视图共用）

1. **页面标题**：`{作品名} 攻略 | 全 {N} 结局路线选项与存档点`（N = `ending_count`）。
2. **概览卡**
   - 制作会社：多个公司名并列（数据来自**作品**，不是 walkthrough）；
   - 发售日期：`2016-07-29`（作品发售日）；
   - 三个统计：`{ending_count} 个结局` · `{save_count} 个存档点` · `{characters.length} 名角色`；
   - 按钮：**返回游戏页面**（→ 作品页）、**查看原攻略页面**（→ `source_url`，外链；`source_url` 为 null 时不显示）；
   - 署名段（见 §4.9 全文）+「只保留了选项与存档结构，原文说明请查看原页面」（这是**法律/版权口径**，我们照抄）。
3. **角色路线区**：标题「角色路线」+ 副标「选择角色查看这条路线的选项」。每张卡：
   - 角色名（优先 `display_name`，否则 `characters[].name`；有 `localized.zh-Hans` 时可显示中文名）；
   - `{该角色结局数} 个结局 · {该角色段数} 段`（结局数 = `endings[]` 里 `character_keys` 含该 key 的条数；段数 = 该角色 section 下的 segment 数）；
   - 选中态切换 `?character=<key>`。
4. **视图切换**：`按角色` / `按顺序` / `流程图` → `?view=character|order|graph`（默认 `character`）。
5. **语言切换**：`双语`（默认）/ `原文` / `中文`。
   - 双语 = 中文主文 + 括号内原文，例：`老实说` 下一行 `(正直に言う)`；
   - 原文 = 只显示 `text`（`lang` 语言）；
   - 中文 = 只显示 `localized["zh-Hans"].value`，缺失时回退原文。
   - 标题、legend、remark、存档 label、结局名全部走同一套语言开关。
6. **符号说明**（legend）：标题「符号说明」+ `chart.legend[]` 逐条渲染；双语时原文放括号内。
7. **路线概览条**：`本路线分 N 段, 点击跳到对应段落` + N 个 chip，每个 chip：段序号、起点标签、终点标签、`{M} 个选项`（M = 该段 `choice`+`action` 步骤数）。点击滚动到对应段落。

### 5.2 按顺序视图（`view=order`）

线性长文，每个 segment 一张卡片：

**卡片头**：段序号 chip + 起点短语 + 终点 + 选项数。
起点短语按 `from_node.node_type` 分三种（**实测原话**）：

| from | 渲染 |
| --- | --- |
| `entry` | `从【{entries[key].label}】开始` |
| `save` | `读取「{saves[key].label}」` |
| `ending` | `接在「{endings[key].name}」之后` |

**步骤区**（按数组顺序，绝不重排）：

- `heading`：整行分隔标题，文本自带 `■` 前缀（如 `■芳乃线`），**其后编号从 1 重新开始**（实测：g1 先 1–8，遇到 `■芳乃线` 后重新 1–8）；
- `choice`/`action`：`{n}` + 主文本 + （双语时）`（原文）` + `remark` 小标签（如 `芳乃+1`）+ `alternatives` 区（标签「差分 CG 回收时改选」+ 备选文本，备选**不编号**）；
- `save`：不编号的独立行 `在这里存档:「{saves[save_key].label}」`；
- `note`：不编号的说明行（样本无此类型，**推断**：样式同 save 行，前缀 ※）。

**卡片尾**（`to_node`）：

| to | 渲染 |
| --- | --- |
| `ending` | 结局名（双语时附原文）+ 类型徽章 |
| `collect` | `回收 CG / 场景后结束` |
| `open` | 未观测（**推断**：不渲染终点块） |

**结局类型徽章**（实测）：`heroine`→`个人线`、`after`→`后日谈`、`bad`→`坏结局`；
其余取值样本里没有，**推断**：`harem`→`后宫`、`true`→`真结局`、`normal`→`普通结局`、`other`→`其他`（或直接不渲染徽章，更安全）。

### 5.3 按角色视图（`view=character`，默认）

与顺序视图**共用同一套段落卡片渲染**，差别是数据范围：只渲染 `sections` 中命中 `characters[key]` 的段（按 chart 源顺序）。实测 page2 与 page3 的段落 DOM/文本逐段一致，仅 URL 参数不同 —— 所以实现上可以**一个卡片组件 + 两处过滤**，不要写两套。

### 5.4 流程图视图（`view=graph`）

- 顶部多一个开关：**显示全部路线**（默认关 = 只画当前角色；开 = 画全部角色，多泳道并列）；
- 画布：每个角色一条泳道，节点按段落顺序排布，连线上标 `{M} 个选项`；
- 交互（站点底部说明原文）：
  > 点击连线上的「N 个选项」查看这一段要选的选项; 点击存档或结局, 查看到达它要选的选项和接下来的去向。
  即：**点边** → 详情面板展示该 segment 的完整步骤；**点节点** → 详情面板展示「到达它的段落」与「从它出发的段落」；
- 节点标签：`START`（entry）/ `◆存档NN`（save）/ 结局名（ending）/ `回收 CG / 场景`（collect）；
- 详情面板的段落渲染与顺序视图**完全一致**（实测 page4 的段落文本与 page2 一字不差），所以同样是复用。

> ⚠️ 视觉细节（泳道的具体几何、连线锚点、颜色）**没能实测**：`page4.html` 里 graph 的 tabpanel 只有客户端渲染占位，Vue 未 SSR 出 SVG。节点/边的内容与交互文案是实测的，**布局参数属推断**——实现时按我们自己的审美来，不必复刻像素。

### 5.5 未采集到的部分

- `page1`（作品页的「攻略」页签列表）**没抓到内容**：`.tmp-wt/page1.txt` 只有站点头部，HTML 里`攻略`只出现 1 次（SEO 串）。所以「攻略页签长什么样」没有实测依据。**推断**：列表项显示攻略名（作品名+攻略）、来源站署名、`N 个结局`、语言标签，点击进详情。前端不要照抄，按我们自己的风格做。

---

## 6. 数据量 / 性能观察

- 单条 chart 样本 7.2 KB（JSON 未压缩，101 步/15 段/13 结局）——**一条攻略的 chart 比一条角色记录大两个量级**；
- 所以 spec 才把 chart 从列表里摘掉：列表页只给标量，详情才给图。**我们的 API 也应该照抄这个切分**（列表不带 chart），否则作品页列表会把整作品所有图都搬进内存。

---

## 7. 落库建议（确认「单表 + chart jsonb」）

**结论：确认 Lead 定的方案是对的，且仓库里已经按这个口径建好了表**（`apps/api/src/db/schema/kungal.ts` 的 `galrc_kungal_walkthroughs`，2 空格缩进/单引号/无分号，注释齐全）。理由（按重要性）：

1. **chart 是闭合图**：`sections/segments/steps/entries/saves/endings` 之间靠**chart 局部 key** 互指。拆表后每次读详情都要多表 JOIN + 内存重建同一棵树，读侧零收益；
2. **只读**：我们不做按 step 的检索/统计/编辑，也没有「查某个选项」的需求，拆表换来的索引能力用不上；
3. **上游仍在演进**：每个对象 spec 都标 `additionalProperties: true`，v2 已经改过一次 steps 的内联→数组形状。整块透传时新字段自动落库、前端按 snake_case 原样消费；拆表则每次上游加键都要迁移 + 回填。

**列清单**（实现现状，与 spec 逐一对应）：

| 列 | 类型 | 来源字段 | 说明 |
| --- | --- | --- | --- |
| `id` | text PK | `id` | 十进制字符串 |
| `work_id` | text NOT NULL FK→`galrc_kungal_works.id` ON DELETE CASCADE | `work_id` | 攻略没有独立展示身份，永远跟作品页走 |
| `lang` | text | `lang` | BCP-47 |
| `source` | text | `source` | 开放词汇，**只展示不判别** |
| `source_url` | text | `source_url` | 署名外链 |
| `source_author` | text | `source_author` | 可空 |
| `source_updated_on` | text | `source_updated_on` | 日期串（非时间戳，别转 Date） |
| `work_content_limit` | text | `work_content_limit` | `sfw`/`nsfw` |
| `work_route_hints` | boolean | `work_route_hints` | 前端要提示 |
| `release` | jsonb | `release` | 原块或 null |
| `characters` | jsonb | `characters` | 原数组（异常时落 `[]` 而非 null） |
| `chart` | jsonb | `chart` | **列表行没有 → null**；详情才有 |
| `ending_count` / `save_count` / `segment_count` | integer | 同名 | 列表页要显示，不从 chart 现算 |
| `upstream_updated_at` | timestamptz | `updated_at` | 同步时判「变了没」 |
| `synced_at` | timestamptz | — | 本地 |

索引：`(work_id, upstream_updated_at)` —— 唯一读取路径「按 work 取全部攻略，按上游更新时间倒序」等值 + 排序全覆盖。

**同步算法**（与 spec 的切分对齐）：

1. 对每个已锚定的 kungal work：`GET /catalog/walkthroughs?work_id=<id>&nsfw=true&limit=100`，游标翻页到底（`next_cursor` 缺省即结束；页数上限防上游游标坏掉空转）；
2. 拿到的每行**都没有 chart**：先 upsert 标量 + `upstream_updated_at`；
3. 对「本地没有 chart」或「`upstream_updated_at` 变了」的行，逐条 `GET /catalog/walkthroughs/{id}?nsfw=true` 取 chart 再 update；
4. 404（`nsfw=true` 下仍 404）= 上游下线 → 删本地行（或标记下线）；
5. 作品被删时 chart 随 FK 级联删。

**注意**：
- 千万别在列表循环里传 `view=full` / `include=` 指望带出 chart——**spec 明确 chart 只在详情**；
- `limit` 超过 100 是 400 而不是 clamp；
- `nsfw=true` 必须带，否则 r18 作品整批不可见；
- 现有 `client.ts` 已经有 `fetchWorkWalkthroughs` / `fetchWalkthrough`（404→null）与 20 req/s 令牌桶，同步侧直接复用。

---

## 8. 给前端/API 层的硬约束（踩坑清单）

1. **key 是 chart 局部的**：`s1/g1/sv01/e1/c1` 跨攻略会重名。React key 用 `${walkthroughId}:${chartKey}`。
2. **`node.key` 可为 null**（`collect`/`open`），必须先判空再查表。
3. **`step.text` 在 `save` 时为 null**，`save_key` 只在 `save` 时非 null —— 判类型再取字段，别用 `step.text.length`。
4. **渲染顺序 = 数组顺序**，不要按 key 排序（`s1,g1` 看起来有序，但那是巧合）。
5. **编号要跳过 `heading`/`note`/`save`，并在每个 `heading` 处归零**（实测行为）。
6. **未知 `step_type` / `node_type` 容错**：只渲染文本、不编号、不崩（spec 要求）。
7. **`localized` 可能缺当前语言**：统一走一个 `pickLocalized(text, localized, lang)`，缺了回退 `text`。
8. **结局前置条件以 `condition` 为主**，`requires_ending_keys` 只作补充（§4.8）。
9. **列表接口不要带 chart**：spec 就是这么切的，我们照抄（`/walkthroughs?work_id=` 只给标量）。
10. **双语/原文/中文三档要在所有文本处生效**：标题、legend、remark、存档 label、结局名、条件。

**建议的 API 形状**（给 `api-walkthrough`，最终以他的实现为准）：

```
GET /walkthroughs?work_id=<vndb id 或 kungal work id>
→ { items: [{ id, workId, lang, source, sourceUrl, sourceAuthor, sourceUpdatedOn,
              workContentLimit, workRouteHints, release, characters,
              endingCount, saveCount, segmentCount, updatedAt }] }   // 无 chart

GET /walkthroughs/:id
→ { ...同上, chart }                                               // chart 原样 snake_case 透传
```

---

## 9. 未确认 / 需后续复核

| 项 | 状态 | 影响 |
| --- | --- | --- |
| `is_nsfw`(站点) ↔ `work_content_limit`(公开 API) 的精确映射 | **推断** | 只影响文档表述；我们同步用的是公开 API 字段，不受影响 |
| `chart_characters` → `characters[]` 的拍平映射 | **推断**（由字段描述 + 语义对齐） | 同上 |
| `harem`/`true`/`normal`/`other` 的中文徽章文案 | **推断** | 前端可先只渲染已知三种，其余不画徽章 |
| `action` / `note` 步骤的视觉样式 | **推断**（样本无此类型） | 按 spec 语义设计即可 |
| `open` 终点的渲染 | **推断** | 不渲染终点块 |
| 流程图泳道/连线的具体几何 | **未实测**（客户端渲染） | 按自己审美实现 |
| 作品页「攻略」页签列表的样子 | **未采集** | 按站点风格自行设计 |
| 条件请求（`If-None-Match`/304）能否省详情重拉 | 未测 | 现在靠 `updated_at` 比对已够 |
