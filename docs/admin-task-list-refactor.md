# 后台任务列表页重构方案（诊断 → 设计 → 契约 → 关键代码 → 验收）

> 对象：`apps/web-tanstack/src/components/admin/tasks-page.tsx`（1492 行，主组件 657 行）+ `apps/web-tanstack/src/routes/admin/_authL/tasks.tsx`（21 行）+ `apps/api/src/modules/tasks/*`
> 立场：**先诊断后重构**。本文不重写那 1492 行，只给判断、边界、契约与可落地的关键切片。
> 证据全部可回溯：`文件:行号`；三份只读审计见 `.dsh-research/ui-audit.md`、`.dsh-research/api-audit.md`、`.dsh-research/router-audit.md`。
> 行号说明：§1–§6 的 `tasks-page.tsx:NNNN` 是审计时点工作区快照的行号，与仓库 HEAD 的 868 行版本不能一一对应（该文件已在 §11 中删除），引用只当定位线索用。
> 状态：第 1–10 章为设计定稿（保持设计时点原样）；PR-A ~ PR-E 已于 2026-10-27 落地，实际做了什么看 **§11 实施记录**。

---

## 0. 先看这里

### 0.1 一句话结论

任务页不是「缺几个控件」，而是**四套互不相通的筛选语言 × 三个状态真源 × 一套没有受控入口的表格套件**叠加出来的：
状态筛选在 Tabs 和 KPI 卡各写一遍（`tasks-page.tsx:1296`、`:1253`），队列筛选在泳道和工具条各写一遍（`:1284`、`:1359`），搜索是「只过滤当前页 20 条」的假搜索（`:988-997`），计数是全局的、与筛选脱钩（`:1304-1317`），而全部 10 个状态都是内存 `useState`（`:840-852`）。
所以正确顺序是：**先定唯一筛选模型与 URL 真源 → 再补表格/工具条能力 → 最后拆组件**。反过来做，只是把 1492 行拆成 8 个各自用 `useState` 的文件。

### 0.2 假设清单（信息不足处，均给出验证方式）

| # | 假设 | 影响面 | 若不成立怎么办 | 验证方式 |
|---|---|---|---|---|
| H1 | 本页服务对象是**后台任务队列**（VNDB/Kungal/Meili/Cloudreve 同步），不是通用项目管理看板 | 决定字段模型 | 见 H2 | schema `task-log.ts:14-46` 只有队列语义 |
| H2 | 现有模型**没有** 优先级 / 负责人 / 截止时间 三个字段 | 「优先级/负责人/截止时间 + 逾期高亮」无法直接落地 | 方案 A（默认）：由 `payload` + 队列 SLA 推导；方案 B（Phase 4）：加 `priority/assignee_id/due_at` 三列 | `task-log.ts` 全表；`libs/queue/payload.ts:8-18` 无相关键 |
| H3 | 优先级可由「队列语义 + 任务类型」映射（vndb-full 高、meili 中、prune 低），不必新增列 | Phase 4 是否阻塞 | 若必须人工设优先级，先只做只读标签 | §6.2 派生规则 |
| H4 | 「负责人」在无账号归属的任务里显示为**触发来源**（手动触发 / 定时调度 / 系统链式），不显示人名 | 列文案与筛选 | 若要显示管理员，需 `payload.triggeredBy`（当前未写，Phase 4） | `server/admin/tasks.ts:164-177` 入队不带操作人 |
| H5 | 「截止时间」用 **SLA 推导**（startedAt + 该类型期望时长），而非人工设定 | 逾期高亮可实现 | 若业务确有硬截止，Phase 4 加 `due_at` | 队列无 deadline 语义 |
| H6 | 单管理员场景，只有 admin / 非 admin 两态，无行级数据权限 | 权限禁用说明的粒度 | 若多角色，需 policy 函数 | `_authL.tsx:13-21` 只判 role |
| H7 | 后端可改（本方案含 API 契约 V2），不是纯前端重构 | 搜索/排序/多选能否服务端化 | 若后端冻结：降级为「前端分页 + 本页筛选」并明示局限 | 用户要求含「API 契约」一节 |
| H8 | 目标浏览器支持 `matchMedia` 与 CSS 断点 | 小屏方案 | 退回 `useIsMobile` | Tailwind v4 + base-ui |
| H9 | 规模：90 天保留期、通常 < 1 万行 | 分面/count 成本可接受 | 超 10 万行改 keyset + 缓存 | `api-audit.md` §3.1 |
| H10 | 「详情用右侧抽屉」= 桌面右侧 `Sheet`、移动底部 `Drawer`，共用 `?job=` | 组件树与状态设计 | 若要全端底部抽屉可退化（不推荐） | `drawer.tsx:34-39` 只能底部；`sheet.tsx:39-48` 支持 right |

---

## 1. 问题诊断

### 1.1 症状 → 根因（按用户的抱怨对齐）

| # | 抱怨 | 实际现象（证据） | 根因层 | 影响 |
|---|---|---|---|---|
| D1 | **筛选乱** | 同一维度 4 个入口：状态 Tabs（`:1296-1319`）+ KPI 卡点击改状态（`:1253-1274`）+ 队列泳道（`:1284-1292`）+ 工具条队列下拉（`:1359-1370`）；两处能改同一个 `status` | 信息架构：无唯一筛选模型 | 建不起心智模型，两处看起来会不一致 |
| D2 | 筛选乱（续） | 搜索只过滤**当前页 20 条**，placeholder 自己写着「在本页搜索」（`:1356`、`:988-997`）；搜索词不进 queryKey | 状态真源：客户端过滤冒充查询条件 | 搜不到历史任务；页脚 `total` 与列表条数矛盾 |
| D3 | 关键信息不突出 | 任务列把「类型 + ID」挤成一列（`:1043-1052`）；进度条占 40% 宽（`:1069-1081`）；无耗时/SLA/逾期概念；状态/队列/类型三张硬编码字典（`:104-123`）与后端 `QUEUE_TASKS`（`libs/queue/types.ts:29-35`）两处维护 | 数据模型 + 信息层级 | 扫视时看不出「哪条在烧时间 / 哪条已失败两次」 |
| D4 | 行内操作难找 | 6 个操作**全部**塞进 ⋯：查看日志/复制 ID/重试/重放/丢弃/删除（`:1116-1177`） | 组件 API：`RowActionsMenu` 只有「更多」（`row-actions.tsx:20-28`） | 高频操作每次 2 次点击 + 扫菜单 |
| D5 | 无批量操作 | 只有批量删除与「清理终态」（`:1416-1437`、`:1377-1393`），后者只作用于当前页可见行；无批量重试（API 也没有） | 契约缺失 + 选择语义未定义 | 5 条失败任务要操作 5 遍 |
| D6 | 空/加载/错误不完整 | 空态只有一种（`:1328-1335`）；`listQuery.error` **从未读取**（`:870-883`），接口 500 时渲染「暂无任务记录 + 手动触发」；表格套件本身无 `error/onRetry`（`data-table.tsx:118-152`） | 状态机缺失 | 把故障误报成「没数据」——最严重 |
| D7 | 刷新后筛选丢失 | 10 个 `useState`（`:840-852`）全不在 URL；路由 21 行无 `validateSearch`（`tasks.tsx:1-21`） | 状态真源：内存态 | 不可分享、不可后退、刷新回默认 |
| D8 | 小屏不可用 | 768–1023px：桌面详情栏 `hidden lg:block`（1024）被隐藏，移动抽屉要求 `isMobile`（768）⇒ **点击行毫无反馈**（`:1442-1465`）；KPI 2 列 × 5 张吃掉首屏（`:1238`）；7 个 Tabs 横向滚动（`:1303`） | 两套断点（JS 768 / CSS 1024） | 平板与小窗直接不可用 |

### 1.2 五个结构性根因（重构要动的边界）

**根因 1：没有「唯一筛选模型」。**
`status/queue/search/page/pageSize` 散在 10 个状态里，控件直接 `setXxx`。控件数量 ≠ 筛选维度：状态 4 个入口、队列 2 个、搜索是第 5 种语义（本页过滤）。必须先把 `TaskListParams` 定义出来，所有 UI 都只是它的**视图**。

**根因 2：URL 不是真源。**
仓库里 `validateSearch` 已是 13 处的成熟惯例（`meilisearch.tsx:52` 是后台唯一先例），任务页却没用。代价不只是「刷新丢筛选」：详情无法深链；分页越界没有任何一层负责（`pagination.tsx:23-24` 在 `page=5/pageCount=3` 时渲染出页码 0）。

**根因 3：表格套件「有接口、没消费者、半成品」。**
`AdminDataTable` 支持排序（`data-table.tsx:128-130`），但**全后台 7 个页面没有一个传 `sort`**；支持列显隐，但 `visibleColumns = columns.filter(c => !c.defaultHidden)`（`data-table.tsx:189`）根本没读外部 `visibility`，菜单勾选对表格无效，`users-page.tsx:390-392` 只能自己再过滤一遍。工具条只有下拉式 chip，没有 `advanced` 槽、没有单 chip 删除（`toolbar.tsx:92-114`）。行操作只有 ⋯，`disabled` 无原因（`types.ts:49`）。
**结论：重构要同时做「消费」与「补齐可选 prop」，但只加可选参数，不重写套件**（否则 7 个页面一起回归）。

**根因 4：后端契约远窄于 UI 承诺。**
`GET /tasks` 只有 3 个单值等值 + 固定 `created_at DESC`（`service.ts:344-371`）；`type` 是死能力（model/service/BFF 全支持，页面从不传）；无 `q`、无多选、无时间范围、无排序白名单；列表还把 `payload/result` 两个 jsonb 全量返回（`service.ts:361`）。统计是全表 `GROUP BY`（`service.ts:374-397`），与列表筛选脱钩，于是「失败 12」点进去可能只有 2 条。

**根因 5：写操作语义不安全。**
`retryJob` 非幂等（每次新 jobId，`service.ts:340`）；`deleteJob/batchDelete` 不校验终态、两条 DELETE 无事务（`service.ts:281-282`）；批量无 `maxItems`（`model.ts:20-22`）；死信操作二次调用返回 404（`service.ts:239-242`）。前端却把删除挂在 6 项菜单里、无状态门控。

### 1.3 顺手要修的 6 个现存 Bug（必须进验收）

