# 后台列表基础设施审计（ui-audit）

- 审计对象：后台任务列表页重构所需的表格/工具条/行操作/抽屉/状态层能力
- 审计方式：只读源码 + 对照 5 个既有后台列表页的真实用法
- 结论时间点：2026-10-27
- 证据格式：文件:行号（链接可点）

---

## 0. 结论速览

**可直接复用、无需改动的部分**

1. 列定义驱动的表格本体（列/对齐/断点隐藏/移动卡片/行点击/行样式/固定操作列）。
2. 首屏骨架（表格 8 行 / 移动 5 卡）、后台刷新压暗、空态（EmptyState 统一入口）。
3. 行选择模型（Set<string> 受控、全选当前页、indeterminate）、批量条容器（fixed 浮出）。
4. 乐观写操作链路 `useAdminMutation` + `lib/admin/optimistic.ts` 的三个缓存原语。
5. 查询键单一来源 `adminKeys` / `invalidations`。

**阻断重构的硬缺口（4 个，必须在上层补齐或扩 prop）**

| # | 缺口 | 一句话 |
| --- | --- | --- |
| G1 | 列显隐没接外部状态 | `visibleColumns` 只过滤 `defaultHidden`，页面传进来的 `visibility` 只影响菜单勾选，不影响表格 |
| G2 | 错误态无归属层 | 三层（表 / 页面 / 路由）都没有错误位；任务页连 toast 都没有，失败渲染成「空态」 |
| G3 | 工具条表达不了「高级折叠 + chips 可删」 | 只有下拉式筛选 chip，没有删除按钮，没有折叠容器，搜索也不参与 isFiltered |
| G4 | 行操作没有「高频外露」与「禁用原因」 | `RowActionsMenu` 只有一个 ⋯；`disabled` 无 reason；高频按钮要页面自己拼 |

**另外两个现状 bug（重构顺带修）**

- 768–1023px 区间，任务详情面板彻底不可见（`!isMobile` 与 `lg:block` 互斥，见 §7.2）。
- 越界页码时 `pageRange` 会渲染出「0」页并重复数字（见 §4.3）。

---

## 1. 审计范围

| 目录 / 文件 | 行数 | 角色 |
| --- | --- | --- |
| `components/admin/data-table/data-table.tsx` | 488 | 表格容器（唯一实现） |
| `components/admin/data-table/toolbar.tsx` | 339 | 工具条 + 筛选 chip + 列显隐 + 密度 |
| `components/admin/data-table/pagination.tsx` | 183 | 分页脚 |
| `components/admin/data-table/row-actions.tsx` | 71 | ⋯ 行操作菜单 |
| `components/admin/data-table/bulk-actions.tsx` | 55 | 批量操作条 |
| `components/admin/data-table/types.ts` | 55 | 列 / 空态 / 行操作类型 |
| `components/admin/admin-table.tsx` | 303 | 旧原子层 + `StatusPill`（仍在用） |
| `components/admin/confirm-dialog.tsx` | 90 | 统一确认弹窗 |
| `components/admin/admin-page-header.tsx` | 32 | 页头包装 |
| `hooks/use-admin-table-state.ts` | 90 | 排序/选择/分页/密度/列显隐聚合 |
| `hooks/use-admin-mutation.ts` | 141 | 乐观写操作 |
| `hooks/use-pagination.ts` | 61 | **死代码**（全仓无调用） |
| `components/admin/tasks-page.tsx` | 1492 | 待重构页面 |

对照页面：`comments-page.tsx`(750)、`articles-page.tsx`(565)、`users-page.tsx`(1078)、`collections-page.tsx`、`topics-page.tsx`、`meilisearch/*-tab.tsx`。

---

## 2. AdminDataTable 能力矩阵

