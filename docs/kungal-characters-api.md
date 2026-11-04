# Kungal 角色（character）API 契约调研

> 目标：拿到 NextMoe·未萌 开放 API v2 **角色族**的权威字段契约，供后端建表 / 同步写入与前端展示共用。
>
> 取证时间：2026-11-04。依据两份材料，文中每个字段都标注了来源：
>
> - **spec**：`OpenAPI 3.1.0 · NextMoe Public API v2 2.82.0`（`https://api.nextmoe.dev/v2/catalog/openapi.json`，978,328 字节，152 条 path、297 个 schema）。取证时存过一份本地临时快照（**未入库**，已随临时目录清理）。
> - **实测**：用 `apps/api/.env` 里的 v2 应用密钥真实请求 `api.nextmoe.dev`。响应样本同样只是取证时的本地临时快照（未入库）；**结论性数据（字段表、条数、字节数、枚举全集、样本 JSON）已全部固化在本文正文里，不依赖任何本地文件。**
>
> 角色数据**只走 kungal**，不接受 vndb API 取角色；vndb 在这条链路里仅是锚点（`refs` 里的 `cNNNN`）。

## 0. 结论速查

| 问题 | 结论 | 依据 |
| --- | --- | --- |
| 角色图片字段真名 | **`image`**（另有一个可选的全身立绘 **`figure`**） | spec + 实测 |
| 图片形状 | `{url,hash,width,height,thumbhash,sexual,violence,source}`，八个键恒在、非图片字段可空 | spec 必填列表 + 实测 |
| `works/{id}/characters` 是否含完整角色 | **否**。行是 `WorkCharacter`：只有身份 + `roster_role`/`spoiler`/`voices`/`image`/`figure`，**没有 traits / gender / birthday / measurements**；且该端点**没有 view / include 参数**（传了也无效） | spec + 实测（`view=full` 前后响应逐字节相同） |
| traits 形状 | 行内数组 `CharacterTrait[]`，每个 `{object,id,display_name,group,group_localized,localized,spoiler,is_sexual,is_lie}`；**不含 `name_zh` / `vndb_tid` / `group_id`**（那是 trait 目录 `Trait` 的字段） | spec + 实测 |
| measurements 键名 | `{bust_cm, waist_cm, hip_cm, cup}`，四项恒在、逐项可空 | spec + 实测 |
| 枚举 | `gender: male\|female\|other`、`blood_type: a\|b\|ab\|o`、`roster_role: main\|secondary\|appears\|unknown`、`spoiler: none\|minor\|major`、`sexual: safe\|suggestive\|explicit\|null`、`violence: tame\|violent\|brutal\|null`、`alias_kind: translation\|spelling_variant` | spec（CLOSED 词表） |
| `view=full` 语义 | 实测等价于「把 15 个 include 块全部打开」；`view=basic`（默认）只有 6 个身份字段 | 实测 |
| 批量水合 | `characters?ids=<≤100>&view=full` → 一次拿全量角色；未命中进 `missing[]`，不 404 | spec + 实测 |

**给后端的直接结论**：先 `GET /v2/catalog/works/{id}/characters` 拿名册（含 `roster_role` / `spoiler` / `voices` / `image` / `figure`），再把这一页的角色 id 拼成 `characters?ids=…&view=full`（≤100 一批）水合出 `traits`/`gender`/`birthday`/`measurements` 等详情字段。

## 1. 数据来源与取证方法

### 1.1 spec 快照

- 版本 `2.82.0`，形状按 additive-only 演进（CI 的 oasdiff 门拦破坏性变更）。
- 152 条 path / 297 个 schema，其中角色相关的有 4 条 path 与 5 个 schema：
  - path：`/v2/catalog/characters`、`/v2/catalog/characters/{id}`、`/v2/catalog/characters/{id}/appearances`、`/v2/catalog/works/{id}/characters`
  - schema：`Character`、`CharacterTrait`、`WorkCharacter`、`ListCharacter`、`ListWorkCharacter`（另有 `Appearance` / `ListAppearance` / `Trait` / `Image` / `Measurements` 等共享子对象）

### 1.2 实测环境（含一个必须记录的坑）

`apps/api/.env` 里 **`KUNGALAPI_KEY` 定义了两次**：

| 行 | 值前缀 | 结果 |
| --- | --- | --- |
| 41 | `nm_…`（v1 应用密钥） | 被 /v2 拒绝：`401 INVALID_CREDENTIAL`，detail 明确写 `v1 application keys are not accepted on /v2; mint a v2 key (nmk_)` |
| 53 | `nmk_test_…`（v2 密钥） | 正常，200 |

`grep -m1` 之类的写法会取到第 41 行那把废钥，从而误判「没有可用凭据」。**任何按 .env 取值的地方都应确认拿到的是 `nmk_` 开头的那把**（本项目建议：删掉第 41 行，或把它改名成 `KUNGALAPI_V1_KEY` 之类不再被读取的键）。

网络到 `api.nextmoe.dev` 极慢（单请求 15–25s，常 timeout / reset），因此实测样本均通过后台任务 + 重试取得。**样本属于「抓到的时点」，不承诺恒等于线上当前值。**

### 1.3 实测样本清单

取证时的响应都只落在本地临时目录（**未入库，已清理**）。下表记录「当时抓了什么、多大」，用来判断每条结论的取样规模；关键样本已裁剪后贴在第 9 节。