| # | Bug | 证据 | 修法 |
|---|---|---|---|
| B1 | 列显隐是「假支持」，勾掉菜单表格不变 | `data-table.tsx:189` | 加 `visibleColumnIds`（§7.3） |
| B2 | 接口失败显示成「暂无任务记录」 | `tasks-page.tsx:870-883`、`:1328-1335` | 表格加 `error/onRetry`，三态分流 |
| B3 | 768–1023px 详情无任何反馈 | `:1442-1465` | 详情统一走 `?job=` + 右侧 Sheet，渲染权交给 CSS |
| B4 | 越界页码渲染出「0」页并重复数字 | `pagination.tsx:23-24` | URL 层 clamp + 组件防御 |
| B5 | 「记录总数」标注「最近 500 条」，实际是全表（90 天保留） | `:1275-1281` vs `service.ts:374-397` | 文案改「全表 · 90 天保留」，或删掉该卡 |
| B6 | 泳道徽标只取 `waiting`（`:1017`），与卡片上「运行/等待/延迟」自相矛盾 | `:1017`、`:331-339` | 泳道改摘要 + 分面数字同源 |

### 1.4 现状基线（用于验收对比）

| 指标 | 现状 | 目标 |
|---|---|---|
| 单文件行数 | 1492（主组件 657） | 单文件 ≤ 250，页面编排 ≤ 200 |
| 状态真源 | 内存 `useState` × 10 | URL 1 份 + Query 缓存 + 2 个局部 UI 态 |
| 落服务端的筛选维度 | 2 / 5（status、queue） | 5 / 5（+ q、type、时间、逾期） |
| 高频操作点击成本 | 2 次（⋯ → 选项） | 1 次（图标按钮） |
| 首屏失败可见性 | 显示空态（误报） | 错误态 + 重试 + 保留旧数据 |
| 排序 | 无（后端固定） | 5 个白名单字段，表头三态 |
| 列配置 / 密度 | 无 | 有（并持久化） |
| URL 可分享 | 否 | 是（筛选/排序/分页/详情） |
| 平板可用 | 否 | 是 |
| 轮询 | 2s × 3 查询，不感知可见性 | 自适应 + 后台暂停 |

---

## 2. 目标与设计原则

1. **单一筛选模型**：`TaskListParams` 是唯一真源，URL 是它的序列化；控件只能改参数。
2. **服务端筛选，客户端不二次过滤**：搜索/状态/队列/类型/时间/逾期全部进查询键；客户端只做显示层派生（标签、逾期高亮）。
3. **信息层级：先异常后流水**：顶部只留促使用户行动的数字（运行中/排队/失败/死信/逾期），且**点击即筛选**（与分段控件同源）。
4. **高频外露、低频收纳**：行内 1 个主操作（日志）+ 1 个条件性操作（重试），其余进 ⋯ 且带原因。
5. **三态齐备且可区分**：加载（骨架）/ 空（无数据 vs 筛选无结果 vs 无权限）/ 错误（可重试 + 保留旧数据）。
6. **写操作有边界**：仅终态可删、批量部分失败可解释、危险操作二次确认、进行中不可误删。
7. **渐进替换**：共享套件只加**可选 prop**，现有 7 个后台页零改动。

---

## 3. 页面布局

### 3.1 桌面（≥1280）：四段式

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 任务队列                                       [🔍 搜索任务 ID / 类型 / 错误] │
│ 监控 VNDB / Kungal / Meili / Cloudreve 同步    [刷新▾] [手动触发 ▾ 主操作]  │
├────────────────────────────────────────────────────────────────────────────┤
│ 运行中 2   排队 5   失败 3   死信 1   逾期 2        队列概览 [展开 ▾]       │
├────────────────────────────────────────────────────────────────────────────┤
│ [全部 23] [排队 5] [运行 2] [完成 12] [失败 3] [死信 1] [中断 0]            │
│ 队列 ▾   时间 ▾   高级筛选 (2) ▾                        列 ▾ 密度 ▾  ⟳ 5s  │
│ 已选：[状态: 失败 ×] [队列: VNDB 同步 ×] [近 7 天 ×]          清除全部      │
├────────────────────────────────────────────────────────────────────────────┤
│ □  任务                   状态      队列     进度      耗时   创建时间   ⋯  │
│ □  VNDB 全量同步          ● 运行中   VNDB     ▓▓▓▓░ 62%  12m    10:24   …  │
│    job_8f3a… · 手动触发                                                     │
│ □  VNDB 增量同步          ● 失败     VNDB     ▓▓░░░ 38%  3m12s  09:10   …  │
│    连接超时（第 3 次）                                                      │
├────────────────────────────────────────────────────────────────────────────┤
│ 已选 2 条   共 23 条 · 90 天保留        每页 20 ▾  ‹ 1 2 3 ›   [批量重试][删除] │
└────────────────────────────────────────────────────────────────────────────┘
                               ┌──────────────────────────┐
                               │ 任务详情（右侧 Sheet）    │ ← 点击行 → ?job=id
                               │ 状态 · 队列 · 进度        │
                               │ 耗时 / SLA / 逾期         │
                               │ 日志（增量轮询）           │
                               │ 结果 / 载荷               │
                               └──────────────────────────┘
```

**分区职责**

| 区 | 只放什么 | 不放什么 |
|---|---|---|
| 页头 | 标题、一句描述、全局搜索、刷新策略、**唯一主操作**（手动触发） | 任何筛选控件 |
| 概览条 | 5 个分面数字，点击 = 设置状态筛选 | 第二套状态 Tab |
| 筛选条 | 状态分段控件、队列多选、时间范围（常用三项外露）+ 高级（类型/仅逾期/仅可重试）+ chips + 列/密度/刷新 | 排序（在列头）、详情（在抽屉） |
| 表格 | 默认 7 列、行内高频操作、失败/逾期高亮 | 长文本（错误摘要截断，全文在抽屉） |
| 页脚 | 总数、批量条、分页 | 「清理终态」这类删除别名 |

### 3.2 中屏与小屏

```
中屏 768–1279                        小屏 <768
┌──────────────────────────┐        ┌────────────────────────┐
│ 任务队列      [🔍] [触发] │        │ 任务队列      [🔍] [＋] │
│ 运行2 排队5 失败3 死信1   │        │ 运行2 排队5 失败3      │  ← 概览横滚
│ 状态：横向滚动分段控件     │        │ [筛选 (3)]  [排序] [⋯] │  ← 筛选进 Sheet
│ [筛选▾][时间▾][高级▾]     │        │ 已选: 失败 × 队列 ×    │
│ 已选 chips…               │        │ ┌────────────────────┐ │
│ ┌──────────────────────┐ │        │ │ 任务卡片            │ │
│ │ 表格（列自动收敛）    │ │        │ │ 状态·耗时·进度      │ │
│ └──────────────────────┘ │        │ └────────────────────┘ │
└──────────────────────────┘        │ 详情：底部 Drawer 全屏  │
点击行 → 右侧 Sheet                  └────────────────────────┘
```

**断点规则（统一一套，不许 JS/CSS 各写一套）**

| 视口 | 表格 | 详情 | 工具条 | 实现 |
|---|---|---|---|---|
| ≥1280 | 全 7 列 | 右侧 Sheet 480 | 一行 | CSS `xl` |
| 1024–1279 | 列收敛 | 右侧 Sheet 400 | 两行 | CSS `lg` |
| 768–1023 | 卡片 + 关键列 | 右侧 Sheet 92vw | 两行 | CSS `md`，**不再用 `useIsMobile` 决定渲染** |
| <768 | 卡片 | 底部 Drawer 85dvh | 搜索 + 「筛选」 | CSS `md:hidden` |

> 修 B3 的关键：**「是否渲染详情」交给 CSS**（`hidden lg:block` / `lg:hidden` 成对），JS 的 `useIsMobile` 只用于行为（滚动锁、聚焦）。现状 `:1442` 把两者混用，才出现 768–1023 的真空洞。

### 3.3 默认列（为什么是这 7 列）

| 列 | 默认 | 可排 | 移动角色 | 说明 |
|---|---|---|---|---|
| ☑ 选择 | 是 | — | title 前 | 批量 |
| 任务 | 是 | 否 | title | 类型中文名 + ID 尾 6 位 + 触发来源；**失败时第二行显示错误摘要** |
| 状态 | 是 | 是 | meta | `StatusPill`；逾期时右侧加「逾期 12m」 |
| 队列 | 是 | 是 | meta | 短名（VNDB / Kungal / Meili / Cloudreve） |
| 进度 | 是 | 否 | body | 仅 running/queued 有意义，终态显示「—」 |
| 耗时 | 是 | 是 | meta | 终态 = 总耗时；运行中 = 已跑时长 |
| 创建时间 | 是 | 是（默认 desc） | meta | 相对时间 + Tooltip 绝对时间 |
| 优先级 | 否（列配置可开） | 是 | hidden | H2/H3：由队列语义派生 P0–P3 |
| 触发来源 | 否 | 否 | hidden | H4：手动 / 定时 / 系统链式 |
| 截止 / SLA | 否 | 是 | hidden | H5：dueAt 或 startedAt + slaMinutes |
| 操作 | 固定 | — | — | 高频图标 + ⋯ |

**逾期高亮规则（可测试）**

```ts
type SlaState = 'normal' | 'due-soon' | 'overdue' | 'stalled'
// 非终态 + 有 dueAt：now > dueAt → overdue；30min 内到期 → due-soon
// 非终态 + 无 dueAt：startedAt + slaMinutes(type) → 同上
// queued 且 createdAt + 队列等待 SLA（默认 10min）→ stalled
// 终态：永不逾期（完成得晚是历史事实，不该标红）
```

行样式：`overdue` → 整行 `bg-destructive/[0.04]` + 左缘 2px 红条 + 状态列「逾期 12m」；`stalled` → 左缘琥珀。不改字号/行高（避免跳行）。

---

### 3.4 原始需求 → 设计落点（逐条可追溯）

| 你的要求 | 落点 | 关键决策 |
|---|---|---|
| 顶部主操作 + 搜索 | §3.1 页头 / §7.1 | 主操作唯一（手动触发）；搜索是服务端 `q`，不再是本页过滤 |
| 常用筛选外露、高级折叠 | §3.1 筛选条 / §7.5 | 外露 3 项（状态/队列/时间），其余进「高级筛选」并带角标 |
| 筛选 chips 可删除 | §7.5 | chips 由参数派生，× 只移除该条件，不存副本 |
| 默认列合理 | §3.3 | 7 列：任务/状态/队列/进度/耗时/创建时间/操作 |
| 状态清晰 | §3.3 + §6.3 | 状态色 + 分面计数 + 终态显示「—」 |
| 优先级清晰 | §0.2 H2/H3、§6.2、§3.3 | 由「队列语义 + 类型」派生 P0–P3（默认隐藏列，可开）；**当前表无 priority 字段**，人工优先级列属 Phase 4 |
| 负责人清晰 | §0.2 H4、§3.3 | 映射为「触发来源」（手动/定时/系统链式）；**当前不入操作人**，要显示管理员需 Phase 4 写 `payload.triggeredBy` |
| 截止时间清晰 + 逾期高亮 | §0.2 H5、§3.3、§6.2 | 用 SLA 推导截止；逾期 = 非终态且超 SLA，行左缘红条 + 「逾期 Nm」；**当前无 due_at 字段** |
| 行内只放高频、低频收更多 | §7.4 | 日志 + 条件性重试外露；其余 ⋯ 且带禁用原因 |
| 批量选择与批量操作 | §5.4、§6.4、§9.4 | 批量重试/删除；跨页选择清空；部分失败逐项回报 |
| 列配置 / 排序 / 密度 / 分页 | §4.3、§7.3、§9.3 | 列配置修「假支持」；排序 5 字段白名单 + URL；密度持久化；分页 clamp |
| 详情右侧抽屉 | §7.6 | 桌面 `Sheet side="right"`，移动 `Drawer`，共用 `?job=` |
| 筛选/排序/分页同步 URL | §5.2、§5.3 | zod schema + `stripSearchParams`，URL 是唯一真源 |
| 空态区分无数据/筛选无结果 | §5.6、§7.2 | 三分支（含搜索无结果）+ 权限/队列不可用两分支 |
| 骨架 / 错误重试 / 权限禁用说明 | §5.6、§4.3、§7.4 | 骨架归表格层；错误态新增 `error/onRetry`；禁用项带 `disabledReason` |
| 小屏可用 | §3.2、§9.7 | 四档断点统一；修 768–1023 空洞；筛选收进 Sheet |

---

## 4. 组件树

### 4.1 文件级结构（拆分后）

```
apps/web-tanstack/src/
├── routes/admin/_authL/tasks.tsx                 # ~70 行：validateSearch + loaderDeps + loader + errorComponent
├── lib/admin/tasks/
│   ├── params.ts                                 # ★ schema + 默认值 + toTaskListFilters（唯一映射）
│   ├── query.ts                                  # ★ tasksQueryOptions：loader 与组件共用
│   ├── labels.ts                                 # 状态/队列/类型字典（Phase 3 改由 API /tasks/meta 下发）
│   ├── sla.ts                                    # 逾期/滞留判定（纯函数，可单测）
│   └── mutations.ts                              # 批量重试/删除 + 部分失败汇总
└── components/admin/tasks/
    ├── task-list-page.tsx                        # 编排：URL ↔ 参数、查询、抽屉挂载（≤180 行）
    ├── task-page-header.tsx                      # 标题 + 搜索 + 刷新策略 + 主操作
    ├── task-overview-bar.tsx                     # 5 个分面数字（点击=筛选）
    ├── task-queue-lanes.tsx                      # 现有 QueueLanes 抽出 + 默认收起
    ├── task-filter-bar.tsx                       # 常用外露 + 高级 Popover + 视图控制
    ├── task-filter-chips.tsx                     # 由参数派生，逐个可删
    ├── task-columns.tsx                          # 列 registry（sortable/label/mobile）
    ├── task-table.tsx                            # AdminDataTable 组合 + 三态
    ├── task-row-actions.tsx                      # 高频外露 + ⋯（带原因）
    ├── task-bulk-bar.tsx                         # 批量重试 / 删除 / 导出（终态门控）
    ├── task-detail-sheet.tsx                     # 右侧 Sheet（移动退化 Drawer）
    ├── task-detail/
    │   ├── task-detail-header.tsx
    │   ├── task-detail-meta.tsx                  # 时间线 / SLA / 错误原因
    │   ├── task-log-console.tsx                  # 增量轮询 + 级别过滤
    │   └── task-json-block.tsx
    └── dead-letter-sheet.tsx                     # hasMore 分页 + 批量重放
