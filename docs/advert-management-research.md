# 广告位管理调研与落地方案

> 目标：把顶部广告位从「单表 + 硬编码位置」升级为行业通用的
> **广告位（Slot/Position）+ 广告素材（Creative/Campaign）** 两级管理模型，
> 支持排期、设备定向、权重轮换、启停状态与曝光/点击统计。
>
> 本文是 2026-10 的调研记录与实现说明，代码见 `apps/api/src/modules/adverts/`、
> `apps/web-tanstack/src/components/adverts/` 与后台「内容管理 → 广告位」。

## 1. 调研：行业里通常怎么管广告

### 1.1 Google Ad Manager（广告服务器的事实标准）

GAM 把广告拆成几个层级：

| 层级 | 作用 |
| --- | --- |
| Order（订单） | 一个广告主/一次合作的容器 |
| Line item（投放项） | 真正的投放指令：排期、定向（设备/地域/受众）、优先级、频次上限、目标 |
| Creative（素材） | 用户看到的图片/HTML/视频，挂在 line item 下 |
| Ad unit（广告位） | 站点上的展示区域，可做层级（首页 > 顶部横幅），网页通过 ad tag 请求 |

关键结论：**广告位只描述「位置」，素材只描述「内容」，排期/定向/优先级是两者之间的投放规则**。
参考：[Understanding Key Terminology in Google Ad Manager](https://proofmedia.uk/understanding-key-terminology-in-google-ad-manager-ad-units-line-items-creatives-orders-and-ad-tag)、
[Ad Manager 帮助：Ad unit hierarchy](https://support.google.com/admanager/answer/177203)、
[About line items](https://support.google.com/admanager/answer/9405477)。

### 1.2 Advanced Ads（WordPress 生态最常见的广告管理插件之一）

- **Placements（广告位）**：主题/内容里预定义的展示位置（页头、正文前、页脚、手动位置等），集中管理注入；
- **Ads（广告/素材）**：图片、链接、广告代码，并带 **Display Conditions**（设备、页面类型、访客条件等）；
- **Ad Groups（轮换组）**：Random Ads（按 **权重** 随机）/ Ordered Ads（按权重排序，同权重随机）/ Slider / Grid；
  **Visible Ads** 控制同一位置一次展示几条，**Refresh Interval** 控制定时换一条；
- **Tracking**：曝光（impressions）、点击（clicks）、CTR。
- 权重语义：权重只影响「谁被选中」的概率（Random）或顺序（Ordered），不改变内容本身；权重 0 等价于在该组内停用。

参考：[Placements](https://wpadvancedads.com/manual/placements/)、
[Ad Groups](https://wpadvancedads.com/manual/ad-groups/)、
[Display Conditions](https://wpadvancedads.com/manual/display-conditions/)、
[Tracking](https://wpadvancedads.com/manual/tracking/)。

### 1.3 国内建站 / CMS 的常见做法

DedeCMS、帝国 CMS、各类 WordPress 中文广告插件基本是同一套：

1. **广告位**：标识（模板里调用）、名称、尺寸/类型（图片/文字/代码）、是否启用；
2. **广告**：图片/文字/代码、跳转链接、所属广告位、起止时间、权重/排序、状态；
3. 模板按广告位标识调用，前台只输出「当前在投」的广告；
4. 后台查看点击（部分带曝光）统计，按广告位/时间筛选。

### 1.4 归纳：行业通用管理模型

| 能力 | 行业叫法 | 本项目落地 |
| --- | --- | --- |
| 广告在哪展示 | Placement / Ad unit / 广告位 | `galrc_ad_slots`（`key` + 名称 + 同屏条数 + 手机端策略 + 轮播间隔） |
| 展示什么 | Creative / Ad / 素材 | `galrc_adverts`（图片、链接、备注） |
| 什么时候展示 | Schedule / 排期 | `start_at` / `end_at`，状态由二者 + 启停推导 |
| 给谁展示 | Targeting / 定向 | `device`（全部 / 仅桌面 / 仅移动）；页面级定向由「广告位」承担 |
| 多条怎么轮换 | Weight / Rotation | `weight` + 排序；候选多于展示位时按权重随机不重复抽取 |
| 开关 | Status | `enabled` + 排期 → 投放中 / 未开始 / 已结束 / 已停用 |
| 效果 | Tracking / 统计 | `impressions` / `clicks`，后台展示 CTR |
| 模板怎么调用 | Ad tag | `GET /adverts/slot/:key`（SSR 预取 + Redis 60s 缓存） |

## 2. 落地方案

### 2.1 数据模型

**广告位 `galrc_ad_slots`**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | serial PK | |
| `key` | varchar(64) unique | 模板调用的标识，如 `home_top`，只允许小写字母/数字/下划线 |
| `name` | varchar(255) | 后台展示名 |
| `description` | text | 备注 |
| `max_items` | integer | 同一轮展示条数（桌面并排 / 手机轮播的条数），1–4 |
| `mobile_mode` | varchar(16) | 手机端：`carousel` 轮播 / `stack` 竖向堆叠 / `hidden` 不展示 |
| `carousel_interval` | integer | 手机轮播间隔（秒），0 = 不自动切换 |
| `enabled` | boolean | 整个广告位启用开关 |
| `created_at` / `updated_at` | timestamptz | |

**广告素材 `galrc_adverts`（在 0028 基础上扩展）**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `slot_id` | integer FK → `galrc_ad_slots` | 所属广告位（ON DELETE CASCADE，但 API 禁止删除有素材的位） |
| `name` | varchar(255) | 后台识别名 / 图片 alt / umami 事件名 |
| `image` | text | 站内路径或 https 外链 |
| `href` | text | 点击跳转（仅 http/https） |
| `description` | text | 后台备注，前台不展示 |
| `device` | varchar(16) | `all` / `desktop` / `mobile`（替代旧 `show_on_mobile`） |
| `weight` | integer | 轮换权重，默认 10；候选多于展示位时才生效 |
| `start_at` / `end_at` | timestamptz | 排期，可空（立即开始 / 长期） |
| `sort_order` | integer | 位内手动排序（候选不超额时按它展示） |
| `enabled` | boolean | 单条启停 |
| `impressions` / `clicks` | bigint | 曝光 / 点击计数 |

### 2.2 前台行为（当前唯一位置：`home_top`）

- 根布局 `beforeLoad` 预取 `GET /adverts/slot/home_top`，SSR 首帧出广告（无布局跳动）；
- 桌面：1 条整宽，多条按两列网格（保持现有设计）；条数上限由广告位 `max_items` 决定；
- 手机：按 `mobile_mode` 决定轮播 / 堆叠 / 不展示；轮播间隔取 `carousel_interval`，
  支持手势滑动、圆点、悬停与键盘聚焦暂停、`prefers-reduced-motion`；
- 设备定向在服务端完成：桌面拿 `device ∈ {all, desktop}`，手机拿 `device ∈ {all, mobile}`；
- 曝光：素材可见 50% 持续 1s 上报一次；点击：跳转同时上报；上报失败静默忽略，不影响页面。

### 2.3 后台 UX（内容管理 → 广告位）

两个 Tab：

1. **广告位**：列表（标识、名称、同屏条数、手机端策略、轮播间隔、素材数、启用状态），
   新增/编辑/删除；删除时若有素材先拦截；
2. **广告**：按广告位筛选；列表展示缩略图、名称/链接、广告位、状态（投放中/未开始/已结束/已停用）、
   设备、权重、曝光/点击/CTR；拖动排序（限定在单个广告位内）；新增/编辑表单包含
   广告位、图片（URL + 预览）、跳转、备注、设备定向、权重、排期（datetime-local）、启用开关。

### 2.4 API

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/adverts/slot/:key` | 公开 | 返回 `{ slot, desktop[], mobile[] }`，只含在投素材 |
| POST | `/adverts/track` | 公开 | `{ id, type: impression \| click }` 自增统计 |
| GET | `/adverts/slots` | 管理员 | 广告位列表（含素材数） |
| POST | `/adverts/slots` | 管理员 | 新建广告位 |
| PUT | `/adverts/slots/:id` | 管理员 | 修改广告位 |
| DELETE | `/adverts/slots/:id` | 管理员 | 删除广告位（有素材时 400） |
| GET | `/adverts/all?slotId=` | 管理员 | 全部素材（含未开始/已结束/停用） |
| POST | `/adverts` | 管理员 | 新建素材 |
| PUT | `/adverts/reorder` | 管理员 | `{ slotId, ids }` 位内拖动排序 |
| PUT | `/adverts/:id` | 管理员 | 修改素材（部分更新） |
| DELETE | `/adverts/:id` | 管理员 | 删除素材 |

### 2.5 缓存、轮换与统计

- 公开数据按广告位缓存 60s（`galzy:adverts:slot:<key>`），存「广告位 + 所有在投素材」，
  设备过滤与权重抽取在内存中完成；写操作**精确失效受影响的广告位 key**（1~2 个 DEL，
  不扫全库），后台改完下一次请求即生效；
- 权重语义与 Advanced Ads 对齐：候选 ≤ 展示位时按 `sort_order` 稳定展示（避免首页两条广告随机跳动），
  候选 > 展示位时按 `weight` 不放回随机抽取，抽完再按 `sort_order` 排序；
- 统计不参与缓存；曝光/点击直接自增计数（单站量级足够），管理端展示 CTR。

### 2.6 迁移（0029）

- 新建 `galrc_ad_slots` 并种入默认广告位 `home_top`（名称「首页顶部横幅」，max_items=2，手机轮播 5s）；
- `galrc_adverts` 增加 `slot_id` 并回填到 `home_top`，再收紧 NOT NULL；
- 用旧 `show_on_mobile` 回填 `device`（`false → desktop`，否则 `all`），随后删除旧列；
- 新增统计列与位内排序索引；DDL 全部幂等（`IF NOT EXISTS` / `DO` 块），可安全重放；
- 迁移只做加法与一次语义等价的数据转换，不触碰其他表。

## 3. 取舍说明

- **为什么不再用「一条广告表」**：广告位是配置（长得像站点结构），素材是数据（会长很多）；
  两级分开后新增广告位不需要改表结构。
- **为什么权重不总是生效**：固定首页两条广告时，随机轮换会让版位跳动、难以核对投放；只在
  「候选多于展示位」时轮换，兼顾行业习惯与运营可预期性。
- **为什么设备定向放在素材而不是广告位**：同一广告位在不同设备上往往要投不同尺寸的素材，
  Google Ad Manager / Advanced Ads 都放在素材/投放层。
- **统计为什么直写数据库**：站点是单实例 + 低写入量，直接自增比「Redis 缓冲 + 定时落库」简单可靠；
  若未来量级上来，可把 `track` 换成 Redis INCR + 定时 flush，接口与前端不变。

## 4. 验证（本次实际执行）

- 迁移：`db:up` 应用 0029；把 17 条语句原样重放一遍全部 no-op；`db:check` 通过；
  `db:verify-migrations` 24 条文件/日志一一对应；`db:generate` 报 No schema changes（快照无漂移）。
- 服务端：临时 API 验证 `GET /adverts/slot/home_top` 返回桌面/手机两份投放；
  设备定向（`desktop` 素材进桌面、不进手机）、排期（未开始/已结束不下发）、
  候选多于 maxItems 时权重抽样（90:10 权重 200 次 → 184:16）、`POST /adverts/track` 计数自增；
  管理接口无会话 401；脚本覆盖 CRUD / 409 key 冲突 / 400 有素材删位 / 400 排期倒置 /
  404 / 四种 status / 排序 / 缓存命中与精确失效（写 A 位不影响 B 位缓存）。
- 前端：`AdSlotView` 12 条单测（0 条 / 1 条整宽 / 2 条并排 / 多条、`stack`、`hidden`、
  轮播圆点、曝光 1s 上报、不可见取消、点击上报）；全量 Vitest 281 条通过；
  真实 dev server 下 SSR 输出 2 条并排 + 手机 2 张轮播 + 2 个圆点，并截图冒烟。
- 管理端：`tsc --noEmit` 与 oxlint 通过（本机没有管理员会话，后台只做了类型/静态校验与代码审查）。
- 类型检查：api / web 两个 workspace 的 `tsc --noEmit` 均为 0 错误。

## 5. 后续可扩展

- 素材上传（当前填 URL，可复用 `/api/upload-image`）；
- 页面/地区/访客定向、频次上限、按时间段的投放计划；
- 更多广告位（详情页页内、下载框、侧栏）——只要在前台加一个按 key 读取的组件；
- 统计按日聚合与趋势图（`galrc_stat_counters` 已有类似模式可复用）。