| 样本 | 请求 | 响应大小 |
| --- | --- | --- |
| 默认视图 | `/catalog/characters?limit=3`（默认 view=basic） | 767 B |
| 全视图 | `/catalog/characters?limit=2&view=full&nsfw=true` | 28,963 B |
| 单角色详情 | `/catalog/characters/1?view=full&nsfw=true` | 13,554 B |
| 出场反查 | `/catalog/characters/1/appearances?limit=5&nsfw=true` | 3,803 B |
| 作品名册 | `/catalog/works/4/characters?limit=10&nsfw=true` | 10,152 B |
| ids 批量（含 1 个不存在的 id） | `/catalog/characters?ids=1,999999999&view=full&nsfw=true` | 13,610 B |
| include 不开 view | `/catalog/characters?ids=7937&include=image,traits` | 13,451 B |
| 故意写错 include（读 allowed 全集） | `/catalog/characters?limit=1&include=bogus` | 744 B |

### 1.4 怎么重跑这套取证

网络到 `api.nextmoe.dev` 很慢（实测单请求 15–25s，常 timeout），**大文件必须后台下载 + 断点续传**，前台逐个 `curl` 会一直失败：

```bash
# 1) 拉 openapi（约 978 KB）：断点续传 + 后台任务
KEY=$(grep '^KUNGALAPI_KEY=' apps/api/.env | tail -1 | cut -d= -f2- | tr -d '"')
mkdir -p .tmp-kungal
for i in $(seq 1 60); do
  curl -sS --http1.1 --max-time 120 --continue-at - \
    "https://api.nextmoe.dev/v2/catalog/openapi.json" \
    -o .tmp-kungal/openapi.json
  rc=$?
  echo "$i rc=$rc size=$(stat -c%s .tmp-kungal/openapi.json)"
  [ "$rc" = 0 ] && break
done
# 校验：能 JSON.parse 即完整，最终 978,328 字节

# 2) 抓角色样本（同样放后台、逐个重试）
curl -sS --http1.1 --max-time 25 \
  -H "Authorization: Bearer $KEY" \
  "https://api.nextmoe.dev/v2/catalog/characters?limit=2&view=full&nsfw=true" \
  -o .tmp-kungal/live-char-full.json
```

两个取证技巧，本次结论都靠它们：

- **闭集用「故意写错」读全集**。枚举值、`include` 合法 token、`sort` 合法键在 spec 里都不给枚举；传一个错值触发 `400`，错误体的 `errors[0].params.allowed` 会把全集列出来。
- **`apps/api/.env` 里 `KUNGALAPI_KEY` 定义过两次**，要取最后一行的 `nmk_` 那把（见 1.2），否则拿到 v1 钥会误判成「没有可用凭据」。

## 2. 端点总览

| 端点 | 响应 schema | 可用参数 | 用途 |
| --- | --- | --- | --- |
| `GET /v2/catalog/characters` | `ListCharacter` | `cursor` `limit` `view` `include` `fields` `ids` `refs` `include_total` `facets` `sort` `nsfw` `page` `q` `trait_id` `trait_match` `gender` | 角色列表 / 搜索 / 批量水合 |
| `GET /v2/catalog/characters/{id}` | `Character` | `nsfw` `view` `include` `fields` `spoiler` | 单角色详情 |
| `GET /v2/catalog/characters/{id}/appearances` | `ListAppearance` | `nsfw` `cursor` `limit` | 角色 → 出演作品（反查） |
| `GET /v2/catalog/works/{id}/characters` | `ListWorkCharacter` | `nsfw` `cursor` `limit` | 作品 → 名册角色（主路径） |
| `GET /v2/catalog/works/{id}?include=characters` | 内嵌 `WorkCharacter[]` | 同作品详情 | 与上行同源，省一次请求 |

补充：`characters/{id}/appearances` 的 path 参数 `id` 在 spec 的描述里被误写成「Decimal catalog work id」，**实测传角色 id 返回该角色的出演作品**（角色 1 = 国崎往人 → AIR 等 5 部），以实测为准。

### 2.1 分页与上限

| 项 | 规则 | 依据 |
| --- | --- | --- |
| `limit` | 1–100，默认 20；**>100 是 400 `LIMIT_TOO_LARGE`，不是 clamp** | spec |
| `cursor` | 不透明 keyset，必须以 `cur_` 开头；末页**省略** `next_cursor` | spec |
| `ids` / `refs` | ≤100，**批量通道、无分页**；未命中进 `missing[]` | spec + 实测 |
| `page` | 1-based 页码，切「页码模式」：返回 `total` + `total_relation`，无 `next_cursor`；`page × limit ≤ 10000` | spec |
| `include_total` | `true` 才给 `total`（与 items 同一可见性门） | spec |

### 2.2 `nsfw` 对角色族的实际语义（实测）

`nsfw=true` 是**作品级**开关，不是图片级过滤器：

- `GET /works/2156/characters?nsfw=false`（2156 = AIR，`content_rating=r18`）→ **`404 NOT_FOUND` "work not found"**：整个 r18 作品在 `nsfw=false` 下不可见，连带它的名册一起消失（不是「返回作品但把图置空」）。
- 同请求 `nsfw=true` → 15 条名册正常返回（14 条有 `image`，1 条 `image: null` —— 说明**有角色确实没有头像**，展示侧必须有占位）。

**同步一律带 `nsfw=true`**，否则 r18 作品的角色名册会被判成「没有角色」。

实测 `ids=1,999999999` 的响应：

```json
{ "object": "list", "items": [ /* 1 条 */ ], "missing": ["999999999"] }
```

## 3. 视图与富化：view / include / fields

这是整套契约里最容易踩错的地方。

### 3.1 `view=basic`（默认）只有身份内核