```

### 4.2 依赖方向（单向，禁止回指）

```
tasks.tsx ─► lib/admin/tasks/params.ts ─► lib/admin/tasks/query.ts ─► server/admin/tasks.ts
                   │                            │
                   ▼                            ▼
          task-filter-bar / chips      task-list-page ─► task-table ─► task-columns
                                                  │              └─► task-row-actions
                                                  ├─► task-detail-sheet ─► task-detail/*
                                                  └─► task-bulk-bar / dead-letter-sheet

共享套件（只加可选 prop）：components/admin/data-table/*、admin-table.tsx、confirm-dialog.tsx
```

### 4.3 共享套件的最小扩展（只加可选，7 个现有页面零回归）

| 文件 | 新增 | 用途 | 为什么不能绕过 |
|---|---|---|---|
| `data-table.tsx` | `visibleColumnIds?: ReadonlySet<string>` | 列配置真正生效（B1） | 绕过要每页复制过滤（`users-page.tsx:390` 即如此） |
| `data-table.tsx` | `error?: unknown`、`onRetry?`、`errorTitle?` | 错误态归位（B2） | 页面各写会把「错误」当「空」 |
| `data-table.tsx` | 内部 `page` clamp 或 `onPageChange` 钩子 | 修 B4 + 翻页清选择 | 组件不感知分页归属 |
| `toolbar.tsx` | `AdminFilter.onClear?`、`group?: 'primary'|'advanced'` | chips 逐个可删 / 分层 | 现无 × 区域也无折叠槽 |
| `toolbar.tsx` | `searchActive?`、`advanced?: ReactNode`、`advancedCount?` | 搜索计入「已筛选」；高级折叠 | `filtered` 只看 `filters`（`toolbar.tsx:283-284`） |
| `row-actions.tsx` | `primaryActions?`；`AdminRowAction.disabledReason?` | 高频外露 + 禁用原因 | 现在只能页面手拼 `<><Button/><RowActionsMenu/></>` |
| `types.ts` | `AdminColumn.label?` | 列菜单不用二次声明 | 现需在 `useAdminTableState({columns})` 再写一遍 |
| `pagination.tsx` | 内部 `page = min(page, pageCount)` | 修 B4 | 否则 7 处调用方都要记着 clamp |

> 若不想动共享套件，可以自建 `TaskDataTable` —— **不推荐**：那会变成第 8 个「各写一遍」的页面，正是本页 1492 行的成因。

---

## 5. 状态设计

### 5.1 四层状态（每层只有一个 owner）

| 层 | 存什么 | 生命周期 | 持久化 | 变更方式 |
|---|---|---|---|---|
| **URL（真源）** | status[]、queue[]、type[]、q、range、overdue、retryable、sortBy、order、page、pageSize、job | 跨刷新/分享/后退 | 浏览器历史 | `navigate({search})` 唯一入口 |
| **Query 缓存（服务端真值）** | 列表页、counts、队列统计、详情、日志 | 30s stale / 60s gc | 内存 | `useQuery` + `useAdminMutation` 乐观更新 |
| **局部 UI 态** | 高级筛选展开、抽屉内 tab、日志级别过滤、自动滚动、确认弹窗 | 组件生命周期 | 无 | `useState`（**仅此 5 项**） |
| **localStorage（偏好）** | 列显隐、密度、刷新间隔偏好、泳道折叠 | 跨会话 | 是 | `useLocalStorageState`，命名 `galzy:admin:tasks:*` |

**新增状态时先问**：能分享/后退复现 → URL；来自服务端 → Query；只与交互有关 → 局部；是用户习惯 → localStorage。
`selectedIds` **不进 URL**（批量选择是瞬时意图），但必须**随筛选/翻页清空**；`confirmDelete` 也不进 URL。

### 5.2 URL schema（`lib/admin/tasks/params.ts`）

```ts
import * as z from 'zod/mini'

/** 状态白名单：与 API 的 TASK_STATUSES、UI 分段控件同源。 */
export const TASK_STATUSES = [
  'queued', 'running', 'completed', 'failed', 'dead-letter', 'interrupted',
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

/** 排序白名单：与 API 的 sort 白名单逐字一致（否则 400 INVALID_SORT）。 */
export const TASK_SORT_FIELDS = ['createdAt', 'startedAt', 'finishedAt', 'status', 'type'] as const
export const TASK_RANGES = ['today', '7d', '30d', 'all'] as const
export type TaskRange = (typeof TASK_RANGES)[number]

/**
 * URL 形态约定（写进注释，禁止后人换成逗号分隔）：
 *   多值 = 单键 JSON：?status=["failed","dead-letter"]（重复键可读，但只写 JSON 形式）
 *   默认值 = 由 stripSearchParams 剥掉：默认视图永远是 /admin/tasks 裸路径
 */
export const taskSearchSchema = z.object({
  // z._default 管「键缺失」，z.catch 管「键存在但非法」——必须成对，
  // 否则 ?page=abc 会被抛成路由错误、整页 500（routes/user/index.tsx:50 是反例）。
  status: z._default(z.catch(z.array(z.enum(TASK_STATUSES)), []), []),
  queue: z._default(z.catch(z.array(z.string()), []), []),
  type: z._default(z.catch(z.array(z.string()), []), []),
  q: z._default(z.optional(z.string()), ''),
  range: z._default(z.catch(z.enum(TASK_RANGES), 'all'), 'all'),
  overdue: z._default(z.catch(z.boolean(), false), false),
  retryable: z._default(z.catch(z.boolean(), false), false),
  sortBy: z._default(z.catch(z.enum(TASK_SORT_FIELDS), 'createdAt'), 'createdAt'),
  order: z._default(z.catch(z.enum(['asc', 'desc']), 'desc'), 'desc'),
  page: z._default(z.catch(z.int().check(z.minimum(1)), 1), 1),
  pageSize: z._default(z.catch(z.enum(['10', '20', '50', '100']), '20'), '20'),
  /** 详情抽屉：?job=<id> 让详情可深链、可后退 */
  job: z.optional(z.string()),
})

export type TaskSearch = z.infer<typeof taskSearchSchema>

/** 必须与 schema 默认值逐键 deepEqual，否则 stripSearchParams 不生效。 */
export const TASK_SEARCH_DEFAULTS = {
  status: [], queue: [], type: [], q: '', range: 'all',
  overdue: false, retryable: false,
  sortBy: 'createdAt', order: 'desc', page: 1, pageSize: '20',
} as const

/** URL → API 参数的唯一映射（loader 与组件都只走这里）。 */
export function toTaskListFilters(s: TaskSearch): TaskListFilters {
  return {
    // 数组排序归一化：否则 ?status=a&status=b 与 ?status=b&status=a 是两个 query key，缓存全击穿
    status: [...s.status].sort(),
    queue: [...s.queue].sort(),
    type: [...s.type].sort(),
    q: s.q.trim(),
    // 相对区间换算成绝对时间，避免「同一个 key 不同结果」
    ...rangeToDates(s.range),
    overdue: s.overdue,
    retryable: s.retryable,
    sortBy: s.sortBy,
    order: s.order,
    pageIndex: s.page - 1,
    pageSize: Number(s.pageSize),
  }
}

function rangeToDates(range: TaskRange): { dateFrom?: string; dateTo?: string } {
  if (range === 'all') return {}
  const now = new Date()
  const start = new Date(now)
  if (range === 'today') start.setHours(0, 0, 0, 0)
  if (range === '7d') start.setDate(start.getDate() - 7)
  if (range === '30d') start.setDate(start.getDate() - 30)
  return { dateFrom: start.toISOString(), dateTo: now.toISOString() }
}

export type TaskListFilters = {
  status: TaskStatus[]
  queue: string[]
  type: string[]
  q: string
  dateFrom?: string
  dateTo?: string
  overdue: boolean
  retryable: boolean
  sortBy: (typeof TASK_SORT_FIELDS)[number]
  order: 'asc' | 'desc'
  pageIndex: number
  pageSize: number
}
```

> `pageSize` 在 URL 里存字符串（`z.enum(['10','20',...])`，因为 `z.enum` 只接受字符串字面量），在 `toTaskListFilters` 里再 `Number()`。**不要**在 schema 里用 `z.int()` 再转型：URL 天然是字符串，双重转型会引入 `NaN`。

### 5.3 路由：预取键单一来源（消除 R1「首屏空列表回退」）

```ts
// routes/admin/_authL/tasks.tsx
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { TASK_SEARCH_DEFAULTS, taskSearchSchema, toTaskListFilters } from '@web/lib/admin/tasks/params'
import { tasksQueryOptions } from '@web/lib/admin/tasks/query'
import TaskListPage from '@web/components/admin/tasks/task-list-page'

export const Route = createFileRoute('/admin/_authL/tasks')({
  validateSearch: taskSearchSchema,
  // 导航时把等于默认值的键从 URL 删掉：默认视图永远是 /admin/tasks
  search: { middlewares: [stripSearchParams(TASK_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search }) => toTaskListFilters(search),
  loader: async ({ deps, context }) => {
    // 只预取列表；分面 counts 随同一响应返回（§6.3），不再单独请求 stats
    await context.queryClient.ensureQueryData(tasksQueryOptions(deps))
    return null
  },
  errorComponent: TaskListRouteError,
  component: TaskListPage,
})
```

```ts
// lib/admin/tasks/query.ts —— 唯一 queryOptions，loader 与组件共用
import { adminKeys } from '@web/lib/admin/query-keys'
import { listTasks } from '@web/server/admin/tasks'
import type { TaskListFilters } from './params'

export const tasksQueryOptions = (f: TaskListFilters) => ({
  queryKey: adminKeys.tasks(f),           // 过滤器整体进 key（内容哈希稳定）
  queryFn: () => listTasks({ data: {
    pageIndex: f.pageIndex, pageSize: f.pageSize,
    statuses: f.status, queues: f.queue, types: f.type,
    q: f.q || undefined,
    dateFrom: f.dateFrom, dateTo: f.dateTo,
    overdue: f.overdue, retryable: f.retryable,
    sort: f.sortBy, order: f.order,
  } }),
  staleTime: 30_000,                      // 与全局 staleTime 对齐，预取后点击即命中
})
```

**为什么必须这样**：现状 loader 用 `DEFAULT_FILTERS` 字面量（`tasks.tsx:6`），组件用另一份 `filters` 字面量（`:856`），键相等纯属巧合；URL 化后 `status` 从 `""` 变 `[]`、`pageSize` 可能缺失，首屏必然「空列表闪一下再跳数据」。

### 5.4 交互规则（可测试的行为契约）

| 动作 | 参数变化 | 其他副作用 | 理由 |
|---|---|---|---|
| 改任一筛选 / 搜索提交 | 相应键 + `page=1` | 清空选择 | 停在第 5 页看新筛选 = 空页 |
| 翻页 | 仅 `page` | 清空选择 | 防「已选 5 条」跨页误删（现状无清理，`:1402`） |
| 改 `pageSize` | `pageSize` + `page=1` | 清空选择 | 同上 |
| 点行 / 点「日志」 | `job=<id>` | 不清筛选 | 详情与列表正交 |
| 关闭详情 | `job=undefined` | `replace: true` | 关闭不该产生一条后退目标 |
| 删除成功 | — | 若含当前 `job` → 关闭详情；清选择；失效 `tasksRoot()` | 现状只 `setSelectedId(null)`（`:932-935`） |
| 批量操作后 | — | 清选择；保留筛选；refetch 一次 | 用户想接着处理同类 |
| 分面数字点击 | `status=[x]`（已选则切回空） | 与分段控件同一逻辑 | 消灭双入口 |
| 越界页钳制 | `page=pageCount` | `replace: true` | 修 B4 |

### 5.5 轮询策略（现状 2s × 3 查询全量重取）

| 场景 | 现状 | 目标 |
|---|---|---|
| 列表/分面 | 2s/5s/15s 固定，不感知可见性（`:854-883`） | `refetchInterval = hasActive ? interval : 30_000`，且 `refetchIntervalInBackground: false` |
| 何时算 active | — | 当前页存在 running/queued 行（从数据派生） |
| 详情 | 2s（`:513-521`） | 仅非终态 2s，终态 `false` |
| 日志 | 2s 重取 200 条（`:355-361`） | `afterId` 增量（API V2），只追加新行 |
| 窗口不可见 | 继续轮询 | `document.visibilityState === 'hidden'` → 暂停 |
| 手动刷新 | 失效 3 个 key（`:1217-1227`） | 失效 `tasksRoot()`（含 counts）+ 按钮 `isFetching` 转圈 |

### 5.6 六态状态机（表格区域）

```
[idle] --首次加载--> [loading: 骨架 = pageSize 行]
[loading] --成功--> [ready]
[loading] --失败--> [error: 错误卡 + 重试 + 摘要]
[ready] --后台刷新--> [refreshing: 保留行 + 压暗 + 顶部细进度]
[refreshing] --失败--> [ready(旧数据) + sticky 错误条]      ← 关键：不清空
[ready] --0 行--> [empty: 四分支]
[error] --重试--> [loading]
```

**空态分支（严格区分，文案与主操作都不同）**

| 分支 | 判定 | 文案 | 主操作 |
|---|---|---|---|
| 真·无数据 | `total===0 && !isFiltered` | 「还没有任务记录」 | 手动触发（主）/ 查看调度配置 |
| 筛选无结果 | `total===0 && isFiltered` | 「没有符合当前条件的任务」+ 条件摘要 | 清除全部筛选（主）/ 放宽时间范围 |
| 搜索无结果 | `total===0 && q` | 「没有匹配 “xxx” 的任务」 | 清空搜索 |
| 无权限 | 403 | 「你没有查看任务队列的权限」 | 返回后台首页（**不给重试**） |
| 队列不可用 | 503 | 「队列服务未启用（Redis）」 | 重试（**不显示「没有任务」**） |

### 5.7 乐观更新与批量语义

- 单条：沿用 `useAdminMutation`（`use-admin-mutation.ts:71-130`）：cancel → snapshot → patch → 失败回滚 → 成功失效。
- 批量：**不做逐条乐观删除**，改为「pending 态 + 一次失效」——批量是部分失败，逐条回滚会闪。
- 批量返回 `{ requested, succeeded, failed: [{id, code, message}] }`，一条 toast：成功 N / 失败 M +「查看失败项」展开。
- 重试可重入：pending 期间禁用按钮（`usePendingMutationVars`），避免现状「连点 3 次 = 3 个全量同步」。

---

## 6. API 契约 V2

### 6.1 现状 vs 目标

| 能力 | V1 现状（证据） | V2 目标 |
|---|---|---|
| 过滤 | `queue/type/status` 单值 `eq`（`service.ts:352-354`） | 多值 `IN` + `q` + 时间区间 + `overdue/retryable` |
| 排序 | 固定 `created_at DESC`（`:364`） | 白名单 5 字段 + `order` + `id` 稳定二级键 |
| 计数 | 独立 `GET /stats` 全表 `GROUP BY`，与筛选脱钩（`:374-397`） | 列表响应内联 `counts`（同 where 分面） |
| 分页 | `{items,total}`，不回显 page（`:370`） | 增加 `page/pageSize/totalPages` |
| 投影 | `select()` 全列含 jsonb（`:361`） | 列表只回 8 个标量 + 截断后的 error |
| 批量 | 只有 `batchDelete`，无事务无上限（`:287-312`） | `batchDelete/batchRetry` + 上限 + 逐项结果 |
| 删除门控 | 不校验终态（`:262-284`） | 非终态 409 `TASK_NOT_TERMINAL`，`force` 才允许 |
| 重试幂等 | 每次新 jobId（`:340`） | 同 queue+type 有活跃任务 → 409 `TASK_ALREADY_ACTIVE` |
| 错误体 | 纯字符串（`index.ts:38-41`） | `{code,message}`（`elysiaErrorF` 已兼容） |
| 类型字典 | 前端硬编码（`tasks-page.tsx:112-123`） | 新增 `GET /tasks/meta` 下发 |

### 6.2 `GET /tasks` 参数（纯增量，V1 语义不变）

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `q` | string 1..100 | — | 匹配 `id` / `type` / `left(error,500)`；转义 LIKE 通配符 |
| `status` / `statuses` | string 或 string[] | — | 单值兼容 + 多值；非法值 400 `INVALID_FILTER` |
| `queue` / `queues` | string 或 string[] | — | 队列名以 `QUEUE` 常量为白名单 |
| `type` / `types` | string 或 string[] | — | 同上 |
| `dateFrom` / `dateTo` | ISO string | — | `created_at` 半开区间 `[from, to)` |
| `overdue` | boolean | false | 派生过滤（规则见下） |
| `retryable` | boolean | false | `status ∈ failed/dead-letter/interrupted` |
| `sort` | enum | `createdAt` | `createdAt/startedAt/finishedAt/status/type` |
| `order` | asc 或 desc | `desc` | 配合 `NULLS LAST`（否则开始时间为 NULL 的排队任务会顶到最前） |
| `page` / `pageIndex` | number | — / 0 | 1 基优先；并存时以 `page` 为准 |
| `pageSize` | 1..100 | 20 | 维持上限 |
| `withCounts` | boolean | true | false 时省略 `counts`（轮询省一次聚合） |

**多值为什么用 `string 或 string[]`**：Elysia 的 query 解析器只在重复 key 时产出数组，逗号不拆（`elysia/dist/parse-query.js:124-161`）；用 Union 承接、在 service 归一化是唯一稳的写法。

**`priority` 派生（H2/H3，不改表）**

| 队列 / 类型 | 优先级 | 依据 |
|---|---|---|
| `vndb-full` / `kungal-full` | P0 | 全量刷新，阻塞后续增量 |
| `vndb-delta` / `kungal-delta` / `cloudreve-sync` | P1 | 常规数据新鲜度 |
| `meili-*` | P2 | 可重放、影响面可控 |
| `queue-log-prune` | P3 | 纯维护 |

**`overdue` 派生（H5，服务端实现）**

```sql
-- 非终态 且（有 due_at → now > due_at；否则 started_at + SLA；排队中 → created_at + 10min）
status NOT IN ('completed','failed','dead-letter','interrupted')
AND COALESCE(
      due_at,
      CASE WHEN started_at IS NOT NULL THEN started_at + sla_interval(type) END,
      created_at + interval '10 minutes'
    ) < now()
```

Phase 1 若不想改 SQL：`overdue` 只做**当前页显示高亮**（前端 `sla.ts` 计算），筛选按钮置灰并标注「需后端支持」。**不允许**把「只筛当前页」的假筛选做成 UI —— 现状 `search` 的教训就是这么来的。

### 6.3 响应 envelope

```ts
type TaskListResponseV2 = {
  items: Array<{
    id: string; queue: string; type: string
    status: TaskStatus
    progress: number
    error: string | null          // left(error, 500)，全文走详情
    startedAt: string | null; finishedAt: string | null; createdAt: string
  }>
  total: number
  page: number; pageIndex: number; pageSize: number; totalPages: number
  counts?: Record<TaskStatus, number>   // 六个 key 恒存在（预置 0）
  applied: {                            // 归一化后的生效条件，前端可回显校验
    q: string | null; queues: string[]; types: string[]
    statuses: TaskStatus[]; dateFrom: string | null; dateTo: string | null
    overdue: boolean; retryable: boolean; sort: string; order: 'asc' | 'desc'
  }
}
```

**counts 口径（必须写死，否则又会出现两个真相源）**
- `counts` = `GROUP BY status`，where = `q + queues + types + 时间区间 + overdue + retryable`，**不含 status**。
- `total` = 同一 where **加上** status。
- 因此点任意状态后 `total === counts[status]` 恒成立；「全部」= `sum(counts)`；概览条的失败/死信/逾期也能直接复用。

### 6.4 写接口

| 方法 | 路径 | Body | 语义 |
|---|---|---|---|
| POST | `/tasks/batchRetry` | `{ ids ≤100 }` | 逐项重试，**部分失败不整体回滚**，返回 `results[]` |
| POST | `/tasks/batchDelete` | `{ ids ≤500, dryRun? }` | 事务内删日志+记录；非终态计入 `failed`（409） |
| POST | `/tasks/:jobId/retry` | — | 同 queue+type 有活跃任务 → 409（带冲突 jobId） |
| POST | `/tasks/:jobId/delete` | `{ force?: boolean }` | 非终态 409；`force` 才允许并先 `removeJob` |
| POST | `/tasks/deadLetter/:queue/batchRepublish` 或 `batchRemove` | `{ jobIds ≤100 }` | 幂等：已不存在计入 `missing` 而非 404 |
| GET | `/tasks/meta` | — | `{ queues:[{key,label,tasks:[{type,label,priority}]}], statuses, retentionDays }`，消灭前端硬编码字典 |

**批量语义约定**：逐项独立结果，HTTP 永远 200（除非整体校验失败 400）；返回 `{ ok, requested, succeeded, failed: [{id, code, message}] }`。

### 6.5 错误码表（前端据此出文案，不依赖 HTTP status）

| HTTP | code | 前端表现 |
|---|---|---|
| 400 | `VALIDATION_ERROR` / `INVALID_FILTER` / `INVALID_SORT` | 「筛选条件不合法」+ 自动重置该条件 |
| 401 | `UNAUTHENTICATED` | 跳登录（`elysiaErrorF` 已处理） |
| 403 | `FORBIDDEN` | 「权限不足」+ 返回首页，**不重试** |
| 404 | `TASK_NOT_FOUND` | 详情内「任务已被清理」+ 关闭 |
| 409 | `TASK_NOT_TERMINAL` / `TASK_ALREADY_ACTIVE` | 行内说明原因 +「查看冲突任务」 |
| 503 | `QUEUE_UNAVAILABLE` | 「队列服务未启用（Redis）」+ 重试 |

> 现状 `ApiError` 跨进程只剩 message（`elysia-error.ts:16-22`），所以 **code 必须编码进 message 前缀**（`FORBIDDEN|权限不足`），BFF 解析后再抛结构化错误。这是本仓库约束下唯一可靠的通道。

### 6.6 索引（排序/搜索放开后必须有）

| 场景 | 现有 | 需要补 |
|---|---|---|
| 默认 `created_at DESC` | `idx_queue_job_created_at` 已有 | 加 `id` 作稳定二级键（防分页漂移） |
| 单维筛选 + 排序 | 3 条单列（低基数，planner 常弃用） | 组合 `(queue, created_at DESC)`、`(status, created_at DESC)`、`(type, created_at DESC)` |
| 队列 + 状态 | 无 | `(queue, status, created_at DESC)` |
| `startedAt/finishedAt` 排序 | 无 | 2 条 `DESC NULLS LAST` |
| `q` 子串搜索 | 无 | `pg_trgm` GIN（`id`，可选 `error`）；仓库已有先例 `0009_producers_trigram.sql` |
| 日志增量 `afterId` | `(job_id, created_at)` 已有 | 无需（PK 已够） |

落地方式照 `0023_perf_indexes_and_dedup.sql`：`DROP INDEX IF EXISTS` 旧 3 条单列 + `CREATE INDEX IF NOT EXISTS` 新组合，保持幂等。

### 6.7 兼容与拆分

V1 参数/字段全部保留语义；唯一破坏性变更是**死信列表裸数组 → envelope**（消费者只有本页），与前端同 PR。不引入 `/v2` 前缀（内部接口、单一消费者）。

---

## 7. 关键代码

> 以下为可落地的切片（不是全量文件），重点在**边界与契约**；样式沿用项目既有 token（`bg-card / ring-border/60 / rounded-2xl`）。

### 7.1 页面编排（`task-list-page.tsx` 骨架）

```tsx
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Route } from '@web/routes/admin/_authL/tasks'
import { toTaskListFilters, type TaskSearch } from '@web/lib/admin/tasks/params'
import { tasksQueryOptions } from '@web/lib/admin/tasks/query'

export default function TaskListPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const filters = toTaskListFilters(search)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const listQuery = useQuery({
    ...tasksQueryOptions(filters),
    placeholderData: keepPreviousData,          // 换筛选保留上一帧，表格压暗而不是闪骨架
    refetchIntervalInBackground: false,
    // 自适应轮询：只有存在运行中/排队任务时才快轮询
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      return items.some((i) => i.status === 'running' || i.status === 'queued') ? 2000 : 30_000
    },
  })

  const data = listQuery.data
  const pageCount = Math.max(1, data?.totalPages ?? 1)

  // 越界页钳制：唯一负责方（分页组件也兜一层防御）
  useEffect(() => {
    if (data && search.page > pageCount) {
      void navigate({ search: (p) => ({ ...p, page: pageCount }), replace: true })
    }
  }, [data, pageCount, search.page, navigate])

  // 改筛选的唯一入口：一律回第 1 页 + 清选择
  const patchSearch = (patch: Partial<TaskSearch>) => {
    setSelectedIds(new Set())
    void navigate({ search: (p) => ({ ...p, ...patch, page: 1 }), replace: true, resetScroll: false })
  }

  return (
    <div className="flex flex-col gap-4">
      <TaskPageHeader
        query={search.q}
        onQueryChange={(q) => patchSearch({ q: q || undefined })}
        onEnqueue={(preset) => enqueue.mutate(preset)}
      />
      <TaskOverviewBar
        counts={data?.counts}
        total={data?.total ?? 0}
        status={search.status}
        onToggle={(status) => patchSearch({ status })}
      />
      <TaskTable
        rows={data?.items ?? []}
        total={data?.total ?? 0}
        q={search.q}
        filters={filters}
        isFiltered={isFiltered(search)}
        isLoading={listQuery.isLoading}
        isFetching={listQuery.isFetching}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        sort={{ id: search.sortBy, desc: search.order === 'desc' }}
        onSortChange={(next) =>
          patchSearch({ sortBy: next?.id ?? 'createdAt', order: next && !next.desc ? 'asc' : 'desc' })
        }
        onRowClick={(row) =>
          void navigate({ search: (p) => ({ ...p, job: row.id }), resetScroll: false })
        }
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
      />
      <TaskDetailSheet
        jobId={search.job}
        onClose={() => void navigate({ search: (p) => ({ ...p, job: undefined }), replace: true })}
      />
    </div>
  )
}
```

### 7.2 表格组合与三态（`task-table.tsx`）

```tsx
export function TaskTable(props: TaskTableProps) {
  const { rows, total, q, error, onRetry, isLoading, isFiltered } = props

  // 错误态优先于空态：否则「接口挂了」会渲染成「没有任务」（现状 B2）
  if (error && rows.length === 0) {
    return (
      <TableErrorState
        title="任务列表加载失败"
        description={toErrorMessage(error)}
        onRetry={onRetry}
      />
    )
  }

  return (
    <AdminDataTable<TaskRow>
      columns={visibleColumns}                 // 列 registry + 列配置过滤（§7.3）
      rows={rows}
      getRowId={(r) => r.id}
      isLoading={isLoading}
      isFetching={props.isFetching}
      skeletonRows={props.pageSize}
      density={props.density}
      sort={props.sort}
      onSortChange={props.onSortChange}
      selectedIds={props.selectedIds}
      onSelectedIdsChange={props.onSelectedIdsChange}
      onRowClick={props.onRowClick}
      rowActions={(row) => <TaskRowActions row={row} />}
      getRowClassName={(row) => slaRowClass(row)}      // 逾期/滞留 → 左缘色条
      empty={resolveEmptyState({ total, q, isFiltered })}
      toolbar={<TaskFilterBar {...props} />}
      footer={<TaskPagination {...props} />}
      bulkBar={<TaskBulkBar {...props} />}
    />
  )
}
```

```tsx
/** 空态三分支：文案与主操作必须不同，不能用一句「暂无数据」了事。 */
function resolveEmptyState({ total, q, isFiltered }: EmptyCtx) {
  if (q) {
    return {
      icon: SearchXIcon,
      title: `没有匹配「${q}」的任务`,
      description: '搜索覆盖任务 ID、类型与错误文本；试试更短的关键词',
      action: <Button variant="outline" size="sm" onClick={clearAll}>清空搜索</Button>,
    }
  }
  if (isFiltered) {
    return {
      icon: FilterXIcon,
      title: '没有符合当前条件的任务',
      description: <ActiveFilterSummary />,          // 列出当前 chips 的可读文案
      action: <Button size="sm" onClick={clearAll}>清除全部筛选</Button>,
    }
  }
  return {
    icon: ListTodoIcon,
    title: '还没有任务记录',
    description: '手动触发一个同步任务，或等待定时调度执行',
    action: <TaskEnqueueMenu />,                   // 复用页头那个主操作
  }
}
```

### 7.3 列 registry（`task-columns.tsx` 片段）

```tsx
export const taskColumnDefs: TaskColumnDef[] = [
  {
    id: 'task', label: '任务', header: '任务', mobile: 'title',
    cell: (row) => (
      <div className="flex flex-col gap-0.5 min-w-0 max-w-72">
        <span className="text-sm font-medium truncate">{typeLabel(row.type)}</span>
        <span className="font-mono text-[11px] text-muted-foreground truncate">
          {shortId(row.id)} · {sourceLabel(row)}
        </span>
        {row.status === 'failed' && row.error && (
          <span className="text-[11px] truncate text-destructive">{row.error}</span>
        )}
      </div>
    ),
  },
  {
    id: 'status', label: '状态', header: '状态', sortable: true, mobile: 'meta',
    cell: (row) => (
      <div className="flex flex-col gap-0.5">
        <JobStatusPill status={row.status} />
        {slaState(row) === 'overdue' && (
          <span className="text-[10px] font-medium text-destructive">逾期 {overdueFor(row)}</span>
        )}
      </div>
    ),
  },
  { id: 'queue', label: '队列', header: '队列', sortable: true, hideBelow: 'md', mobile: 'meta',
    cell: (row) => <Badge variant="secondary" className="font-normal">{queueLabel(row.queue)}</Badge> },
  { id: 'progress', label: '进度', header: '进度', mobile: 'body',
    cell: (row) => isTerminal(row.status)
      ? <span className="text-xs text-muted-foreground">—</span>
      : (
        <div className="flex gap-2 items-center w-32">
          <Progress value={row.progress} className="flex-1 h-1.5" />
          <span className="w-8 text-[11px] tabular-nums text-right text-muted-foreground">
            {row.progress}%
          </span>
        </div>
      ) },
  { id: 'duration', label: '耗时', header: '耗时', sortable: true, hideBelow: 'lg', mobile: 'meta',
    cell: (row) => (
      <span className="text-xs tabular-nums">
        {formatDuration(row.startedAt, row.finishedAt, row.status)}
      </span>
    ) },
  { id: 'createdAt', label: '创建时间', header: '创建时间', sortable: true, mobile: 'meta',
    cell: (row) => <RelativeTime value={row.createdAt} /> },
  // 默认隐藏，列配置里可开
  { id: 'priority', label: '优先级', header: '优先级', sortable: true, defaultHidden: true, mobile: 'hidden',
    cell: (row) => <PriorityBadge level={priorityOf(row)} /> },
  { id: 'source', label: '触发来源', header: '来源', defaultHidden: true, mobile: 'hidden',
    cell: (row) => <span className="text-xs text-muted-foreground">{sourceLabel(row)}</span> },
  { id: 'sla', label: '截止 / SLA', header: '截止', sortable: true, defaultHidden: true, mobile: 'hidden',
    cell: (row) => <SlaCell row={row} /> },
]
```

> 列显隐语义：`defaultHidden` 只是**初值**，用户勾选写进 `hiddenColumns`。落地时用
> `cols.filter((c) => hidden.has(c.id) ? false : !c.defaultHidden || overrides.has(c.id))`
> —— **不要**把 `defaultHidden` 当「永久隐藏」（现状 `data-table.tsx:189` 就是这么误用的，修法是给它加 `visibleColumnIds` 覆盖）。

### 7.4 行内高频 + 更多（`task-row-actions.tsx`）

```tsx
/**
 * 高频外露（查看日志 + 条件性重试），其余进 ⋯。
 * 现状把 6 项全塞 ⋯（tasks-page.tsx:1116-1177），最常用的「查看日志」要点两层。
 */