| 能力 | 结论 | 证据 |
| --- | --- | --- |
| 列定义驱动 | 有 | [types.ts:13-33](apps/web-tanstack/src/components/admin/data-table/types.ts#L13-L33) |
| 排序受控 | 有 | [data-table.tsx:128-130](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L128-L130) |
| 排序三态（升→降→取消） | 有 | [data-table.tsx:54-59](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L54-L59) |
| 排序 a11y（aria-sort） | **无** | 表头 `th` 未设 `aria-sort`（[data-table.tsx:250-267](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L250-L267)），仅按钮有 aria-label |
| 列显隐（外部可见性） | **半成品 / 假支持** | [data-table.tsx:189](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L189) |
| 行密度 | 有 | [data-table.tsx:142](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L142) + [12-15](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L12-L15) |
| 行选择 | 有 | [data-table.tsx:131-133](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L131-L133) |
| 全选语义 | 有（仅当前页） | [data-table.tsx:190-204](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L190-L204) |
| 选择跨页保持 | 有（但无清理钩子） | `selectedIds` 外部持有，组件不清；见 §2.2 |
| 批量条容器 | 有 | [data-table.tsx:148](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L148) + [484-485](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L484-L485) |
| 移动卡片（自动） | 有 | [data-table.tsx:390-482](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L390-L482) |
| 移动卡片（整卡自定义） | 有 | [data-table.tsx:150-151](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L150-L151)、[416-421](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L416-L421) |
| 行点击 | 有 | [data-table.tsx:136-137](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L136-L137) |
| 行级样式 | 有 | [data-table.tsx:134-135](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L134-L135) |
| 右侧固定操作列 | 有 | [data-table.tsx:268-275](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L268-L275)、[366-380](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L366-L380) |
| 首屏骨架 | 有 | [data-table.tsx:215](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L215)、[285-302](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L285-L302) |
| 后台刷新态 | 有（整表 opacity-60） | [data-table.tsx:279-283](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L279-L283) |
| 空态 | 有 | [data-table.tsx:303-321](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L303-L321) |
| 错误态 / 重试 | **无** | props 无 error/onRetry（[data-table.tsx:118-152](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L118-L152)） |
| 加载更多 / 无限滚动 | 无 | 只有分页脚 |
| 行级自定义组件（如 dnd-kit） | **无** | 页面注释明说不行：[friend-links-page.tsx:70-75](apps/web-tanstack/src/components/admin/friend-links-page.tsx#L70-L75) |
| 表尾汇总行 | 无 | — |

### 2.1 列显隐是「假支持」（G1）

`AdminDataTable` 内部只有一行决定显示哪些列：

```tsx
const visibleColumns = columns.filter((column) => !column.defaultHidden);
```

证据：[data-table.tsx:189](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L189)。
而 `defaultHidden` 的注释明确写着它是「列显隐菜单的**初值**」：

```tsx
/** 默认是否可见（列显隐菜单的初值） */
defaultHidden?: boolean;
```

证据：[types.ts:27-28](apps/web-tanstack/src/components/admin/data-table/types.ts#L27-L28)。

结果：菜单勾选只会改变 `useAdminTableState` 的 `hiddenColumns`（[use-admin-table-state.ts:40-63](apps/web-tanstack/src/hooks/use-admin-table-state.ts#L40-L63)），表格完全不理它。

**现状的两种绕法**：

- 绕法 A（users-page、collections-page）：页面自己先过滤一遍再传进去 —— [users-page.tsx:390-392](apps/web-tanstack/src/components/admin/users-page.tsx#L390-L392) 的 `columns.filter((c) => !table.hiddenColumns.includes(c.id))`，然后 [399](apps/web-tanstack/src/components/admin/users-page.tsx#L399) 传 `columns={visibleColumns}`。
- 绕法 B（comments / articles / topics）：干脆不传 `visibility`，只传 `density` —— [comments-page.tsx:599](apps/web-tanstack/src/components/admin/comments-page.tsx#L599)、[622-623](apps/web-tanstack/src/components/admin/comments-page.tsx#L622-L623)。

**副作用**：`visibility` 的 `label` 需要页面在 `useAdminTableState({ columns })` 里再声明一次列元数据（[use-admin-table-state.ts:6](apps/web-tanstack/src/hooks/use-admin-table-state.ts#L6) + [12-13](apps/web-tanstack/src/hooks/use-admin-table-state.ts#L12-L13)），因为 `AdminColumn` 没有 `label` 字段（[types.ts:13-33](apps/web-tanstack/src/components/admin/data-table/types.ts#L13-L33)）。同一列的信息写两遍，很容易漂移。

### 2.2 行选择的跨页语义

`allSelected` 只按当前页 `rows` 计算：

```tsx
const allIds = rows.map(getRowId);
const selectedOnPage = allIds.filter((id) => selectedIds?.has(id));
```

证据：[data-table.tsx:190-194](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L190-L194)。

这本身是合理设计，但组件与 `useAdminTableState` 都**不在换页 / 改筛选时清空选择**：

- `useAdminTableState` 里没有任何 useEffect 监听 `page`（[use-admin-table-state.ts:71-89](apps/web-tanstack/src/hooks/use-admin-table-state.ts#L71-L89)）。
- 任务页 `onPageChange={setPage}` 直连（[tasks-page.tsx:1402](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1402)），选择集原样保留。

后果：第 1 页选 3 条 → 翻到第 2 页再选 2 条 → 批量删除提示「已选 5 条」，用户以为只删本页。这是重构必须收口的语义（建议由上层在 page/filters 变化时 `clearSelection()`，或给 `AdminDataTable` 加 `resetSelectionOn`）。

### 2.3 桌面表与移动卡是「双份 DOM」

两者永远同时渲染，只靠 CSS 断点互斥显示：

- 桌面：`<div className="hidden overflow-x-auto w-full sm:block">`（[data-table.tsx:227](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L227)）
- 移动：`<ul className="flex flex-col divide-y divide-border/60 sm:hidden">`（[data-table.tsx:390](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L390)）

因此每行 cell 会被求值两次。任务页列里含 `Tooltip`（[tasks-page.tsx:1099-1110](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1099-L1110)）和 `Progress`（[1070-1080](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1070-L1080)），20 行 × 6 列 ≈ 240 个 cell 求值 → 480 次。滚动时是可感知的成本。

同时注意断点不一致：表格切卡片用 `sm`(640px)，而 `useIsMobile` 用 768px（[use-mobile.ts:3](apps/web-tanstack/src/hooks/use-mobile.ts#L3)）。见 §7.2。

---

## 3. DataTableToolbar 对「常用外露 / 高级折叠 / chips 可删」的支持度

### 3.1 当前表达力

| 能力 | 支持 | 证据 |
| --- | --- | --- |
| 搜索框（受控 + 提交） | 有 | [toolbar.tsx:243-249](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L243-L249) |
| 下拉式筛选 chip（单选） | 有 | [toolbar.tsx:138-160](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L138-L160) |
| 下拉式筛选 chip（多选 + 计数） | 有 | [toolbar.tsx:118-136](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L118-L136)、[26-32](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L26-L32) |
| chip 上显示当前值 | 有 | [toolbar.tsx:55-71](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L55-L71)、[107-112](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L107-L112) |
| **单 chip 可删除（×）** | **无** | chip 是 `DropdownMenuTrigger`（[toolbar.tsx:92-114](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L92-L114)），只能重开菜单选「全部」/取消勾选 |
| **高级筛选折叠区** | **无** | props 只有 `leading`/`actions` 两个 ReactNode 槽（[toolbar.tsx:257-261](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L257-L261)），没有 `advanced` 槽 |
| 一键重置 | 有，但触发条件偏窄 | [toolbar.tsx:315-325](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L315-L325) |
| 重置按钮感知「搜索已生效」 | **无（默认）** | [toolbar.tsx:282-284](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L282-L284) 只从 `filters` 推 |
| 列显隐菜单 | 有（但见 G1） | [toolbar.tsx:174-205](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L174-L205) |
| 密度菜单 | 有 | [toolbar.tsx:207-237](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L207-L237) |
| 窄屏两段换行 | 有 | [toolbar.tsx:288-292](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L288-L292) |

### 3.2 三个具体的「表达不了」

**(a) chips 不可单独删除**

`FilterChip` 的整个触发器就是下拉按钮，没有任何 × 区域；要清掉单个筛选必须：点 chip → 打开菜单 → 选「全部…」。任务页为此只能提供「重置」全清（[tasks-page.tsx:1371-1376](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1371-L1376)），用户想只清队列筛选时体验断层。

**(b) 没有高级筛选容器**

`filters: AdminFilter[]` 是扁平数组（[toolbar.tsx:250](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L250)），没有 `primary / advanced` 分组，也没有折叠开关。想实现「常用 3 个外露、剩下 4 个收进『高级』」只能：

- 把常用项塞 `filters`，把高级项塞 `actions`（语义错位，且 `actions` 在右侧，见 [toolbar.tsx:335](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L335)）；
- 或干脆不传 `filters`，用 `leading` 手写整块。

**(c) 搜索不进 isFiltered**

`filtered` 的默认推导只遍历 `filters`：

```tsx
const filtered = isFiltered ?? (hasFilters && filters.some((f) => activeLabelOf(f) != null));
```

证据：[toolbar.tsx:283-284](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L283-L284)。所以「只输入了搜索词」时重置按钮不出现。现有两个绕法证明这是坑：

- meilisearch 就显式传 `isFiltered={search.length > 0}`（[overview-tab.tsx:294](apps/web-tanstack/src/components/admin/meilisearch/overview-tab.tsx#L294)）；
- 任务页把搜索清空能力放在 `onReset` 里，但按钮本身不出现（[tasks-page.tsx:1371](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1371) 与 [1353-1358](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1353-L1358)）。

### 3.3 需要的最小扩展（保持向后兼容）

```ts
// toolbar.tsx
export type AdminFilter = (
  | { multi?: false; value: string; onChange: (next: string) => void }
  | { multi: true; value: string[]; onChange: (next: string[]) => void }
) & {
  id: string;
  label: string;
  options: AdminFilterOption[];
  allLabel?: string;
  group?: "primary" | "advanced";   // 新增：分层
  onClear?: () => void;             // 新增：chip 上的 ×
  removable?: boolean;              // 新增：默认 !!onClear
};

export type DataTableToolbarProps = {
  // …现有字段全部保留
  searchActive?: boolean;           // 新增：并入 filtered 推导
  advancedOpen?: boolean;           // 新增：折叠受控
  onAdvancedOpenChange?: (open: boolean) => void;
  advancedCount?: number;           // 新增：折叠按钮上的角标
  advanced?: ReactNode;             // 新增：展开后的高级筛选面板
  chips?: ReactNode;                // 新增：自绘 chips 行（逃生口）
};
```

---

## 4. 分页契约与边界

### 4.1 契约

```ts
export type DataTablePaginationProps = {
  page: number;                    // 1 起
  pageCount: number;               // 已算好的总页数（调用方负责）
  total: number;                   // 必需；内部 total.toLocaleString()
  pageSize?: number;
  pageSizeOptions?: number[];      // 默认 [10,20,50,100]
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  hint?: string;
  className?: string;
};
```

证据：[pagination.tsx:28-40](apps/web-tanstack/src/components/admin/data-table/pagination.tsx#L28-L40)。

关键实现细节：

- `pageCount` 由调用方算：任务页 `Math.max(1, Math.ceil(total / pageSize))`（[tasks-page.tsx:890](apps/web-tanstack/src/components/admin/tasks-page.tsx#L890)）。
- 组件内部再兜底一次 `const safePageCount = Math.max(1, pageCount)`（[pagination.tsx:60](apps/web-tanstack/src/components/admin/data-table/pagination.tsx#L60)）。
- `pageSize` 的 Select 只做 `value != null` 守卫（[pagination.tsx:88-93](apps/web-tanstack/src/components/admin/data-table/pagination.tsx#L88-L93)）。

### 4.2 边界行为

| 场景 | 行为 | 证据 |
| --- | --- | --- |
| total = 0（pageCount 传 1） | 无 hint 时整条页脚不渲染；有 hint 时渲染「共 0 条」+ 全按钮 disabled | [pagination.tsx:59](apps/web-tanstack/src/components/admin/data-table/pagination.tsx#L59)、[61-62](apps/web-tanstack/src/components/admin/data-table/pagination.tsx#L61-L62) |
| pageCount 传 0 | 内部 `Math.max(1, …)` 兜住 | [pagination.tsx:60](apps/web-tanstack/src/components/admin/data-table/pagination.tsx#L60) |
| **page 越界（page > pageCount）** | **不 clamp**，且会渲染出 0 页与重复页码 | [pagination.tsx:20-26](apps/web-tanstack/src/components/admin/data-table/pagination.tsx#L20-L26)、[61-62](apps/web-tanstack/src/components/admin/data-table/pagination.tsx#L61-L62) |
| 改 pageSize | 组件只回调，是否回第 1 页由调用方决定 | 任务页 [1403-1406](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1403-L1406) 回了；comments 页 [647](apps/web-tanstack/src/components/admin/comments-page.tsx#L647) 直接把 `setPageSize` 传下去（`useAdminTableState` 内部会回第 1 页，见 [use-admin-table-state.ts:80-83](apps/web-tanstack/src/hooks/use-admin-table-state.ts#L80-L83)） |
| 移动端 | 首页/尾页按钮隐藏，页码区变为 `page / pageCount` 文本 | [pagination.tsx:115](apps/web-tanstack/src/components/admin/data-table/pagination.tsx#L115)、[156-158](apps/web-tanstack/src/components/admin/data-table/pagination.tsx#L156-L158) |
| 客户端二次过滤（任务页搜索） | `total` 仍是服务端总数，页脚显示与列表条数不一致；只能靠 `hint` 说明 | [tasks-page.tsx:1407-1413](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1407-L1413) |

### 4.3 越界页的复现路径

`pageRange(current, total)`：

```ts
if (current >= total - 2)
  return [1, "…", total - 3, total - 2, total - 1, total];
```

证据：[pagination.tsx:23-24](apps/web-tanstack/src/components/admin/data-table/pagination.tsx#L23-L24)。

代入 `page=5, pageCount=3` → 返回 `[1, "…", 0, 1, 2, 3]`：出现编号 0 的按钮，并且 1/2/3 与前面重复。触发场景很现实：用户停在第 5 页，筛选后总数变小。

结论：**页码 clamp 现在没有任何一层负责**。重构时应有唯一负责方（建议：`page` 走 URL 搜索参数的 `beforeLoad`/effect 校验，越界即回落到 `pageCount`）。

---

## 5. RowActionsMenu：「高频外露 + 更多」能力

### 5.1 组件本身只有「更多」

```ts
export function RowActionsMenu({
  actions: AdminRowAction[];
  label = "更多操作";
  align?: "start" | "end";
})
```

证据：[row-actions.tsx:20-28](apps/web-tanstack/src/components/admin/data-table/row-actions.tsx#L20-L28)。渲染体是单个 ⋯ 按钮 + 一个下拉（[32-69](apps/web-tanstack/src/components/admin/data-table/row-actions.tsx#L32-L69)）。

注释里描述的策略（「高频操作 1-2 个直接用图标按钮放在左侧，其余收进 ⋯」，[row-actions.tsx:14-19](apps/web-tanstack/src/components/admin/data-table/row-actions.tsx#L14-L19)）**没有落在组件 API 上**，只能由页面手工拼。唯一这么做的页面是 users-page：

```tsx
rowActions={(user) => (
  <>
    <Button variant="ghost" size="icon-sm" aria-label="封禁用户" …>…</Button>
    <RowActionsMenu actions={[{ label: "设置角色", … }]} />
  </>
)}
```

证据：[users-page.tsx:459-514](apps/web-tanstack/src/components/admin/users-page.tsx#L459-L514)（高频封禁/解封在 [463-489](apps/web-tanstack/src/components/admin/users-page.tsx#L463-L489)，其余进 ⋯ 在 [490-513](apps/web-tanstack/src/components/admin/users-page.tsx#L490-L513)）。

### 5.2 行操作项的能力边界

```ts
export type AdminRowAction = {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
  pending?: boolean;      // 渲染 spinner 并禁用
  separator?: boolean;
  hidden?: boolean;
};
```

证据：[types.ts:44-55](apps/web-tanstack/src/components/admin/data-table/types.ts#L44-L55)。

| 想要 | 能否 | 说明 |
| --- | --- | --- |
| 高频项外露 | 页面手工拼 | 组件无 `primaryActions` |
| 单项 pending 转圈 | 能 | [row-actions.tsx:52-62](apps/web-tanstack/src/components/admin/data-table/row-actions.tsx#L52-L62) |
| 整行 pending（全部禁用） | 能（页面传 `disabled`） | 见 users-page `pending` 派生 |
| **禁用原因提示（权限/状态）** | **不能** | `disabled` 无 reason，也没有 Tooltip 包装；用户只会看到灰掉的项 |
| 二次确认 | 不能内置 | 必须自己开 `ConfirmDialog`（tasks-page [1173-1174](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1173-L1174)、[1472-1489](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1472-L1489)） |
| 快捷键/描述副文案 | 不能 | 无 `description` 字段 |
| 危险操作分组 | 半 | 只有 `separator` 分隔线 |

建议扩展（追加可选字段即可）：

```ts
export type AdminRowAction = {
  // …现有字段
  disabledReason?: string;   // 有值时渲染 Tooltip / 菜单项副文案
  description?: string;      // 菜单项第二行说明
};

export function RowActionsMenu(props: {
  actions: AdminRowAction[];
  primaryActions?: AdminRowAction[];  // 新增：外露为图标按钮
  primaryMax?: number;                // 新增：默认 1
  label?: string;
  align?: "start" | "end";
})
```

---

## 6. 抽屉：desktop drawer vs sheet

### 6.1 Drawer 只能是底部弹出

`DrawerViewport` 把定位写死为底部居中：

```tsx
<DrawerPrimitive.Viewport className="flex fixed inset-0 z-50 justify-center items-end" />
```

证据：[drawer.tsx:34-39](apps/web-tanstack/src/components/ui/drawer.tsx#L34-L39)。Popup 样式同样是底部卡：`rounded-t-2xl … sm:max-w-lg sm:rounded-2xl`（[drawer.tsx:62](apps/web-tanstack/src/components/ui/drawer.tsx#L62)）。

结论：**没有右侧抽屉**。组件也没有 `side` prop（[drawer.tsx:45-54](apps/web-tanstack/src/components/ui/drawer.tsx#L45-L54) 只有 `showGrabBar` / `showCloseButton`）。任务页的两个抽屉（[695](apps/web-tanstack/src/components/admin/tasks-page.tsx#L695) 死信、[1453](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1453) 移动详情）都是底部卡片，这与它的移动端语义是匹配的。

### 6.2 右侧抽屉只能用 Sheet

`SheetContent` 支持 `side: "top" | "right" | "bottom" | "left"`（[sheet.tsx:39-48](apps/web-tanstack/src/components/ui/sheet.tsx#L39-L48)），右侧宽度是 `w-3/4` + `sm:max-w-sm`（[sheet.tsx:56](apps/web-tanstack/src/components/ui/sheet.tsx#L56)），即 **桌面最大 384px**。

两个注意点：

1. 想更宽必须用 `className` 覆盖 `sm:max-w-*`；后台导航就是这么用的（[admin-shell.tsx:241-246](apps/web-tanstack/src/components/admin/admin-shell.tsx#L241-L246)，`side="left"` + `w-64`）。
2. Sheet 没有内建滚动容器：`SheetContent` 是 `flex flex-col gap-4`（[sheet.tsx:55-58](apps/web-tanstack/src/components/ui/sheet.tsx#L55-L58)），长内容必须在内部自己套 `overflow-y-auto`。现有任务页的桌面详情是 360px 固定列（[tasks-page.tsx:1294](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1294)、[1443](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1443)），若改成 Sheet 右侧抽屉需要显式加宽 + 内部滚动。

### 6.3 base-nova 的 render prop 用法（易踩）

| 组件 | 用法 | 证据 |
| --- | --- | --- |
| `DropdownMenuTrigger` | `render={<Button …/>}`，子节点是按钮内容 | [toolbar.tsx:93-114](apps/web-tanstack/src/components/admin/data-table/toolbar.tsx#L93-L114) |
| `TooltipTrigger` | `render={<span …/>}`（非 button 时必需） | [tasks-page.tsx:1100-1106](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1100-L1106) |
| `Select` | `value` 可空，`onValueChange(value: string \| null)` | [tasks-page.tsx:1196](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1196) 的 `value ?? "5000"` |
| `Tabs` | `onValueChange` 同样可空 | [tasks-page.tsx:1298-1301](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1298-L1301) |
| `Sheet` / `AlertDialog` | 关闭按钮 `render={<Button/>}` | [sheet.tsx:62-76](apps/web-tanstack/src/components/ui/sheet.tsx#L62-L76) |

### 6.4 层级（z-index）现状

| 层 | z | 证据 |
| --- | --- | --- |
| 批量条 | z-40 fixed bottom-5 | [bulk-actions.tsx:26-33](apps/web-tanstack/src/components/admin/data-table/bulk-actions.tsx#L26-L33) |
| Drawer backdrop / viewport | z-50 | [drawer.tsx:21](apps/web-tanstack/src/components/ui/drawer.tsx#L21)、[37](apps/web-tanstack/src/components/ui/drawer.tsx#L37) |
| Sheet backdrop / content | z-50 | [sheet.tsx:31](apps/web-tanstack/src/components/ui/sheet.tsx#L31)、[56](apps/web-tanstack/src/components/ui/sheet.tsx#L56) |
| 表头 sticky | z-10，操作列 z-20 | [data-table.tsx:240](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L240)、[271](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L271) |

批量条 z-40 < 抽屉 z-50，所以抽屉打开时批量条会被盖住 —— 行为合理，但意味着「抽屉里做批量」不可能，只能单条。

---

## 7. 骨架 / 错误 / 空态 / 权限：现在归哪一层

### 7.1 现状分配

| 状态 | 现在的归属 | 证据 | 评价 |
| --- | --- | --- | --- |
| 首屏骨架 | 表格层（`isLoading` && rows 为空） | [data-table.tsx:215](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L215) | 合适，但 `skeletonRows` 由页面算（[tasks-page.tsx:1327](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1327)） |
| 后台刷新 | 表格层（整表 opacity-60） | [data-table.tsx:282](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L282) | 合适 |
| 空态 | 表格层（`empty` prop） | [data-table.tsx:303-321](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L303-L321) | 合适；但页面要自己写「是筛选空还是真空」的文案（[comments-page.tsx:574-595](apps/web-tanstack/src/components/admin/comments-page.tsx#L574-L595)） |
| **查询错误** | **没有归属** | 表格 props 无 error（[data-table.tsx:118-152](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L118-L152)）；路由层只有 `__root` 有 errorComponent（[__root.tsx:110-126](apps/web-tanstack/src/routes/__root.tsx#L110-L126)），admin 子路由没有任何 error/pending 配置 | 缺口 G2 |
| 错误提示（临时） | 页面层 toast | comments [255-262](apps/web-tanstack/src/components/admin/comments-page.tsx#L255-L262)、articles [183-190](apps/web-tanstack/src/components/admin/articles-page.tsx#L183-L190)、users [248-251](apps/web-tanstack/src/components/admin/users-page.tsx#L248-L251) | 只闪一次，不留在界面上 |
| 错误重试 | 无 | — | 只有空态里借 `refetch` 冒充（[comments-page.tsx:589](apps/web-tanstack/src/components/admin/comments-page.tsx#L589)） |
| 权限（页面级） | 路由层 `beforeLoad` | [_authL.tsx:13-21](apps/web-tanstack/src/routes/admin/_authL.tsx#L13-L21) | 合适 |
| 权限（操作级） | 无 | `AdminRowAction.disabled` 无语义说明（[types.ts:49](apps/web-tanstack/src/components/admin/data-table/types.ts#L49)） | 缺口 G4 |
| 403 分支 | **不可靠** | `elysiaErrorF` 抛 `ApiError`，但注释明说 server fn 跨进程只保留 message、**status 在客户端不可用**（[elysia-error.ts:19-22](apps/web-tanstack/src/lib/elysia-error.ts#L19-L22)、[39-43](apps/web-tanstack/src/lib/elysia-error.ts#L39-L43)） | 错误态设计不要依赖 status 分支 |
| 乐观更新 | hook 层 | [use-admin-mutation.ts:87-129](apps/web-tanstack/src/hooks/use-admin-mutation.ts#L87-L129) | 合适，可直接复用 |

### 7.2 任务页现状：错误态与详情面板的两个实际 bug

**(a) 列表请求失败 → 显示「暂无任务记录」**

任务页只解构 `isLoading` / `isFetching`（[tasks-page.tsx:1325-1326](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1325-L1326)），`listQuery.error` 从未读取；`rows` 取 `data?.items ?? []`（[888](apps/web-tanstack/src/components/admin/tasks-page.tsx#L888)）。全页仅日志组件内部有 `isError`（[355](apps/web-tanstack/src/components/admin/tasks-page.tsx#L355)、[451-452](apps/web-tanstack/src/components/admin/tasks-page.tsx#L451-L452)）。

**(b) 768–1023px 详情面板消失**

- 桌面面板条件是 `!isMobile`（JS，断点 768，[use-mobile.ts:3](apps/web-tanstack/src/hooks/use-mobile.ts#L3)、[tasks-page.tsx:838](apps/web-tanstack/src/components/admin/tasks-page.tsx#L838)）**且** `hidden lg:block`（CSS，断点 1024，[tasks-page.tsx:1442-1444](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1442-L1444)）。
- 移动抽屉条件是 `isMobile`（[tasks-page.tsx:1452-1456](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1452-L1456)）。
- 于是 768 ≤ width < 1024：`isMobile=false` → 不渲染抽屉；aside 被 `hidden` 隐藏 → **详情无处显示**。

这已经是当前线上行为，重构时必须统一一套断点（建议全部交给 CSS，或把 `useIsMobile` 的断点改成与 `lg` 一致）。

---

## 8. 既有页面真实用法对照

| 页面 | useAdminTableState | visibility | density | sort | 行选择 | 错误处理 | 移动端 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| comments | 有（[232](apps/web-tanstack/src/components/admin/comments-page.tsx#L232)） | 未传 | 有（[599](apps/web-tanstack/src/components/admin/comments-page.tsx#L599)、[622](apps/web-tanstack/src/components/admin/comments-page.tsx#L622)） | 未用 | 未用 | toast（[255](apps/web-tanstack/src/components/admin/comments-page.tsx#L255)） | 表格自动卡片 |
| articles | 有（[168](apps/web-tanstack/src/components/admin/articles-page.tsx#L168)） | 未传 | 有（[503](apps/web-tanstack/src/components/admin/articles-page.tsx#L503)） | 未用 | — | toast（[183](apps/web-tanstack/src/components/admin/articles-page.tsx#L183)） | 表格自动卡片 |
| topics | 有（[141](apps/web-tanstack/src/components/admin/topics-page.tsx#L141)） | 未传 | 有（[417](apps/web-tanstack/src/components/admin/topics-page.tsx#L417)） | 未用 | — | toast（[156](apps/web-tanstack/src/components/admin/topics-page.tsx#L156)） | 表格自动卡片 |
| users | 有（[227](apps/web-tanstack/src/components/admin/users-page.tsx#L227)） | **传了 + 自己过滤**（[390-392](apps/web-tanstack/src/components/admin/users-page.tsx#L390-L392)、[444](apps/web-tanstack/src/components/admin/users-page.tsx#L444)） | 有（[406](apps/web-tanstack/src/components/admin/users-page.tsx#L406)、[445](apps/web-tanstack/src/components/admin/users-page.tsx#L445)） | 未用 | 未用 | toast（[248](apps/web-tanstack/src/components/admin/users-page.tsx#L248)） | 表格自动卡片 |
| collections | 有（[245](apps/web-tanstack/src/components/admin/collections-page.tsx#L245)） | 传了 + 自己过滤（[461](apps/web-tanstack/src/components/admin/collections-page.tsx#L461)） | 有（[439](apps/web-tanstack/src/components/admin/collections-page.tsx#L439)） | 未用 | 未用 | toast（[264](apps/web-tanstack/src/components/admin/collections-page.tsx#L264)） | 表格自动卡片 |
| friend-links | 未用 | — | — | — | — | 内联 ErrorState（[294-306](apps/web-tanstack/src/components/admin/friend-links-page.tsx#L294-L306)） | 自绘 grid（dnd-kit 限制，[70-75](apps/web-tanstack/src/components/admin/friend-links-page.tsx#L70-L75)） |
| meilisearch tabs | 有 | 未传 | 有 | 未用 | 未用 | 未单独处理 | 表格自动卡片 |
| **tasks** | **未用** | 未传 | 未传 | 未传 | **用了**（[1336-1337](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1336-L1337)） | **完全没有** | 表格自动卡片 + `useIsMobile` 抽屉 |

要点：`sort` 在整个后台**从未被使用**（所有页面都不传 `sort`/`onSortChange`）。表格支持度是「有但没有消费者」，重构时若引入服务端排序，`listTasks` 目前也不接受排序参数（[server/admin/tasks.ts:60-77](apps/web-tanstack/src/server/admin/tasks.ts#L60-L77)，只有 queue/type/status/pageSize/pageIndex）。

也只有 friend-links 做了「查询失败 → 界面内联错误 + 重试」这一套（[201](apps/web-tanstack/src/components/admin/friend-links-page.tsx#L201)、[294-306](apps/web-tanstack/src/components/admin/friend-links-page.tsx#L294-L306)），但它是绕开 `AdminDataTable` 自绘的。

---

## 9. 缺口清单（可直接转成重构待办）

### G1 列显隐没有真正的受控入口（半成品 API）

- 现象：`visibleColumns` 只过滤 `defaultHidden`（[data-table.tsx:189](apps/web-tanstack/src/components/admin/data-table/data-table.tsx#L189)），菜单勾选无效。
- 影响：任何引入列显隐的新页面都必须复制 users-page 的绕法；`defaultHidden` 语义被误用为「永久隐藏」。
- 建议：`AdminDataTable` 增加 `visibleColumnIds?: ReadonlySet<string>`（优先级高于 `defaultHidden`）；同时给 `AdminColumn` 加可选 `label?: string`，让 `visibility` 可以从列定义直接推导，去掉二次声明。

### G2 没有查询错误态（三层皆无）

- 现象：表格无 error/onRetry；admin 路由无 errorComponent；页面只 toast（tasks 连 toast 都没有）。
- 影响：接口 500 时页面显示「暂无任务记录 + 手动触发」——把故障误导成「没数据」，这是最严重的体验缺陷。
- 建议：分两层。① 表格层加 `error?: unknown` + `onRetry?: () => void`，渲染「加载失败 + 重试 + 错误摘要」；② 页面层只负责把 `query.error` 传进去，不再各自 toast。

### G3 工具条缺「高级折叠」和「可删 chip」

- 现象：见 §3.2。
- 影响：任务页把状态筛选做成外部 Tabs（[tasks-page.tsx:1296-1319](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1296-L1319)）、队列做成 chip，两套筛选语言并存；用户无法一键清单个条件。
- 建议：`AdminFilter` 增 `group` / `onClear`；`DataTableToolbar` 增 `advanced` 槽与 `searchActive`。

### G4 行操作缺「高频外露」与「禁用原因」

- 现象：见 §5。
- 影响：任务页把 6 个操作全塞进 ⋯（[tasks-page.tsx:1116-1177](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1116-L1177)），其中「查看日志 / 重试」是高频项，每次要点两层。
- 建议：`RowActionsMenu` 增 `primaryActions`；`AdminRowAction` 增 `disabledReason`。

### G5 页码缺少 clamp 唯一负责方

- 现象：§4.3 的 `[1, "…", 0, 1, 2, 3]`。
- 建议：URL 化后由路由层校验；组件层加防御（`page > pageCount` 时按 `pageCount` 渲染）。

### G6 选择与筛选/翻页没有联动清理

- 现象：§2.2。
- 建议：`useAdminTableState` 暴露 `resetToFirstPage` 已在用（[use-admin-table-state.ts:66-69](apps/web-tanstack/src/hooks/use-admin-table-state.ts#L66-L69)），但它只清 page + selection，**不负责在 page 改变时清**；建议加 `useEffect([page, filtersKey])` 或在 `AdminDataTable` 加 `onPageChange` 包装。

### G7 移动端与桌面端断点体系不一致（导致详情消失）

- 现象：§7.2(b)。
- 建议：统一走 CSS（`sm`/`lg` 容器查询），删掉 `useIsMobile` 对详情面板的判定；或至少把阈值对齐 1024。

### G8 表格与移动卡双份渲染

- 现象：§2.3。
- 建议：保持 SSR 一致的前提下二选一渲染（`useIsMobile` + 首帧延迟），或把移动卡做成 `<table>` 的 CSS 行变形减少一份 DOM。

### G9 搜索是「本页过滤」，不是查询条件

- 现象：`visibleRows` 在客户端对 `rows` 过滤（[tasks-page.tsx:988-997](apps/web-tanstack/src/components/admin/tasks-page.tsx#L988-L997)），placeholder 直白写「在本页搜索」（[1356](apps/web-tanstack/src/components/admin/tasks-page.tsx#L1356)），`termIds` 也基于过滤后结果（[999-1005](apps/web-tanstack/src/components/admin/tasks-page.tsx#L999-L1005)）。
- 影响：搜索 + 分页组合下结果不可信；页脚 `total` 与列表条数矛盾。
- 建议：搜索进查询键与服务端（`listTasks` 需加 `q`），工具栏用 `onSubmit` 提交、`placeholder` 不再出现「本页」。

### G10 `use-pagination.ts` 是死代码

- 现象：全仓仅定义、无调用（[use-pagination.ts:13](apps/web-tanstack/src/hooks/use-pagination.ts#L13)）。
- 影响：两套分页算法并存（`pageRange` vs `calculatePaginationRange`），容易改错文件。
- 建议：重构时删除或明确标记 legacy。

---

## 10. 可直接复用的签名（重构直接引用，不要重写）

```ts
// 列定义（types.ts:13-33）
export type AdminColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  hideBelow?: "sm" | "md" | "lg" | "xl";
  defaultHidden?: boolean;
  mobile?: "title" | "meta" | "body" | "hidden";
  mobileCell?: (row: T) => ReactNode;
};

// 表格（data-table.tsx:118-152）—— 现有全部 props，重构沿用
export type AdminDataTableProps<T> = {
  columns: AdminColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  isFetching?: boolean;
  skeletonRows?: number;
  empty: AdminTableEmpty;
  sort?: AdminSort;
  onSortChange?: (sort: AdminSort) => void;
  selectedIds?: ReadonlySet<string>;
  onSelectedIdsChange?: (next: Set<string>) => void;
  getRowClassName?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  actionsHeader?: ReactNode;
  minWidth?: string;
  density?: "comfortable" | "compact";
  toolbar?: ReactNode;
  footer?: ReactNode;
  bulkBar?: ReactNode;
  className?: string;
  renderMobileCard?: (row: T) => ReactNode;
};

// 空态（types.ts:36-41）
export type AdminTableEmpty = {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

// 状态徽标（admin-table.tsx:276-288）—— 任务页已在用
export function StatusPill(props: {
  tone?: "primary" | "success" | "warning" | "info" | "destructive" | "neutral";
  icon?: LucideIcon;
  spin?: boolean;
  children: ReactNode;
  className?: string;
}): ReactNode;

// 表格状态聚合（use-admin-table-state.ts:71-89）
const { sort, setSort, selectedIds, setSelectedIds, clearSelection,
        page, setPage, pageSize, setPageSize, density, setDensity,
        hiddenColumns, visibility, resetToFirstPage } =
  useAdminTableState({ storageKey: "tasks", defaultPageSize: 20, columns });

// 乐观写（use-admin-mutation.ts:39-58）
useAdminMutation<TData, TVars>({
  mutationFn, optimistic, affects, successMessage, errorMessage,
  onSuccess, onError, revalidate = true, mutationKey,
});
```

建议新增（只加可选 prop，不破坏现有 7 个页面）：

```ts
// AdminDataTable
visibleColumnIds?: ReadonlySet<string>;        // 覆盖 defaultHidden 逻辑
error?: unknown;                               // 有值 → 渲染错误态
onRetry?: () => void;
errorTitle?: ReactNode;                        // 默认「加载失败」
onPageChange?: (page: number) => void;         // 用于选择清理埋点
// DataTableToolbar
searchActive?: boolean; advanced?: ReactNode;
advancedOpen?: boolean; onAdvancedOpenChange?: (open: boolean) => void;
advancedCount?: number; chips?: ReactNode;
// AdminFilter: group?: "primary" | "advanced"; onClear?: () => void;
// RowActionsMenu: primaryActions?: AdminRowAction[];
// AdminRowAction: disabledReason?: string; description?: string;
// AdminColumn: label?: string;                   // 供列显隐菜单直接消费
```

---

## 11. 给重构的分层建议（边界清楚，才好拆 god component）

| 层 | 负责 | 现在的问题 |
| --- | --- | --- |
| L0 原语（data-table 套件） | 排版 / 骨架 / 空态 / 选择 / 移动卡 / 分页 / 分页脚 | 只要补 G1 / G2 / G3 / G4 的**可选 prop**，不要重写 |
| L1 视图组件 | 任务表格（列 + 行操作 + 工具条实例化） | 现在全在 tasks-page 的 1024-1177 行内联 |
| L2 侧栏/详情 | 详情面板（进度/日志/载荷） | 现在 TaskDetailPanel + LogConsole 共 290 行，且与页面共用一套 query key |
| L3 页面编排 | URL 状态 / 查询 hook / KPI / 泳道 / 抽屉挂载 | 现在 836-1492 行，897 行里混了 5 个 mutation、6 个 useState 组 |

任务页可以按现有**已经存在**的组件边界直接切：`KpiCard`（[206-248](apps/web-tanstack/src/components/admin/tasks-page.tsx#L206-L248)）、`QueueLanes`（[252-346](apps/web-tanstack/src/components/admin/tasks-page.tsx#L252-L346)）、`LogConsole`（[350-476](apps/web-tanstack/src/components/admin/tasks-page.tsx#L350-L476)）、`TaskDetailPanel`（[506-639](apps/web-tanstack/src/components/admin/tasks-page.tsx#L506-L639)）、`DeadLetterDrawer`（[642-776](apps/web-tanstack/src/components/admin/tasks-page.tsx#L642-L776)）、`EnqueueMenu`（[780-825](apps/web-tanstack/src/components/admin/tasks-page.tsx#L780-L825)）已经是自洽单元，抽出去即可。

---

## 12. 重构验收时可直接对照的检查项

1. 列显隐：勾掉一列后**表格真的少一列**（现在的实现不会）。
2. 错误态：把 `listTasks` 打挂，页面出现「加载失败 + 重试」，**不是**「暂无任务记录」。
3. 翻页后选择被清空，批量条数字归零。
4. 越界页（手改 URL/筛选后总数变小）不出现页码 0、不出现重复页码。
5. 768px 与 1023px 两个宽度下，详情面板都能打开（桌面侧栏或抽屉）。
6. 搜索词进查询键与 URL，刷新后仍生效，页脚 total 与列表条数一致。
7. 工具条上能单独删掉「队列」这一枚 chip，而不必清空全部筛选。
8. 行内「查看日志」是一级按钮，「删除记录」在 ⋯ 里且带确认。
9. 无权限/不可操作的行，菜单项给出灰掉的原因，而不是静默 disabled。
10. 20 行 × 6 列时移动卡不再重复渲染一遍全部 cell（若保留双份，需在注释里写明理由）。