实测 `characters?ids=7937`（不带任何参数）返回的 `items[0]` **只有 6 个键**：

```json
{
  "object": "character",
  "id": "7937",
  "display_name": "久島鴎",
  "latin": null,
  "lang": "ja",
  "localized": {
    "ja": { "value": "Kushima Kamome", "is_machine": false },
    "zh-Hans": { "value": "久岛鸥", "is_machine": false }
  }
}
```

**连 `image` 都没有。** 想拿立绘必须点名 `view=full` 或 `include=image`。

### 3.2 `include` 的合法 token 全集（实测）

spec 的 `include` 参数只写 "Comma-separated blocks"，没有枚举。用错误 token 触发 `400 UNKNOWN_INCLUDE`，错误体的 `errors[0].detail` 会把合法值全列出来（实测 `include=bogus`）：

> allowed values: `gender, birthday, height_cm, weight_kg, measurements, blood_type, instance_of_id, image, figure, traits, aliases, intros, refs, links, work_count`

共 **15 个**：

| token | 打开的块 | 备注 |
| --- | --- | --- |
| `image` | `image` | 角色头像（竖版 250×300 一类） |
| `figure` | `figure` | 全身立绘（如 229×428），**很多角色没有** |
| `traits` | `traits[]` | 属性/性格特征 |
| `aliases` | `aliases[]` | 别名 |
| `intros` | `intros[]` | 简介（多语言） |
| `refs` | `refs[]` | 上游锚点（vndb `cNNNN` 等） |
| `links` | `links[]` | 该角色在 vndb/bangumi/erogamescape 的页面 |
| `work_count` | `work_count` | 出演作品数 |
| `gender` `birthday` `blood_type` `height_cm` `weight_kg` `measurements` `instance_of_id` | 对应单字段 | 与 `view=full` 重叠 |

注意：`gender` 等 7 个标量既受 `view=full` 控制，也能用 `include=gender` 单独点名；`image`/`figure`/`traits` 等 8 个块只能靠 `include` 打开。

### 3.3 `view=full` 到底等于什么（实测）

- `characters?limit=2&view=full&nsfw=true` **没有任何 `include`**，却同时返回了 `gender / image / traits / links / aliases / intros / refs / work_count`，其中第二个角色还带 `birthday / blood_type / height_cm / weight_kg / measurements`。
- `characters?ids=7937&include=image,traits`（**不带 view=full**）同样拿到 `image` + 48 条 `traits`。

结论：**`view=full` 等价于「把 15 个 include 块全部打开」**；`include=` 是不开 `view=full` 时的精细选择器。二者是叠加关系，不是互斥。—— 此为实测归纳，非 spec 明文（见第 11 节）。

### 3.4 稀疏：没记录 ≠ null

字段「存在但为 null」和「整个键缺失」是两回事，实测两种都出现了：

- 角色 1（国崎往人，男性）**完全没有 `birthday`/`blood_type`/`height_cm`/`weight_kg`/`measurements` 这些键**；
- 角色 2（同页女性角色）有这些键且带值，其中 `measurements.cup` 为 `null`。

所以入库时：**缺失一律按 NULL 处理**，不要把「键缺失」当成 `false`/`0`。

### 3.5 `spoiler` 天花板：默认会**丢掉**大量 trait（实测，重要）

`GET /catalog/characters/{id}` 有一个 `spoiler` 参数，语义是 traits 块的**天花板**，默认 `none`。实测（同一角色、只改 `spoiler`）：

| 角色 id | `spoiler=none`（默认） | `spoiler=major` | 被默认丢掉 |
| --- | --- | --- | --- |
| 7937 | 48 条（全 none） | 61 条（none 48 / minor 1 / major 12） | 13 条 |
| 202831 | 46 条（全 none） | 72 条（none 46 / minor 10 / major 16） | 26 条 |
| 100032 | 42 条（全 none） | 68 条（none 42 / minor 8 / major 18） | 26 条 |

结论：**不传 `spoiler=major` 时，minor/major 剧透级 trait 一条都拿不到**，且接口不会报错、不会提示——静默少 20%–35% 的属性。

**更要命的是：列表/批量通道根本没有 `spoiler` 参数。** `GET /catalog/characters`（含 `ids=` 批量水合）的参数表里只有 `nsfw/view/include/fields/ids/refs/include_total/facets/sort/page/q/trait_id/trait_match/gender`，**没有 `spoiler`**；只有单角色端点 `/catalog/characters/{id}` 才有。

同一角色（id=1）两条通道的实测对比：

| 通道 | traits 条数 | spoiler 分布 |
| --- | --- | --- |
| 列表 `/catalog/characters?ids=1&view=full` | 42 | `{none: 42}` |
| 详情 `/catalog/characters/1?view=full&spoiler=major` | 49 | `{none: 42, minor: 2, major: 5}` |

也就是说：**走 `ids=` 批量水合永远只能拿到 `none` 级 trait**，去掉的正好是最有信息量的剧透属性。

对入库的建议：

- 若接受「只存无剧透属性」→ 现状即可，但要在文档/代码里写明这是刻意取舍。
- 若要存全量 → 只能用**单角色端点逐条拉**（`spoiler=major`），成本是每个角色一次请求（该端点不支持批量）。取舍点：名册一页 20 个角色 = 20 次详情请求，而不是 1 次 `ids=`。
- 折中：批量 `ids=` 打底，再对需要的角色按 id 补一次详情，只覆盖 `traits` 字段。行内每条 trait 自带 `spoiler`，展示侧按门控过滤即可。

### 3.6 `fields=` 裁剪