export function TaskRowActions({ row }: { row: TaskRow }) {
  const retry = useRetryTaskMutation()
  const openDetail = useOpenTaskDetail()
  const canRetry = ['failed', 'dead-letter', 'interrupted'].includes(row.status)
  const canDelete = isTerminal(row.status)

  return (
    <div className="flex gap-1 items-center">
      <Tooltip>
        <TooltipTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="查看日志" />}
          onClick={() => openDetail(row.id)}
        >
          <ScrollTextIcon className="size-4" />
        </TooltipTrigger>
        <TooltipContent>查看日志</TooltipContent>
      </Tooltip>

      {canRetry && (
        <Button
          variant="ghost" size="icon-sm" aria-label="重试"
          disabled={retry.isPending}
          onClick={() => retry.mutate({ id: row.id })}
        >
          {retry.isPending ? <Spinner className="size-4" /> : <RotateCcwIcon className="size-4" />}
        </Button>
      )}

      <RowActionsMenu
        actions={[
          { label: '复制任务 ID', icon: CopyIcon, onSelect: () => copyText(row.id) },
          { label: '查看载荷', icon: BracesIcon, onSelect: () => openDetail(row.id, 'payload') },
          { label: '重放回队列', icon: RefreshCwIcon, hidden: row.status !== 'dead-letter', onSelect: republish },
          { label: '丢弃死信', icon: XCircleIcon, variant: 'destructive', hidden: row.status !== 'dead-letter', onSelect: discard },
          {
            label: '删除记录', icon: Trash2Icon, variant: 'destructive', separator: true,
            disabledReason: canDelete ? undefined : '运行中/排队中的任务不可删除，请等待结束',
            onSelect: () => confirmDelete(row),
          },
        ]}
      />
    </div>
  )
}
```

### 7.5 筛选条 + 可删 chips（`task-filter-bar.tsx`）

```tsx
<div className="flex flex-col gap-2 p-3 border-b border-border/60 sm:flex-row sm:flex-wrap sm:items-center">
  {/* 常用筛选：外露，且全站只此一处 */}
  <SegmentedStatus value={search.status} counts={counts} onChange={patchStatus} />
  <MultiSelectFilter label="队列" options={queueOptions} value={search.queue}
    onChange={(v) => patchSearch({ queue: v })} />
  <RangeFilter value={search.range} onChange={(v) => patchSearch({ range: v })} />

  {/* 高级筛选：折叠 + 角标显示生效数量 */}
  <Popover>
    <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 rounded-xl border-dashed" />}>
      <SlidersHorizontalIcon className="size-3.5 opacity-60" />高级筛选
      {advancedCount > 0 && <Badge variant="secondary">{advancedCount}</Badge>}
    </PopoverTrigger>
    <PopoverContent className="w-80 space-y-3">
      <MultiSelectFilter label="任务类型" options={typeOptions} value={search.type}
        onChange={(v) => patchSearch({ type: v })} />
      <label className="flex gap-2 items-center text-sm">
        <Checkbox checked={search.overdue} onCheckedChange={(v) => patchSearch({ overdue: v })} />
        仅看逾期
      </label>
      <label className="flex gap-2 items-center text-sm">
        <Checkbox checked={search.retryable} onCheckedChange={(v) => patchSearch({ retryable: v })} />
        仅看可重试
      </label>
    </PopoverContent>
  </Popover>

  {/* 视图控制：与筛选分离，不参与「已筛选」判断 */}
  <div className="flex gap-1.5 items-center sm:ml-auto">
    {isFiltered && <Button variant="ghost" size="sm" onClick={clearAll}>重置</Button>}
    <ColumnVisibilityMenu columns={columnMenu} onToggle={toggleColumn} />
    <DensityMenu density={density} onDensityChange={setDensity} />
    <RefreshIntervalMenu value={refresh} onChange={setRefresh} />
  </div>

  {/* chips：每个条件独立可删 */}
  <TaskFilterChips search={search} onRemove={removeChip} onClearAll={clearAll} />