在 view/include 之后裁剪顶层键，`object` 与 `id` 恒保留；未知 key 是 400 `UNKNOWN_FIELD`。本项目一般不需要，除非要压响应体积。

## 4. `Character` 字段表（权威）

`required: object, id, display_name, latin, lang, localized`。三态列含义：必填 / 可空 / 何时出现。

| 字段 | 类型 | 可空 | 出现条件 | 枚举 | 含义 |
| --- | --- | --- | --- | --- | --- |
| `$schema` | string(uri) | — | 总是 | — | 该对象的 JSON Schema URL，如 `.../Character.json`。可忽略 |
| `object` | string | 否 | 总是 | `character` | 类型判别符，**用它判别，别用 display_name/latin/localized** |
| `id` | string `^[0-9]+$` | 否 | 总是 | — | 鲲目录角色 id（库内 int64，**JSON 里是字符串**） |
| `display_name` | string | 否 | 总是 | — | 主显示名，恒非空；不得用作判别依据 |
| `latin` | string | **是** | 总是 | — | 拉丁名，未记录为 null |
| `lang` | string(bcp47) | **是** | 总是 | — | `display_name` 的语种，未记录为 null |
| `localized` | map<bcp47, {value:string, is_machine:boolean}> | 否（空对象） | 总是 | — | 各语言名，**永不 null，无内容时为 `{}`** |
| `gender` | string | 是 | `view=full` 或 `include=gender` | `male`\|`female`\|`other` | 性别 |
| `birthday` | string `^[0-1][0-9]-[0-3][0-9]$` | 是 | `view=full` 或 `include=birthday` | — | **`MM-DD`，没有年份**，不是日期类型。未记录 → 键缺失 |
| `blood_type` | string | 是 | `view=full` 或 `include=blood_type` | `a`\|`b`\|`ab`\|`o` | 血型（小写） |
| `height_cm` | integer(int64, ≥0) | 是 | `view=full` 或 `include=height_cm` | — | 身高 cm |
| `weight_kg` | integer(int64, ≥0) | 是 | `view=full` 或 `include=weight_kg` | — | 体重 kg |
| `measurements` | `Measurements` | 是 | `view=full` 或 `include=measurements` | — | 三围，见 5.2 |
| `instance_of_id` | string `^[0-9]+$` | 是 | `view=full` 或 `include=instance_of_id` | — | 本行是哪个角色的「实例」（同一角色的不同作品形态）；无则 null |
| `image` | `Image` | — | `include=image`（view=full 亦然），**无图时整个键缺失** | — | 角色头像 |
| `figure` | `Image` | — | `include=figure`，**无立绘时整个键缺失** | — | 全身立绘 |
| `traits` | `CharacterTrait[]` | 否（空数组） | `include=traits` | — | 性格/属性特征，见 5.5 |
| `aliases` | `EntityName[]` | 否（空数组） | `include=aliases` | — | 该角色名的其他写法，见 5.3 |
| `intros` | `Intro[]` | 否（空数组） | `include=intros` | — | 角色简介（多语言），见 5.4 |
| `refs` | `Ref[]` | 否（空数组） | `include=refs` | — | 精确上游锚点，见 5.6 |
| `links` | `WorkLink[]` | 否（空数组） | `include=links` | — | 角色在 vndb/bangumi/erogamescape 的页面，见 5.7 |
| `work_count` | integer(int64, ≥0) | — | `include=work_count` | — | 出演的不同作品数（口径同 `appearances` 的条数，同一可见性门） |
| `matched_trait_ids` | string[] | — | **仅当请求带 `trait_id=`** | — | 命中该 trait 过滤的自身 trait id（可能是所请求 trait 的子孙） |

## 5. 子对象字段表

### 5.1 `Image`（image / figure 共用）

`required: url, hash, width, height, thumbhash, sexual, violence, source` —— **八个键恒在**，但 `width/height/thumbhash/sexual/violence` 可为 null。

| 字段 | 类型 | 可空 | 枚举 | 含义 |
| --- | --- | --- | --- | --- |
| `url` | string(uri) | 否 | — | **绝对地址，绝不是裸 hash**（实测形如 `https://image.kungal.iloveren.link/cc/d3/….webp`） |
| `hash` | string `^[0-9a-f]{64}$` | 否 | — | 图床内容 hash（SHA-256 形，可做去重键） |
| `width` | integer(int64) | 是 | — | 像素宽 |
| `height` | integer(int64) | 是 | — | 像素高 |
| `thumbhash` | string `^[A-Za-z0-9+/=_-]+$` | 是 | — | ThumbHash 占位图串（可直接给前端做 blur-up） |
| `sexual` | string | 是 | `safe`\|`suggestive`\|`explicit`\|`null` | 性暗示评级，null = 未评估 |
| `violence` | string | 是 | `tame`\|`violent`\|`brutal`\|`null` | 暴力评级。**spec 明写当前恒为 null**（还没有行被评估） |
| `source` | string | 否（可为 `""`） | 开放词表 | 图片来源，实测多为空串 |

### 5.2 `Measurements`

`required: bust_cm, waist_cm, hip_cm, cup` —— 四项恒在，逐项可空。

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `bust_cm` | integer(int64) | 是 | 胸围 cm |
| `waist_cm` | integer(int64) | 是 | 腰围 cm |
| `hip_cm` | integer(int64) | 是 | 臀围 cm |
| `cup` | string | 是 | 罩杯。**spec 未给枚举**（"Must not be used as a discriminant"），实测样本为 null |

实测值示例（全视图样本里的第二个角色）：