</div>
```

```tsx
/** chips 由参数派生，不存副本——避免「chips 与筛选不一致」的二次真源。 */
function TaskFilterChips({ search, onRemove, onClearAll }: ChipsProps) {
  const chips = useMemo(() => [
    ...(search.q ? [{ key: 'q', label: `搜索：${search.q}`, onRemove: () => onRemove({ q: undefined }) }] : []),
    ...search.status.map((s) => ({
      key: `status:${s}`, label: `状态：${statusLabel(s)}`,
      onRemove: () => onRemove({ status: search.status.filter((x) => x !== s) }),
    })),
    ...search.queue.map((q) => ({
      key: `queue:${q}`, label: `队列：${queueLabel(q)}`,
      onRemove: () => onRemove({ queue: search.queue.filter((x) => x !== q) }),
    })),
    ...(search.range !== 'all'
      ? [{ key: 'range', label: rangeLabel(search.range), onRemove: () => onRemove({ range: undefined }) }]
      : []),
    ...(search.overdue
      ? [{ key: 'overdue', label: '仅看逾期', onRemove: () => onRemove({ overdue: undefined }) }]
      : []),
    ...(search.retryable
      ? [{ key: 'retryable', label: '仅看可重试', onRemove: () => onRemove({ retryable: undefined }) }]
      : []),
  ], [search, onRemove])

  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 items-center basis-full">
      <span className="text-xs text-muted-foreground">已选</span>
      {chips.map((chip) => (
        <span key={chip.key} className="inline-flex overflow-hidden items-center text-xs bg-accent/60 rounded-full">
          <span className="py-1 pl-2.5">{chip.label}</span>
          <button
            type="button"
            aria-label={`移除筛选：${chip.label}`}
            onClick={chip.onRemove}
            className="grid p-1 mr-1 place-items-center rounded-full hover:bg-muted"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearAll}>
        清除全部
      </Button>
    </div>
  )
}
```

### 7.6 详情右侧抽屉（`task-detail-sheet.tsx`）

```tsx
/**
 * 桌面右侧 Sheet / 移动底部 Drawer，共用同一个 ?job= 状态。
 * - 详情独立取数（不依赖「该行在当前页」），因此翻页/深链后仍能打开（修现状 :891 的依赖）
 * - 「用哪种容器」由视口决定，两种容器都不依赖 URL 之外的状态，避免 768–1023 空洞（B3）
 */
export function TaskDetailSheet({ jobId, onClose }: { jobId?: string; onClose: () => void }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const detail = useQuery({
    queryKey: adminKeys.taskDetail(jobId ?? ''),
    queryFn: () => getTaskDetail({ data: { jobId: jobId as string } }),
    enabled: !!jobId,
    refetchInterval: (q) => (isActiveStatus(q.state.data?.status) ? 2000 : false),
  })

  if (!jobId) return null

  const body = (
    <div className="flex flex-col flex-1 min-h-0">
      <TaskDetailHeader job={detail.data} onClose={onClose} />
      <div className="overflow-y-auto flex-1 px-4 pb-4">
        <TaskDetailMeta job={detail.data} />
        <TaskLogConsole jobId={jobId} running={isActiveStatus(detail.data?.status)} />
        <TaskJsonTabs job={detail.data} />
      </div>
    </div>
  )

  return isDesktop ? (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex flex-col gap-0 w-[480px] sm:max-w-[480px] p-0">
        {body}
      </SheetContent>
    </Sheet>
  ) : (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90dvh] p-0">{body}</DrawerContent>
    </Drawer>
  )
}
```

> 注意 `SheetContent` 默认没有内建滚动容器（`sheet.tsx:55-58` 是 `flex flex-col gap-4`），长内容必须自己套 `overflow-y-auto`；右抽屉默认宽度只有 `sm:max-w-sm`（384px），要显式覆盖。

### 7.7 API 侧：列表查询（`listJobsV2` 核心）

```ts
// 三查询并行：列表（投影，不含 jsonb）+ 精确 total + 分面 counts（不含 status）
const [items, totalRow, facetRows] = await Promise.all([
  db.select({
    id: queueJob.id, queue: queueJob.queue, type: queueJob.type,
    status: queueJob.status, progress: queueJob.progress,
    error: sql<string | null>`left(${queueJob.error}, 500)`,
    startedAt: queueJob.startedAt, finishedAt: queueJob.finishedAt, createdAt: queueJob.createdAt,
  }).from(queueJob).where(finalWhere).orderBy(...orderBy).limit(pageSize).offset(offset),

  db.select({ count: count() }).from(queueJob).where(finalWhere),

  withCounts === false
    ? Promise.resolve(null)
    : db.select({ status: queueJob.status, count: count() })
        .from(queueJob).where(baseWhere).groupBy(queueJob.status),
])