```json
"measurements": { "bust_cm": 83, "waist_cm": 55, "hip_cm": 82, "cup": null }
```

### 5.3 `EntityName`（aliases 行）

`required: lang, value, alias_kind, is_machine`

| 字段 | 类型 | 可空 | 枚举 | 含义 |
| --- | --- | --- | --- | --- |
| `lang` | string(bcp47) | 否 | 开放 | 语种 |
| `value` | string | 否 | — | 该写法的文本 |
| `alias_kind` | string | 否 | `translation`\|`spelling_variant` | 别名种类（`search_hint` 是内部值，不会出现） |
| `is_machine` | boolean | 否 | — | 是否机翻 |

### 5.4 `Intro`（intros 行）

`required: lang, value, is_machine, source`

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `lang` | string(bcp47) | 否 | 语种（实测有 `en` / `zh-Hans` 等） |
| `value` | string | 否 | 简介正文 |
| `is_machine` | boolean | 否 | 是否机翻 |
| `source` | string | 否 | 来源（开放词表，实测 `vndb`） |

> 可见性注意：spec 写明「出现在任何 `content_limit=sfw` 作品里的角色，只下发被安全裁剪过的简介文本」。

### 5.5 `CharacterTrait`（traits 行）——**注意与目录 `Trait` 区分**

`required: object, id, display_name, group, localized, group_localized, spoiler, is_sexual, is_lie`

| 字段 | 类型 | 可空 | 枚举 | 含义 |
| --- | --- | --- | --- | --- |
| `object` | string | 否 | `character_trait` | 判别符 |
| `id` | string `^[0-9]+$` | 否 | — | 鲲目录 trait id（可回查 `/v2/catalog/traits/{id}`） |
| `display_name` | string | 否 | — | trait 名（实测为英文，如 `Eye Covering`） |
| `group` | string | **是** | — | **根分组名**（实测如 `Hair`）；根 trait 自身为 null |
| `group_localized` | map<bcp47,{value,is_machine}> | 否（空对象） | — | 根分组名的本地化（实测 `zh-Hans`: `毛发`） |
| `localized` | map<bcp47,{value,is_machine}> | 否（空对象） | — | trait 名的本地化（实测 `zh-Hans`: `遮眼`） |
| `spoiler` | string | 否 | `none`\|`minor`\|`major` | 该 trait 对这个角色的剧透级别 |
| `is_sexual` | boolean | 否 | — | 是否性相关 |
| `is_lie` | boolean | 否 | — | 是否为剧情内的谎言（假的属性） |

**行内 trait 没有 `name_zh`、`vndb_tid`、`group_id`、`parents`、`child_count`。** 那些属于 trait 目录的 `Trait` schema（`GET /v2/catalog/traits`，行带 `name_zh` / `vndb_tid` / `group_id` / `parents[]` / `child_count` / `root_order` / `is_applicable` / `is_searchable` / `character_count`）。要中文名请读 `localized['zh-Hans'].value`，要 vndb tid 请用 `id` 回查目录。

> 同一页两个角色分别返回 42 / 48 条 traits —— **trait 数组可能很长，别做成一行一个 trait 的关系表再 join 展示**，展示侧按 jsonb 直接渲染更省事。

### 5.6 `Ref`（refs 行）

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `source` | string | 否 | 开放词表（实测 `vndb`） |
| `external_id` | string | 否 | 上游原样 id。角色是 `c9990` 这种；**判定 vndb 角色锚点要同时看 source 与 `^c\d+$`** |

### 5.7 `WorkLink`（links 行）

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `source` | string | 否 | 开放词表 |
| `url` | string(uri) | 否 | 绝对 URL |
| `is_identity` | boolean | 否 | true = 该实体在上游目录的**自有页面**；false = 相关站点页面 |
| `page_id` | string `^[a-z]?[0-9]+$` | 是 | 上游页面 id（`c88` / `v17` / `s267`…），仅在 is_identity 时可能给 |

### 5.8 `CreditName`（voices 行，配音）

`required: object, id, display_name, latin, lang, localized, person_id`

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `object` | `credit_name` | 否 | 判别符 |
| `id` | string | 否 | 鲲目录署名 id |
| `display_name` / `latin` / `lang` / `localized` | — | latin/lang 可空 | 同角色身份字段 |
| `person_id` | string | **是** | 关联的「人物」id；未关联为 null |
| `aliases`/`birth_day`/`birth_month`/`birth_year`/`gender`/`intros`/`links`/`photo`/`refs`/`siblings` | — | — | **仅详情面**（`/characters/{id}`、`/credit-names/{id}`）才下发；名册里的 voices 只有上面 7 个必填键 |

## 6. `WorkCharacter`（作品名册行）字段表

来源：`GET /v2/catalog/works/{id}/characters`（`ListWorkCharacter`），或 `GET /v2/catalog/works/{id}?include=characters`（同源同形状）。

`required: object, id, display_name, latin, localized, roster_role, spoiler, voices, image, figure`

| 字段 | 类型 | 可空 | 枚举 | 含义 |
| --- | --- | --- | --- | --- |
| `object` | string | 否 | `character` | 判别符（**行是 character，不是 work_character**） |
| `id` | string | 否 | — | 角色 id，水合详情的钥匙 |
| `display_name` | string | 否 | — | 主显示名 |
| `latin` | string | 是 | — | 拉丁名 |
| `localized` | map | 否 | — | 各语言名 |
| `roster_role` | string | 否 | `main`\|`secondary`\|`appears`\|`unknown` | 该作品里的出场强度 |
| `spoiler` | string | 否 | `none`\|`minor`\|`major` | 该**出场**的剧透级别 |
| `voices` | `CreditName[]` | 否（空数组） | — | 该出场的 CV 署名，**永不 null** |
| `image` | `Image` | **是（值可为 null）** | — | 角色头像。注意与 `Character.image` 不同：这里的键恒在，无图时值为 `null` |
| `figure` | `Image` | **是（值可为 null）** | — | 全身立绘，同上 |
| `identity` | string | 是 | — | 名册行的**不透明身份串**，仅供提交 `catalog.work.roster.suppressed` 提案时原样回传；**只在通过名册面到达该角色时出现**，通过 voice credits 反查到的行没有它 |

**没有的字段**：`lang`（spec 与实测都没有）、`gender`、`birthday`、`measurements`、`traits`、`intros`、`aliases`、`refs`、`links`、`work_count`。

**没有的参数**：`view` / `include` / `fields` / `q` / `sort` —— 只有 `nsfw` / `cursor` / `limit`。实测在 `works/4/characters` 上加 `&view=full` 得到的响应与原请求**逐字节相同**（10,152 B，`diff` 无差异）。

### 6.1 水合路径（后端主流程）

```
GET /v2/catalog/works/{id}/characters?limit=100&nsfw=true      # 名册：roster_role / spoiler / voices / image / figure
GET /v2/catalog/characters?ids=<本页 id，≤100>&view=full&nsfw=true   # 详情：traits / gender / birthday / measurements …
```

两段拼起来才是一条完整的角色卡；只做第一段会缺所有「人物属性」。

## 7. `Appearance`（角色 → 作品）字段表

来源：`GET /v2/catalog/characters/{id}/appearances`（`ListAppearance`）。

`required: object, work, roster_role, spoiler, voices`

| 字段 | 类型 | 可空 | 含义 |
| --- | --- | --- | --- |
| `object` | string | 否 | 恒为 `appearance`（**不是 character**） |
| `work` | `Work` | 否 | 出演的作品行，**spec 明写 view=basic** —— 没有 intros/tags/refs 等块，要锚点得再 `include=refs` 水合 |
| `roster_role` | string | 否 | 同 6 节枚举 |
| `spoiler` | string | 否 | 同 6 节枚举 |
| `voices` | `CreditName[]` | 否（空数组） | 该出场的 CV |
| `identity` | string | 是 | 名册身份串，语义同 6 节 |

注意 `Appearance` **没有 `image` / `figure`**，也没有角色自身的任何身份字段（角色身份在请求路径里）。要展示作品方的角色卡，用 6 节的 `works/{id}/characters`，别用 appearances。

## 8. 枚举汇总

| 枚举 | 取值 | 词表类型 | 依据 |
| --- | --- | --- | --- |
| 角色 `object` | `character` | CLOSED | spec |
| trait `object` | `character_trait` | CLOSED | spec |
| `gender` | `male` `female` `other` | CLOSED | spec |
| `blood_type` | `a` `b` `ab` `o` | CLOSED | spec |
| `roster_role` | `main` `secondary` `appears` `unknown` | CLOSED | spec |
| `spoiler` | `none` `minor` `major` | CLOSED | spec |
| `sexual` | `safe` `suggestive` `explicit` `null` | CLOSED | spec |
| `violence` | `tame` `violent` `brutal` `null` | CLOSED | spec（当前恒 null） |
| `alias_kind` | `translation` `spelling_variant` | CLOSED | spec |
| `view` | `basic` `full` | CLOSED | spec |
| `trait_match` | `all` `any` | CLOSED | spec |
| 角色 `sort` | `id` `popularity` `relevance` `newest` | CLOSED | 实测（`sort=bogus` 的 400 报出 allowed 全集） |
| `total_relation` | `eq` `gte` | CLOSED | spec |
| `nsfw` | `true` `false`（只接受这两串） | CLOSED | spec |
| `refs.source` / `links.source` | 19 个源，含 `vndb` `bangumi` `dlsite` `erogamescape` `getchu` `official_site` `derived` … | **OPEN** | spec（未知值不得 400） |
| `measurements.cup` | 无枚举，字符串 | OPEN | spec |

客户端约定：**CLOSED 词表出现未见过的值要当成契约被破坏；OPEN 词表出现新值必须容忍。**

## 9. 原始样本（已裁剪）

### 9.1 角色列表 `view=full&nsfw=true` 的一条（`live-char-full.json`，traits 截断到 3 条）

```json
{
  "object": "character",
  "id": "1",
  "display_name": "国崎往人",
  "latin": null,
  "lang": "ja",
  "localized": {
    "ja": { "value": "Kunisaki Yukito", "is_machine": false },
    "zh-Hans": { "value": "国崎往人", "is_machine": false }
  },
  "gender": "male",
  "image": {
    "url": "https://image.kungal.iloveren.link/26/65/26655cd9….webp",
    "hash": "26655cd93f91b08fa1ec03ce7301d7b07e597f7e44f70babde052dfcb7315b3b",
    "width": 250,
    "height": 300,
    "thumbhash": "GgiKBABHWfdHd3h2Z1YHR35wcEiIh4h4BQ==",
    "sexual": "safe",
    "violence": null,
    "source": ""
  },
  "traits": [
    {
      "object": "character_trait",
      "id": "2932",
      "display_name": "Eye Covering",
      "group": "Hair",
      "localized": { "zh-Hans": { "value": "遮眼", "is_machine": false } },
      "group_localized": { "zh-Hans": { "value": "毛发", "is_machine": false } },
      "spoiler": "none",
      "is_sexual": false,
      "is_lie": false
    }
  ],
  "links": [
    { "source": "vndb", "url": "https://vndb.org/c9990", "is_identity": true, "page_id": "c9990" }
  ],
  "aliases": [
    { "lang": "ja", "value": "Kunisaki Yukito", "alias_kind": "spelling_variant", "is_machine": false }
  ],
  "intros": [
    { "lang": "en", "value": "A young traveler on a journey…", "is_machine": false, "source": "vndb" }
  ],
  "refs": [
    { "source": "vndb", "external_id": "c9990" }
  ],
  "work_count": 5
}
```