// 排序：白名单列 + id 兜底；NULLS LAST 防「未开始的任务」顶在最新前面
const orderBy = [
  sql`${SORT_COLUMNS[sortKey]} ${sql.raw(dir)} nulls last`,
  sql`${queueJob.id} ${sql.raw(dir)}`,
]
```

---

## 8. 实施计划（5 个 PR，可独立回滚）

| PR | 范围 | 依赖 | 风险 | 验收信号 |
|---|---|---|---|---|
| **A｜后端只读能力** | `listQueryV2` + `listJobsV2`（多值/q/时间/排序/分面/投影）+ 索引迁移 + `GET /tasks/meta` | 无 | 低（只加不改） | 新旧参数并存，旧前端行为不变 |
| **B｜写语义与错误体** | 事务化 delete/batchDelete、终态门控 409、retry 并发 409、`status(code,{code,message})`、enqueue dev 503 | A | 中（涉及删除） | 删运行中任务被拒；错误体含 code |
| **C｜批量接口** | `batchRetry`、死信批量、`ids` 上限、逐项结果 | B | 低 | 部分失败可解释 |
| **D｜死信/日志契约** | 死信 envelope + `hasMore`、`queueParam` 枚举、日志 `afterId` | A | 中（唯一破坏点） | 前端同 PR 切换 |
| **E｜前端重构** | 共享套件 8 个可选 prop + `lib/admin/tasks/*` + 组件树拆分 + URL 化 + 删除 1492 行文件 | A–D | 中（交互面大） | §9 checklist 全绿 |

**顺序理由**：A 只加不改；B/C 动写语义需独立回归；D 是破坏点必须与 E 同批；E 的最后一步才是「删掉 tasks-page.tsx」。
**工时估算**：A 1.5d、B 1d、C 0.5d、D 0.5d、E 3d（含测试与走查）。

**若只能做一个 PR**：做 **E 的 URL 化 + 三态 + 行内高频**（不依赖后端）。此时搜索降级为「本页高亮 + 提示需后端支持」，**不要**做成看起来像全局搜索的假筛选。

### 8.1 E 的内部顺序（避免大爆炸）

1. 共享套件加 8 个可选 prop（独立小 PR，跑 7 个后台页回归）。
2. `lib/admin/tasks/{params,query,sla}.ts` + 单测（纯函数，先绿）。
3. 路由 URL 化：页面 UI 暂不变，但参数已进 URL（先接 `status/queue/page/pageSize`）。
4. 组件树替换：header → overview → filter-bar → table → row-actions → detail-sheet。
5. 删除旧文件，清理 `deadLetterQueue/confirmDelete` 等局部态。

---

## 9. 验收 checklist

### 9.1 信息架构与筛选
- [ ] 页面上只有**一处**能改状态筛选（分段控件）；概览数字点击后与它同源，再点一次取消
- [ ] 队列筛选只有一处入口，泳道点击复用同一参数
- [ ] 常用筛选（状态/队列/时间）默认可见；类型/仅逾期/仅可重试收在「高级筛选」，角标显示生效数量
- [ ] 每个已选条件渲染为一枚 chip，**点 × 只移除该条件**，其余条件不变
- [ ] 「清除全部」回到默认视图后，URL 变为 `/admin/tasks` 裸路径
- [ ] 搜索是服务端查询：第 1 页能搜到第 5 页的记录；页脚 `total` 与结果条数一致

### 9.2 URL 与状态
- [ ] 任意筛选/排序/分页/详情后刷新，视图完全一致
- [ ] 复制 URL 给同事，看到同样视图（含 `?job=` 直接打开详情）
- [ ] 浏览器后退可逐步撤销筛选（筛选用 `replace`，翻页/详情用 `push`）
- [ ] 默认视图 URL 无冗余参数（不出现 `?page=1&status=[]&q=`）
- [ ] 手改 URL 为 `?page=abc&status=bogus` 不白屏（回落默认值，非整页 500）
- [ ] 删除最后一页最后一条后，页码自动回落，不出现空表格 + 页码 99
- [ ] 数组参数顺序不同（`?status=a&status=b` 与反向）命中同一缓存、同一请求

### 9.3 表格与信息层级
- [ ] 默认 7 列，状态/队列/进度/耗时/创建时间一眼可读
- [ ] 失败行有错误摘要（截断）；逾期行有左缘红条 + 「逾期 Nm」；排队过久为琥珀
- [ ] 终态任务进度显示「—」而非 0%
- [ ] 点表头可排序（升 → 降 → 取消），URL 同步 `sortBy/order`，刷新保持
- [ ] 列配置：勾掉「队列」后表格**真的少一列**（修 B1），刷新保持
- [ ] 行密度切换生效且刷新保持
- [ ] 按 `startedAt` 排序时，未开始任务排在最后（NULLS LAST）

### 9.4 行内与批量
- [ ] 「查看日志」一次点击可打开（不是两层菜单）
- [ ] 失败/死信/中断行直接出现「重试」图标；其他状态不出现
- [ ] ⋯ 内只有低频项，危险项有分隔线且二次确认
- [ ] 不可用操作给出**原因**（如「运行中不可删除」），不是静默灰掉
- [ ] 勾选后出现批量条：批量重试（仅选中项可重试时可用）+ 删除
- [ ] 批量结果报告「成功 N / 失败 M（原因）」，部分失败不静默
- [ ] 翻页或改筛选后选择清空、批量条消失（不发生跨页误删）
- [ ] 「全选」明确是「全选当前页」

### 9.5 详情抽屉
- [ ] 桌面为右侧抽屉（非中间弹窗、非固定侧栏），移动为底部抽屉
- [ ] 直接访问 `?job=xxx` 可打开详情（该行不在当前页也正常）
- [ ] 768 / 1023 / 1024 / 1280 四个宽度点击行都有详情（修 B3）
- [ ] 日志增量刷新（不整段重取），终态任务停止轮询
- [ ] 详情内「复制 ID / 查看载荷 / 重试」可用；关闭后列表状态不丢
- [ ] 任务被外部删除时显示「任务已被清理」而非空白

### 9.6 加载 / 空 / 错误 / 权限
- [ ] 首屏骨架列结构稳定，不跳动
- [ ] 后台刷新保留行并压暗，不闪骨架
- [ ] 无数据 / 筛选无结果 / 搜索无结果：**三种文案与主操作都不同**
- [ ] 筛选无结果空态列出当前条件，一键清除
- [ ] 接口失败显示「加载失败 + 重试 + 摘要」，**不显示「暂无任务」**（修 B2）
- [ ] 已有数据时刷新失败：保留旧数据 + 顶部错误条
- [ ] 503 显示「队列服务未启用（Redis）」并可重试
- [ ] 403 显示权限说明且**不提供重试**

### 9.7 小屏
- [ ] 375px：工具条不溢出，筛选收进 Sheet，chips 横向滚动
- [ ] 375px：卡片展示状态/耗时/进度/主操作，无需横向拖表格
- [ ] 批量条不与底部安全区/抽屉冲突（z 序：抽屉 > 批量条）
- [ ] 平板 768–1023：详情可打开（右侧抽屉 92vw）

### 9.8 性能与轮询
- [ ] 后台标签页不轮询（`refetchIntervalInBackground: false` + visibility）
- [ ] 无运行中任务时降频到 30s
- [ ] 列表接口不再返回 `payload/result`（响应体明显变小）
- [ ] 20 行 × 7 列无重复渲染 cell（桌面表与移动卡不同时求值，或注释说明理由）
- [ ] `counts` 与列表同源：点「失败」后 `total === counts.failed`

### 9.9 可访问性
- [ ] 表头 `aria-sort`；排序按钮有 `aria-label`
- [ ] 行内图标按钮都有 `aria-label` + Tooltip
- [ ] 抽屉打开后焦点进入、Esc 关闭、关闭后焦点回到触发元素
- [ ] chips 的 × 有 `aria-label`（如「移除筛选：队列 VNDB」）
- [ ] 相对时间都有 Tooltip 绝对时间，同一列不混用

### 9.10 回归（因为动了共享套件）
- [ ] comments / articles / topics / users / collections / friend-links / meilisearch 七个后台页无变化
- [ ] `bun run typecheck`、`bun run lint` 通过
- [ ] `sla.ts`、`toTaskListFilters`、`resolveEmptyState` 有单测

---

## 10. 开放问题（需产品确认，不阻塞 A–E）

1. **总数口径**：90 天保留期内是否允许跨页「清理全部终态」？还是只允许终态且限定当前筛选？
2. **优先级是否要人工可改**：若需要，Phase 4 加 `priority` 列 + 行内编辑（需审计日志）。
3. **失败是否要主动通知**：站内/桌面通知，还是只靠徽标？
4. **死信告警阈值**：`removeOnFail: 100` 意味着最多 100 条；是否需要 failed > N 时页头告警？
5. **是否允许强制删除运行中任务**：建议仅超管 + 二次输入确认，否则一律 409。

---

## 附：交付边界与下一步

- 本文档第 1–10 章 + 三份审计（`.dsh-research/*.md`）是**设计交付**（写作时未改源码）；落地情况与差异见 §11。
- 若确认开工 PR-E，建议顺序：① 共享套件 8 个可选 prop（先绿 7 个页面回归）→ ② `lib/admin/tasks/*` 纯函数 + 单测 → ③ 路由 URL 化（旧 UI 不变）→ ④ 组件树替换 → ⑤ 删除 `tasks-page.tsx`。
- 需要直接落地某个 PR 时说一声「做 PR-A」或「做 PR-E 的第 1、2 步」即可。

---

## 11. 实施记录（2026-10-27，PR-A ~ PR-E 已落地）

> 本节由实现阶段追加：上面 1–10 章是设计定稿，这里只记录「实际做了什么、与设计的差异、验证结果」。

### 11.1 后端（PR-A/B/C/D）

| 项 | 落地位置 | 说明 |
|---|---|---|
| 列表 V2 | `apps/api/src/modules/tasks/service.ts` 的 `listJobsV2` | 多值筛选取并集去重 + 白名单校验；`q`（id/type/error 子串，LIKE 通配符转义）；`dateFrom/dateTo` 半开区间；`overdue`（SQL 侧按类型 SLA 推导）；`retryable`；排序白名单 + `id` 稳定二级键 + `NULLS LAST`；三查询并行（列表投影 / total / counts 分面） |
| counts 口径 | 同上 | `counts` 的 where **不含状态**，`total` 含状态 ⇒ 点任意状态后 `total === counts[status]` |
| 字典下发 | `getTaskMeta` + `GET /tasks/meta` | 队列/类型/优先级/SLA/保留期由服务端下发，前端不再硬编码字典 |
| 写门控 | `deleteOne` / `retryOne` + `batchDeleteJobs` / `batchRetryJobs` | 非终态删除 409 `TASK_NOT_TERMINAL`（`force` 才允许）；同 queue+type 已有活跃任务时重试 409 `TASK_ALREADY_ACTIVE`；日志+任务同事务删除 |
| 批量语义 | `batchDeleteJobs` / `batchRetryJobs` / 死信 batchRepublish / batchRemove | HTTP 永远 200 + 逐项 `results`；已不存在计 `missing` 而非整体 404 |
| 错误体 | `fail(code, message)` | 统一 `{ code, message }`（HTTP 状态由码映射）；BFF 侧把 code 编码进 message 供前端还原 |
| 死信/日志契约 | `listDeadLetterJobs` / `getJobLogs` | 死信 envelope（多取 1 条判 `hasMore`，bun-queue 无 total）；日志 `limit/afterId/level` 增量 |
| 队列计数 | `getQueueStats` | 串行 5 次 Redis 往返 → `Promise.all` + 单项容错 + `source` 标记 |
| 索引 | `task-log.ts` + `0026_nasty_the_twelve.sql` + `0027_queue_job_search_indexes.sql` | 6 条组合/排序 btree（`db:generate` 生成）；`id/type/error` 的 `pg_trgm` GIN（手写迁移，参照 0009/0023 先例） |

### 11.2 前端（PR-E）

| 层 | 落地位置 | 说明 |
|---|---|---|
| 共享套件 | `components/admin/data-table/*`、`hooks/use-admin-table-state.ts` | 只加可选 prop：`visibleColumnIds`（列显隐真正做到生效）、`error/onRetry/errorTitle`、`searchActive/advanced/advancedCount/chips`、`onClear/group/removable`、`primaryActions/disabledReason`、分页 clamp、`aria-sort`；新增 13 个用例 |
| URL 状态 | `lib/admin/tasks/params.ts` + `routes/admin/_authL/tasks.tsx` | zod/mini schema（`_default` 与 `catch` 成对）+ `stripSearchParams`；`loaderDeps` 与组件共用 `tasksQueryOptions` |
| 数据层 | `lib/admin/tasks/{query,labels,sla,mutations}.ts`、`server/admin/tasks.ts` | 查询键单一来源；SLA 纯函数（stalled/overdue/due-soon）；写操作 hooks；BFF 全量 V2 + `parseApiError` |
| 组件树 | `components/admin/tasks/*`（17 个文件） | 页头/概览/队列泳道/筛选条/chips/列 registry/表格/行操作/批量条/详情右侧抽屉（+ task-detail/ 下 5 个）/死信抽屉/断点 hook |
| 删除 | `components/admin/tasks-page.tsx` | god component 已移除（HEAD 版 868 行），旧 import 无残留 |

### 11.3 与设计的差异（有意为之）

1. **全局 VALIDATION 错误体未改**：只把 tasks 模块的业务错误改成 `{code,message}`。全局 `onError` 的 VALIDATION 分支影响所有模块，需单独 PR + 全量回归，收益低风险高，故本轮不动。
2. **未新增 `priority/assignee_id/due_at` 三列**：优先级由「队列语义 + 类型」派生、负责人显示为触发来源、截止时间由 SLA 推导（与 §0.2 H2–H5 一致）。人工优先级/真实负责人仍属 Phase 4。
3. **`GET /tasks/stats` 形状未变**：侧栏徽标（`admin-shell.tsx`）继续用它；列表页的分面计数改走列表响应里的 `counts`，两者不冲突。
4. **详情抽屉的 SLA 文案**复用 `lib/admin/tasks/sla.ts`，与列表染色同一套规则（避免两处判定漂移）。
5. **路由 loader 在客户端不阻塞**：SSR 阻塞预取（首屏直出），客户端 fire-and-forget + 组件 `placeholderData`。否则每次改筛选都要等 loader，超过 `defaultPendingMs=60` 就把整页换成 pendingComponent，比「压暗旧数据」更闪。
6. **错误态保留筛选条**：接口挂掉时用户更需要「换个筛选试试」，所以错误卡自己画外壳并把工具条留在顶部，而不是交给 `AdminDataTable` 的 error 分支（那会把工具条一起藏掉）。

### 11.4 验证

- `bun run typecheck`：api + web 全绿
- `bun run lint`：biome + oxlint 全绿（0 warning / 0 error）
- `bun --cwd apps/web-tanstack test`：32 个文件 / 258 个用例通过（含新增 params 15、sla 17、data-table-extras 13、menu-group 5、loading-states 5）
- 迁移：`db:check` 通过；**上线前需执行 `bun --cwd apps/api db:up`** 应用 0026/0027

### 11.5 上线前回归修复：Base UI 菜单分组

打开下拉菜单时报 `Base UI: MenuGroupContext is missing`。根因：`DropdownMenuLabel` 包装的是 `Menu.GroupLabel`，Base UI 要求它有 `Menu.Group`/`Menu.RadioGroup` 祖先；这几处 label 直接挂在 `DropdownMenuContent` 下。

修复（label 外包 `DropdownMenuGroup`，RadioGroup 嵌在 Group 内）：

| 文件 | 菜单 |
|---|---|
| `components/admin/tasks/task-page-header.tsx` | 自动刷新、手动触发（队列分组标题） |
| `components/admin/tasks/task-filter-bar.tsx` | 队列多选、时间范围 |
| `components/admin/admin-shell.tsx` | 用户菜单（**存量 bug**，所有后台页都会触发，顺带修掉） |

回归防护：新增 `components/admin/tasks/task-menu-group.test.tsx`（5 例），把「每个菜单真的打开一次并断言内容」固化下来 —— 这类错误类型检查与 lint 都发现不了。

### 11.6 数据层与加载态（React Query）

**数据全部走 React Query，且查询定义收敛为 `queryOptions`**（`lib/admin/tasks/query.ts`）：

| 查询 | 定义 | 使用方 |
|---|---|---|
| 列表（含 counts 分面） | `tasksQueryOptions(filters)` | 路由 loader 预取 + 页面 `useQuery`（共用同一 queryKey） |
| 任务字典 | `taskMetaQueryOptions()`（staleTime 5min） | 页头/筛选条/队列标签 |
| 队列实时计数 | `taskQueuesQueryOptions(intervalMs)`（后台不轮询） | 队列泳道 |
| 详情 / 日志 / 死信 | 各自 `useQuery` / `useInfiniteQuery`（组件内） | 抽屉 |

**路由 loader 不再阻塞渲染**：只在客户端 `void ensureQueryData` 预热（hover/intent 预取、筛选切换缓存命中），不 `await`。admin 页是登录后页面 + noindex，SSR 预取的数据无法复用到浏览器进程，只会让首屏等 API；现在 HTML 首帧就是骨架。

**加载态覆盖（避免「0 条 / 暂无队列」被误读成空数据）**：

| 区域 | 加载表现 |
|---|---|
| 列表 | `AdminDataTable` 骨架行（= pageSize，最多 12）；改筛选时 `placeholderData` 保留旧行 + 压暗 |
| 概览条 | 5 个数字位显示 `Skeleton`，容器 `aria-busy` |
| 队列泳道 | 一行摘要骨架「队列概览」+ 两条 Skeleton，而不是整块消失 |
| 筛选条 | 队列菜单「队列加载中…」、高级筛选「任务类型加载中…」 |
| 手动触发 | 「任务字典加载中…」（与「尚未加载」区分） |
| 详情 / 日志 / 死信 | 各自骨架；刷新失败保留旧数据 |

回归防护：`task-loading-states.test.tsx`（5 例）断言骨架数量、`aria-busy` 与三处「加载中…」文案。