> 该角色**没有任何** `birthday`/`blood_type`/`height_cm`/`weight_kg`/`measurements` 键 —— 这就是 3.4 说的稀疏。

### 9.2 名册行（`live-work-chars.json`，`works/4/characters`）

```json
{
  "object": "character",
  "id": "7937",
  "display_name": "久島鴎",
  "latin": null,
  "localized": {
    "ja": { "value": "Kushima Kamome", "is_machine": false },
    "zh-Hans": { "value": "久岛鸥", "is_machine": false }
  },
  "roster_role": "main",
  "spoiler": "none",
  "identity": "roster:7937",
  "voices": [
    {
      "object": "credit_name",
      "id": "2762",
      "display_name": "嶺内ともみ",
      "latin": null,
      "lang": "ja",
      "localized": {},
      "person_id": "1933"
    }
  ],
  "image": {
    "url": "https://image.kungal.iloveren.link/cc/d3/ccd3b1….webp",
    "hash": "ccd3b1233b0bf7777abbab6575ae2386fadfb0ff5c8dd0d9500266830da47099",
    "width": 250,
    "height": 300,
    "thumbhash": "GPeBDABHS3N5VPKmWPhKdq91gEiHaIl3Bw==",
    "sexual": "safe",
    "violence": null,
    "source": ""
  },
  "figure": {
    "url": "https://image.kungal.iloveren.link/8c/b7/8cb786….webp",
    "hash": "8cb78686285d948ac1169b5fa3caff28d7f14acc4548b693839ad395b6a28fa1",
    "width": 229,
    "height": 428,
    "thumbhash": "HCiGEwI4WIK8uAewsAwLywWHtWVjmGc=",
    "sexual": "safe",
    "violence": null,
    "source": ""
  }
}
```

### 9.3 出场反查行（`live-char-appear.json`，`characters/1/appearances`，work 块裁剪）

```json
{
  "object": "appearance",
  "work": {
    "object": "work",
    "id": "2156",
    "display_name": "AIR",
    "content_rating": "r18",
    "content_limit": "sfw",
    "cover": null,
    "banner": null,
    "claim": { "site": "kungal", "site_work_id": "2156", "state": "live", "content_limit": "sfw" }
  },
  "roster_role": "main",
  "spoiler": "none",
  "identity": "roster:1",
  "voices": [
    { "object": "credit_name", "id": "92178", "display_name": "緑川 光", "latin": null, "lang": "ja",
      "localized": { "zh-Hans": { "value": "绿川光", "is_machine": false } }, "person_id": "5722" }
  ]
}
```

## 10. 落库建议

沿用现有 `galrc_` 前缀与 `idx_galrc_` 索引命名，与 `galrc_kungal_works` 的风格一致。

### 10.1 `galrc_kungal_characters`（角色主表，一行一角色）

**做标量列**（详情页/卡片直接渲染、要排序过滤的）：

| 列 | 类型 | 来源 | 说明 |
| --- | --- | --- | --- |
| `id` | text PK | `Character.id` | 鲲角色 id |
| `vndb_cid` | text, unique | `refs[]` 中 `source=vndb` 且 `^c\d+$` | 角色级 vndb 锚点，**不来自 vndb API**；无锚点则 null |
| `display_name` | text not null | `display_name` | |
| `latin` | text | `latin` | 可空 |
| `lang` | text | `lang` | 可空 |
| `gender` | text | `gender` | 可空；枚举 male/female/other |
| `birthday` | text | `birthday` | **`MM-DD` 字符串，别塞 date**（没有年份） |
| `blood_type` | text | `blood_type` | 可空；a/b/ab/o |
| `height_cm` | integer | `height_cm` | 可空 |
| `weight_kg` | integer | `weight_kg` | 可空 |
| `bust_cm` / `waist_cm` / `hip_cm` | integer | `measurements.*` | **拆成三列**（比 jsonb 好过滤，且都是 int） |
| `cup` | text | `measurements.cup` | 可空；无枚举 |
| `image_url` / `image_hash` / `image_width` / `image_height` / `image_thumbhash` / `image_sexual` | text/int | `image.*` | 头像，卡片直接用，避免查 jsonb |
| `figure_url` / `figure_width` / `figure_height` / `figure_thumbhash` | text/int | `figure.*` | 立绘，**可为空**（多数角色没有） |
| `work_count` | integer | `work_count` | |
| `instance_of_id` | text | `instance_of_id` | 自引用，可空 |
| `intro` | text | `intros` 里裁定一条（zh-Hans → zh → en → 首条） | 与 `galrc_kungal_works.intro` 同样的裁定策略 |
| `synced_at` | timestamptz | 同步时间 | |

**做 jsonb**（只取来展示、不拿来过滤）：

| 列 | 来源 | 理由 |
| --- | --- | --- |
| `localized` | `localized` | BCP-47 稀疏 map，键集合不稳定 |
| `aliases` | `aliases[]` | 一般只做展示 |
| `intros` | `intros[]` | 多语言原文留着，`intro` 是裁定结果 |
| `links` | `links[]` | 外链列表 |
| `refs` | `refs[]` | 原始锚点，`vndb_cid` 是它的投影 |
| `traits` | `traits[]` | **一行 40–50 条**，且要连 `spoiler`/`is_sexual` 一起在下发时按可见性过滤，做关系表 join 得不偿失 |

索引建议：`uniqueIndex(vndb_cid)`（可空唯一，同 `galrc_kungal_works.vndb_id` 的处理）、`index(display_name)`。

### 10.2 `galrc_kungal_character_works`（角色 × 作品名册，一行一出场）

由 `works/{id}/characters` 的 `roster_role`/`spoiler`/`identity` 落库，**主键 `(character_id, work_id)`**：

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `character_id` | text not null → `galrc_kungal_characters.id` onDelete cascade | |
| `work_id` | text not null → `galrc_kungal_works.id` onDelete cascade | |
| `roster_role` | text | main/secondary/appears/unknown |
| `spoiler` | text | none/minor/major |
| `identity` | text | 不透明串，原样存（未来提名单要用） |
| `voices` | jsonb | CV 列表；**本期不入独立表**，见下 |

索引：`pk(character_id, work_id)`、`index(work_id)`（条目页按作品取角色是热路径）。

### 10.3 CV / voices 的取舍

- 本期**不建独立 CV 表**：角色卡不展示声优，`CreditName` 只用来在需要时显示一行名字。
- 若要显示，直接读该行的 `voices` jsonb 取 `display_name` + `localized['zh-Hans'].value`。
- 注意名册里的 `CreditName` **只有 7 个必填键**，`birth_year`/`photo`/`aliases` 等只在详情面出现——不要按详情面的字段写 TypeScript 类型。

### 10.4 同步策略

1. 作品级：按已有 `vndb_id` 锚点解析出 `kungal work id`（现有 `resolveWorkByVndbId`）。
2. 名册：`GET /works/{kungal_work_id}/characters?limit=100&nsfw=true` 拉全（分页用 `next_cursor`，一般一页够）。
3. 水合：把名册 id 每 100 个一批拼 `GET /characters?ids=…&view=full&nsfw=true`，拿 `traits/gender/birthday/measurements/refs` 等。
4. upsert：角色主表按 `id` `onConflictDoUpdate`；名册表按 `(character_id, work_id)` `onConflictDoUpdate`。
5. **批内必须先去重**：PostgreSQL 的 `ON CONFLICT DO UPDATE` 在同一语句里命中两行相同键会抛 `21000 cannot affect row a second time`。`ids=` 与多页 `works/{id}/characters` 都可能带重复 id，入库前按 Map 去重。
6. `nsfw=true` 要传：不带会剔除 r18 作品，导致 r18 作品的角色名册为空。

## 11. 推测 / 未证实清单

以下几条**没有 spec 明文**，是按实测或类比推断的，落地时按「可能变」对待：

1. **`view=full` ≈ 打开全部 15 个 include 块**。实测两次都成立，但 spec 的 `view` 描述只列了 "gender/birthday/measurements/blood_type/instance_of_id"，没写会连 `image/traits/aliases/intros/refs/links/work_count` 一起给。若线上收紧，最稳的写法是 **`view=full` + 显式 `include=`** 双保险。
2. ~~**`sort` 的合法键**~~ **已实测确认**：`id` / `popularity` / `relevance` / `newest`（`sort=bogus` → 400 `UNKNOWN_SORT`，错误体 `errors[0].params.allowed` 列出全集）。注意 `sort=relevance` 必须带 `q=`。
3. ~~**`nsfw` 是否过滤名册里的 `image`**~~ **已实测确认**：不过滤图片，而是**整部 r18 作品在 `nsfw=false` 下 404**（见 2.2）。
4. ~~**`spoiler` 默认值会不会藏掉 trait**~~ **已实测确认**：默认 `none` 只返回无剧透 trait，**少 20%–35%**；要全量必须显式 `spoiler=major`。见 3.5。注意 `spoiler` 参数**只在单角色详情端点**上存在，`characters?ids=` 列表批量通道没有这个参数——所以批量水合时 trait 一定是被裁剪过的。
5. **`cup` 的取值范围**：无枚举，实测样本为 null，未见到真实值。推断是 `A`–`H` 之类的字符串。
6. **`work_count` 与 `appearances` 条数的一致性**：spec 说同口径、同可见性门，未做全量对账。
7. **`identity` 字段的出现条件**：spec 写「只有当角色**通过名册面**到达时才出现」。实测 `works/4/characters` 有、`appearances` 也有，两条都是 `roster:<character_id>` 形状——但 spec 明说它是**不透明串，不许重建**，所以只存不解析。
8. **`refs` 里 vndb 角色 id 的格式**：实测为 `c9990`。是否所有角色都有 vndb 锚点未统计（`galrc_kungal_works.vndb_id` 的经验是无锚点的不少）。

## 12. 与先前口头结论的两处更正

1. **`CharacterTrait` 不含 `name_zh` / `vndb_tid` / `group_id`。** 行内 trait 只有 9 个键（见 5.5）。带 `name_zh`/`vndb_tid` 的是**目录 Trait**（`/v2/catalog/traits`）。行内中文名走 `localized['zh-Hans'].value`；要 vndb tid 得用 `id` 回查目录，或另存一张 trait 词表映射。
2. **`/catalog/characters/{id}/appearances` 的 path id 是 character id**，spec 描述里的 "Decimal catalog work id" 是复制粘贴错误；实测角色 1 → AIR 等作品。
