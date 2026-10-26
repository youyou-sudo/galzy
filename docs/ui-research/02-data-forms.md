# new-api 数据表格 / 表单 / 反馈组件体系调研

> 只读调研。路径相对 `new-api/web/src`（仓库根 `D:/Users/xiaoy/Documents/Github/new-api`），行号为写作时实际行号。
> 底座：TanStack Table v8 + Base UI（`@base-ui/react`）+ Tailwind v4 + OKLCH 语义变量 + react-hook-form + react-i18next + sonner。

---

## 1. 表格内核

### 1.1 三层结构

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 原子层 | `components/ui/table.tsx`（148 行） | 纯样式 `table/thead/tbody/tr/th/td`，无状态 |
| 业务层 | `components/data-table/**`（core/toolbar/layout/static/hooks） | 表头、分页、筛选、空态、骨架、移动卡片 |
| 业务页 | `features/<domain>/components/*-table.tsx` | 列定义 + 网关参数 + `<DataTablePage />` |

`components/data-table/README.md:3-17` 划了边界：只有跨 ≥2 个 feature 复用的表格代码才进 data-table，feature 专属列/动作/弹窗留在 feature 目录。

原子层是「薄壳 + 强继承」——让单元格里的徽标不会撑破行高：

```tsx
// components/ui/table.tsx:31-37
<table
  data-slot='table'
  className={cn(
    'w-full caption-bottom text-sm tabular-nums [font-family:var(--font-body)]',
    '[&_td]:text-sm [&_td]:font-medium [&_th]:text-sm',
    '[&_:is(th,td)_*]:[font-family:inherit] [&_:is(th,td)_*]:[font-size:inherit] [&_:is(th,td)_*]:[font-weight:inherit]',
    className
  )}
/>
```

### 1.2 行高 / 内边距 / hover / 选中

- 行高写死在 `TableBody`：`[&>tr]:h-15`（=60px），末行 `[&_tr:last-child]:border-0`（`ui/table.tsx:64-72`）；骨架行另用 `h-[52px]`（`core/table-skeleton.tsx:48`）。没有行高 prop，密度靠全局主题缩放（见 2.2）。
- 表头 `h-10 px-2 text-left align-middle font-medium whitespace-nowrap`（`ui/table.tsx:100-111`）。
- 单元格 `p-2 align-middle whitespace-nowrap`（`ui/table.tsx:113-124`）——**默认不换行**，长文必须显式用 `TruncatedCell` 或 max-width 收口。
- hover / 选中 / 展开三态共用一套色（`ui/table.tsx:87-98`）：

```tsx
// components/ui/table.tsx:87-98
<tr data-slot='table-row' className={cn(
  'group data-[state=selected]:bg-muted border-b transition-colors',
  'hover:[background-color:color-mix(in_oklch,var(--muted)_50%,var(--background))]',
  'has-aria-expanded:[background-color:color-mix(in_oklch,var(--muted)_50%,var(--background))]',
  className
)} />
```

### 1.3 边框与斑马纹

- 边框只做「外框 + 横向内线」：容器 `overflow-hidden rounded-lg border`（`core/data-table-view.tsx:63-68`），行与表头底边各一条 `border-b`，**无竖线**。
- **无斑马纹**：全仓 grep `odd:`/`even:`/`striped` 零命中，层次完全由 hover/selected/disabled 承担。
- 禁用行不换色块，而是换一组 `--table-disabled*` 变量 + 首列 4px 左边条（`data-table/index.ts:66-70` 的 `DISABLED_ROW_DESKTOP` / `:69-70` 的 `DISABLED_ROW_MOBILE`），业务页通过 `getRowClassName` 按 `isMobile` 选择（`features/users/components/users-table.tsx:256-259`）。

### 1.4 `--table-*` 变量组（亮/暗两套）

`styles/theme.css` 用 `color-mix(in oklch, var(--foreground) N%, var(--background))` 定义 6 个变量，只做同色系微提亮，不引入新色相：

| 变量 | 亮色 | 暗色 |
| --- | --- | --- |
| `--table-header` | foreground 1.5%（`theme.css:152-156`） | 6%（`:229`） |
| `--table-header-hover` | 3%（`:157-161`） | 9%（`:230-234`） |
| `--table-disabled` / `-hover` / `-border` | 3% / 4.5% / 16%（`:164-178`） | 7% / 9.5% / 24%（`:235-249`） |

三种消费方式都收口在 data-table 内部，业务页不写：

1. 固定高度页给表头注入 `tableHeaderClassName = '[background-color:var(--table-header)]'`（`layout/data-table-page.tsx:544-548`）。
2. splitHeader 模式先声明再消费：`'**:data-[slot=table-header]:[--table-header-bg:var(--table-header)]'` + `'**:data-[slot=table-header]:bg-(--table-header-bg)'`（`core/data-table-view.tsx:140-143`）。
3. 固定列表头用带回退的写法，便于嵌套表格各自覆盖：`[background-color:var(--table-header-bg,var(--table-header))]`（`core/column-pinning.ts:71`）。

静态表格另有一套常量：`components/data-table/static/static-data-table-classnames.ts:19-47`（`mutedHeaderRow` 复用同一对变量，`compactHeaderCell` 是 `text-[10px] uppercase tracking-wider` 小号表头）。

### 1.5 列固定与列宽

固定声明走 `ColumnMeta`（`tanstack-table.d.ts:21-32`）：`pinned?: 'left'|'right'`，另有 4 个移动端提示 `mobileTitle / mobileBadge / mobileHidden / mobileOrder`。

实现为 `sticky left-0|right-0` + 内侧 8px 投影 `shadow-[8px_0_10px_-10px_hsl(var(--foreground))]`，表头 `z-30`、单元格 `z-10`，且固定列自己承担 hover/selected 背景（`core/column-pinning.ts:57-78`）；显式 `pinnedColumns` 与 meta 声明会合并去重（`core/data-table-view.tsx:190-225`）。

列宽：默认 `tableLayout:auto` + `minWidth: max(100%, Σ column.getSize())`（`core/table-sizing.ts:32-36`）——不写 `size` 自适应，写了只保底不锁死；只有 `applyHeaderSize` 才把 `getSize()` 落到 `<th style>`（`core/data-table-header.tsx:252-261`）。`enableColumnResizing` 时表头右侧出 2px 分隔条：鼠标拖、方向键 ±10px（Shift ±50px）、双击/Enter 按实测内容宽自适应（`core/data-table-header.tsx:67-88, 145-180, 240-250`）。

### 1.6 虚拟滚动：没有

全仓无 `useVirtualizer`。大数量靠服务端分页（单页 ≤100）+ `splitHeader` 固定表头：表体容器 `overflow-auto`、表头 `sticky top-0`（`core/data-table-view.tsx:139-163`），页面容器 `flex h-full min-h-0 flex-col`（`layout/data-table-page.tsx:345-357`）。

---

## 2. 分页 / 密度 / 列显隐 / 排序 / 筛选

### 2.1 分页器

同一组件两形态（`core/pagination.tsx`）：

- 默认右对齐单行：`Total: N` → `Rows per page`（`@2xl/pagination` 容器查询下才显示文字）→ 每页下拉（`h-8 w-[64px]`）→ 首页/上页/页码/省略号/下页/末页（`size-8 p-0`，首末页在 `@max-lg` 隐藏）。当前页 `variant='default'`+`font-semibold`，其余 outline（`:104-212`）。
- `compact`：只留 `Total: N` + 上下页（`size-11` 触控友好）+ `当前 / 总数`（`:66-102`）。

| 项 | 值 | 出处 |
| --- | --- | --- |
| 每页候选 | `[10,20,30,40,50,100]` | `core/pagination.tsx:44` |
| hook 默认 | `{ pageIndex: 0, pageSize: 20 }` | `hooks/use-data-table.ts:293` |
| URL 默认 | `defaultPageSize = 20` | `hooks/use-table-url-state.ts:121` |
| 移动端 | `defaultPageSize: isMobile ? 10 : 20` | `features/users/components/users-table.tsx:83` |
| pageSize 记忆 | localStorage 全局键 `page-size` | `hooks/use-table-url-state.ts:30, 41-47, 165` |

分页默认**不在表格内**，而是 `PageFooterPortal` 投到页面底部固定条（`layout/data-table-page.tsx:398-409`），落点为 `SectionPageLayout` 那个 `border-t` footer（`components/layout/components/section-page-layout.tsx:118-121`）；需要时 `paginationInFooter={false}` 改回表下内联。页码全部进 URL：`?page=&pageSize=&filter=&status=...`，首页时 `page` 置 `undefined` 保持干净，筛选/搜索变化强制回第 1 页（`use-table-url-state.ts:169-181, 189-206, 231-237`）。

### 2.2 密度切换在主题层，不在表格层

没有「紧凑/舒适」局部开关，密度是全局 `data-theme-scale="sm|default|lg|xl"`，直接改写 `--text-*` 与 `--spacing`，所以行高、padding、字号一起缩放：

```css
/* styles/theme-presets.css:700-716（节选） */
/* `sm` = compact UI; `lg` = comfortable; `xl` = extra readable. */
[data-theme-scale='sm'] {
  --text-xs: 0.7rem;  --text-sm: 0.78rem;  --text-base: 0.88rem;
  --spacing: 0.225rem;
}
[data-theme-scale='lg'] { --text-sm: 0.95rem; --text-base: 1.075rem; }
```

UI 入口在配置抽屉「Density」四选一，每项带缩略行预览（`components/config-drawer.tsx:474-530`，`ScalePreview` 在 `:454-472`）。

### 2.3 列显隐 / 排序 / 筛选入口

统一在 toolbar 单行 flex-wrap：左侧输入类，右侧 `ms-auto` 动作簇，顺序固定 `preActions → Reset → Search → 视图切换 → View(列显隐) → 展开`（`toolbar/toolbar.tsx:409-430`）。

- **列显隐**：最右 `View` → DropdownMenu + CheckboxItem，仅列 `accessorFn` 存在且 `getCanHide()` 的列（`toolbar/view-options.tsx:53-85`）；列头菜单另有单列 `Hide`（`core/column-header.tsx:84-92`）。持久化靠 `columnVisibilityStorageKey`（`features/channels/components/channels-table.tsx:410-414`），初值 `initialColumnVisibility`。
- **排序**：点列头标题弹 Asc/Desc/Hide，未排序列显示 `ChevronsUpDown`（`core/column-header.tsx:56-93`）。`header` 只要是字符串或 `meta.label`，`DataTableHeader` 就自动包一层 `DataTableColumnHeader`，省掉业务样板（`core/data-table-header.tsx:263-277`）。
- **筛选**：左侧一排虚线边框 chip，本质 Popover + Command 可搜索多选，`singleSelect` 时再点即取消（`toolbar/faceted-filter.tsx:81-123, 196-213`）；已选值回显为 Badge，>2 折叠成 `N selected`（`:89-121`）。
- **提交模式**：默认即输即筛（`searchDebounceMs`，业务页普遍 500ms）；传 `onSearch` 切「表单模式」——Reset 常显 outline、Search 变主按钮带 `Loader2`（`toolbar.tsx:290-318`）。
- **次级条件**：`expandable` + Expand/Collapse 幽灵按钮，收起时若有值按钮转 `text-primary`（`toolbar.tsx:326-346`）；传 `leftActions` 时变三行布局（`:377-407`）。移动端 `collapsibleOnMobile` 把整块折叠，只留动作（`:350-375`）。

工具栏视觉原则（作者注释，`toolbar.tsx:145-158`）：「没有背景面板、没有行分隔线，靠留白和表格边框建立层次」——Ant Design Pro 的布局、去掉卡片壳。

### 2.4 批量操作条

选中即从底部浮出：`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl` + `bg-background/95 backdrop-blur-lg shadow-xl`，内容「✕ 清空 / 分隔线 / 已选 N / 分隔线 / 业务按钮」；键盘 ←→ Home End，Escape 清空但避让 dropdown 的 Escape（`toolbar/bulk-actions.tsx:90-150, 168-244`）。移动端不渲染（`layout/data-table-page.tsx:361`）。

---

## 3. 表单

### 3.1 两套原语

| 套件 | 文件 | 适用 |
| --- | --- | --- |
| 受控表单 | `components/ui/form.tsx`（286 行，react-hook-form） | 有校验/提交/多字段的主表单 |
| 排版原语 | `components/ui/field.tsx`（254 行） | 无表单库场景（设置项、只读区块） |

### 3.2 label / 间距 / 必填 / 错误 / helper

- **label 在控件上方**，垂直流。`FormItem` 就是 `grid gap-2`（`ui/form.tsx:184-198`），label→控件→描述→错误四级间距统一 8px；label 本身 `flex items-center gap-2 text-sm leading-none font-medium`（`ui/label.tsx:34-37`）。
- **必填标记**：`<FormLabel required>` 追加 `<span data-slot="required-indicator" class="text-destructive">*</span>`（`ui/label.tsx:40-49`），业务页大量使用（`features/channels/components/drawers/channel-mutate-drawer.tsx:2592, 3166, 3521`）。
- **错误文案**：`FormMessage` → `<p data-slot="form-message" class="text-destructive text-sm">`，无图标无底色（`ui/form.tsx:252-275`，且先过 `t()`）；同时 `FormLabel` 置 `data-error=true` 整字转红（`:204-214`），`FormControl` 自动挂 `aria-invalid` / `aria-describedby`（`:217-237`），Input 以 `aria-invalid:border-destructive aria-invalid:ring-3` 响应（`ui/input.tsx:30`）。
- **helper text**：`FormDescription` → `text-muted-foreground text-sm`（`ui/form.tsx:239-250`），常态与错误同位置并存。
- **提交失败聚焦**：`FormValidationFocus` 监听 `submitCount`，把首个 `[aria-invalid="true"]` 或 `[data-slot="form-message"]` 的 `FormItem` `scrollIntoView({block:'center', behavior:'smooth'})` 并聚焦（`ui/form.tsx:66-107`）。

### 3.3 控件尺寸基线

`Input` / `SelectTrigger` / `InputGroup` 统一 `h-8 rounded-lg`（`ui/input.tsx:24-35`、`ui/select.tsx:69-72`、`ui/input-group.tsx:29-41`）；`SelectTrigger size='sm'` 是 `h-7 rounded-md`；`InputGroup` 外壳负责 focus/invalid 高亮，内部 `InputGroupInput` 把边框和 ring 全部清零，适合「输入 + 后缀按钮/单位」。勾选类：`Checkbox size-4 rounded-sm` + `after:-inset-x-3 after:-inset-y-2` 扩热区（`ui/checkbox.tsx:31-33`）；`Switch` default 18.4×32 / sm 14×24（`ui/switch.tsx:35, 42`）。日期：`DatePicker` = outline Button（`w-[240px] justify-start`，空值 `data-empty` 转灰）+ Popover 内 `Calendar mode='single' captionLayout='dropdown'`，默认禁未来与 1900 前（`components/date-picker.tsx:58-88`）。

### 3.4 分组与提交区

- 分组：抽屉内用 `SideDrawerSection`（`border-b pb-6 last:border-b-0`）+ 裸 `<h3 class='text-sm font-medium'>`，可选 `SideDrawerSectionHeader`（`IconBadge` + 描述）（`components/drawer-layout.ts:48-104`）；无表单库时用 `FieldGroup`（`gap-5`）+ `FieldSet`（`gap-4`）（`ui/field.tsx:26-37, 57-68`）。
- 提交按钮区：
  - 抽屉——`SheetFooter` 粘底 `border-t`，按钮用 `form='user-form'` 跨 DOM 关联滚动区里的 `<form id='user-form'>`（`features/users/components/users-mutate-drawer.tsx:584-591`，form id 在 `:301`）。
  - 对话框——走 `Dialog` 的 `footer` prop，右对齐、取消在左（`features/channels/components/dialogs/edit-tag-dialog.tsx:231-241`）；`Dialog` 给 footer `flex-shrink-0 sm:-mx-6 sm:-mb-6 sm:p-6` 让它贴边且不随 body 滚动（`components/dialog.tsx:115-124`）。
  - 文案成对：`Cancel/Close` + `Save changes / Create`，提交中替换为 `Saving...` 并 disabled（`users-mutate-drawer.tsx:588-590`）。

---

## 4. 弹窗 / 抽屉选型

### 4.1 三种容器

| 容器 | 底座 | 默认尺寸 | 用量 |
| --- | --- | --- | --- |
| `Dialog`（`components/dialog.tsx` 包装） | Base UI Dialog | 原子层默认 `sm:max-w-sm`，包装层覆写为 `w-full sm:max-w-2xl`；body 高由 CSS 变量控制 | 89 个文件 |
| `Sheet`（`ui/sheet.tsx`） | Base UI Dialog 侧滑变体 | 左右：`w-3/4 sm:max-w-sm`；上下：`h-auto` | 23 个文件（17 处用 `sideDrawerContentClassName`） |
| `Drawer`（`ui/drawer.tsx`） | vaul | bottom 版 `max-h-[80vh] rounded-t-xl` 带拖拽把手 | 2 个文件（移动端筛选面板 `logs-filter-toolbar.tsx`、`model-group-selector.tsx`） |

`Dialog` 的封装把「头/身/脚三段固定」一次性做掉：`contentHeight` 驱动 `--dialog-content-height`，header 不滚、body `overflow-y-auto overscroll-contain`、footer 不滚（`components/dialog.tsx:71-124`），业务侧只传 `title/description/footer`。

### 4.2 侧抽屉骨架（5 个 className 工厂）

`components/drawer-layout.ts:24-58` 只导出 className、不导出组件，因此能套在 Sheet / Drawer / 自定义容器上：

```ts
// components/drawer-layout.ts:24-46（节选）
export const sideDrawerContentClassName = (className?: string) =>
  cn('bg-background text-foreground flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 shadow-none', className)
export const sideDrawerHeaderClassName = (className?: string) =>
  cn('border-border/70 bg-background/95 border-b px-4 py-3 text-start backdrop-blur sm:px-6 sm:py-4', className)
export const sideDrawerFormClassName = (className?: string) =>
  cn('flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5', className)
export const sideDrawerFooterClassName = (className?: string) =>
  cn('border-border/70 bg-background/95 grid grid-cols-2 gap-2 border-t px-4 py-3 backdrop-blur sm:flex sm:flex-row sm:justify-end sm:px-6 sm:py-4', className)
```

即：内容满高、header 粘顶毛玻璃、表单区唯一滚动、footer 移动双列 / 桌面右对齐。

### 4.3 选型判定（从真实分布反推）

- **对话框**：≤6 字段、纯确认、纯展示、批量参数编辑。长内容配 `contentClassName='max-h-[min(90dvh,var(--dialog-available-height))] max-w-2xl'` + 内部 `ScrollArea max-h-[60vh]`（`edit-tag-dialog.tsx:228, 243`）。
- **侧抽屉**：主表单（新增/编辑实体）、需分组、需要边看列表边填。宽度谱系实测：

| 宽度 | 次数 | 场景 |
| --- | --- | --- |
| `sm:max-w-md` / `lg` | 2 / 2 | 偏好设置、定价筛选 |
| `sm:max-w-[600px]` | 4 | 用户 / 兑换码 / 订阅 / 模型部署（主力） |
| `sm:max-w-2xl` | 4 | 分组倍率、模型定价、预填分组 |
| `sm:max-w-3xl` | 1 | 供应商编辑 |
| `sm:max-w-7xl` / `[1280px]` | 2 | 渠道编辑、模型编辑（超复杂配置） |

- **AlertDialog**：破坏性/不可逆操作，`ConfirmDialog` 收口 `destructive` 配色 + `isLoading` 双禁用 + 取消按钮（`components/confirm-dialog.tsx:63-87`）。
- **「读长文 + 强确认」**：仍用 AlertDialog，但自绘滚动区 + 固定确认按钮（`components/risk-acknowledgement-dialog.tsx:183-186`，`!max-w-[44rem]`、`max-h-[min(88dvh,760px)]`、`!p-0`）。

---

## 5. 反馈三态

### 5.1 Empty

```tsx
// components/ui/empty.tsx:23-34（节选，省略 rest props）
<div data-slot='empty' className={cn(
  'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4',
  'rounded-xl border-dashed p-6 text-center text-balance', className)} />
```

图标容器 `EmptyMedia variant='icon'` = `size-8 rounded-lg bg-muted`（`:46-59`），标题 `text-sm font-medium tracking-tight`（`:76-84`），描述 `text-muted-foreground text-sm/relaxed`（`:86-97`）。两级尺寸：表格内 `TableEmpty` 撑 `h-[400px]`，默认 `Database` 图标与文案 `No Data` / `No records found. Try adjusting your filters.`（`core/table-empty.tsx:61-88`）；页面级 `EmptyState` `min-h-[300px]`，可 `bordered`，外层包 `FadeIn`（`components/empty-state.tsx:43-68`）。

### 5.2 Loading

- **首次加载**（`isLoading`）→ 表格骨架：可见列 × `min(pageSize,20)` 行，行高 52px，条宽在 10 档数组里轮转，`select` 列特殊处理成 `size-4` 方块（`core/table-skeleton.tsx:25-36, 45-58`）。
- **后台刷新**（`isFetching && !isLoading`）→ 不换骨架，容器 `pointer-events-none opacity-60`，行仍在以避免闪烁（`layout/data-table-page.tsx:503, 512, 554`）。
- **整页** `LoadingState`：居中 `Loader2 animate-spin` + `Loading...`，`min-h-[200px]`，`inline` 退化为行内小图标（`components/loading-state.tsx:37-66`）。
- **内容区**：`ContentSkeleton` 用 `auto-skeleton-react` 扫真实 DOM 生成骨架，颜色取 `--skeleton-base/--skeleton-highlight`、圆角取主题圆角（`components/auto-skeleton.tsx:35-55`）；`QuerySkeleton` 把 `query.isError` 直接转 `ErrorState`，其余交给骨架（`:65-83`）。

### 5.3 Error

`ErrorState` 结构固定为 **图标（AlertTriangle，唯一红色元素）→ 中性标题 `Oops! Something went wrong` → muted 描述 → outline sm 的 Retry**（`components/error-state.tsx:44-72`）。错误详情不进 UI，走 sonner toast（业务侧 `handleServerError`）。

---

## 6. 徽标与状态语义色

`StatusBadge` 是全站唯一的「语义 → 颜色」映射点（`components/status-badge.tsx`），`variant` 决定字色，`showDot` 才画圆点：

| variant | 文字 / 圆点 | 语义 |
| --- | --- | --- |
| `success` / `green` | `text-success` / `bg-success` | 启用、正常、通过 |
| `warning` / `amber` / `orange` / `yellow` | `text-warning` / `bg-warning` | 待处理、倍率 >1 |
| `danger` / `red` | `text-destructive` / `bg-destructive` | 禁用、封禁、失败 |
| `info` / `light-blue` | `text-info` / `bg-info` | 已邀请、提示 |
| `neutral` / `grey` | `text-muted-foreground` / `bg-neutral` | 未启用、空值 |
| `purple/blue/cyan/indigo/lime/pink/teal/violet` | `text-chart-1..5` | 分类标签（非状态） |

映射表在 `:45-67`（dot）与 `:69-91`（text）；底层 token `--success/--warning/--info/--neutral/--destructive` 各带 foreground，暗色值见 `styles/theme.css:200-209`。

三种形态：`type='badge'`（默认，`rounded-4xl` 胶囊，sm/md 均 `h-5 px-1.5`，lg 才 `h-6 px-2`，`:107-117, 186-197`）、`type='text'`（只有字色）、`type='underline'`（`border-b border-current pb-px`），可由 `StatusBadgeTypeContext` 从祖先统一覆盖（`:104-105, 155-156`）——移动卡片区借此把徽标降级成纯文本。

**默认 `copyable=true`**：点击即复制 label，`cursor-copy` + `hover:brightness-95` + `active:scale-95`（`:146-147, 162-168, 194-195`）。这是该库一个隐性交互约定，不该复制时必须显式 `copyable={false}`。

派生与单元格原子：
- `statusPresets`：`active=success / inactive=neutral / invited=info / suspended=danger / pending=warning+pulse`（`:274-296`）。
- `GroupBadge`：`stringToColor(group)` 给任意组名稳定色，`auto`/空组强制降级 `neutral` 并隐藏圆点（`components/group-badge.tsx:94-115`）；`GroupMultiplierBadge` 倍率 >1 warning、<1 info（`:33-39`）。
- `StatusBadgeList`：默认只显示 2 个，其余折叠 `+N`（`:229-272`）。
- `TableId`：`font-mono tabular-nums text-muted-foreground`（`components/table-id.tsx:26-36`）——所有数字列（ID/额度/时间）等宽对齐。
- `BadgeCell`：`-ml-1.5` 让徽标与列内文字左沿视觉对齐（`core/badge-cell.tsx:25-35`）。
- 长文本三件套：`TruncatedCell`（truncate + Tooltip `max-w-xs break-all`，`core/truncated-cell.tsx:66-89`）、`LongText`（桌面 Tooltip / 移动 Popover，`components/long-text.tsx:64-93`）、`MaskedValueDisplay`（脱敏值 + Popover `<pre>` 完整值 + `CopyButton`，`components/masked-value-display.tsx:60-90`）。

---

## 7. 业务页装配样例（users）

页面壳 → 表格 → 抽屉，职责三层分离（`features/users/index.tsx:33-52`）：

```tsx
<SectionPageLayout fixedContent>
  <SectionPageLayout.Title>{t('Users')}</SectionPageLayout.Title>
  <SectionPageLayout.Actions><UsersPrimaryButtons /></SectionPageLayout.Actions>
  <SectionPageLayout.Content><UsersTable /></SectionPageLayout.Content>
</SectionPageLayout>
<UsersMutateDrawer
  open={open === 'create' || open === 'update'}
  onOpenChange={(isOpen) => !isOpen && setOpen(null)}
  currentRow={open === 'update' ? currentRow || undefined : undefined}
/>
<UsersDeleteDialog />
```

表格侧只做「列 + 网关参数 + 状态映射」，UI 全部下沉到 `DataTablePage`（`users-table.tsx:217-261`）：`isLoading/isFetching`、`emptyTitle/emptyDescription`、`skeletonKeyPrefix`、`applyHeaderSize`、`toolbarProps={searchPlaceholder, searchDebounceMs: 500, filters[]}`、`getRowClassName={(row,{isMobile})=>...}`、`bulkActions`。三个值得抄的细节：`getRowClassName` 自带 `{isMobile}` 上下文免重复判断点；筛选状态由 `useTableUrlState` 与 URL 双向绑定（`users-table.tsx:80-90`）；切换排序时页码自动归零（`:125-130`）。

---

## 8. 对 galzy 的落地建议（按收益排序）

1. **先补原子层，别急着上 TanStack Table。** galzy `apps/web-tanstack/src/components/ui/` 没有 `table.tsx`，admin 各页手写 `<table className="w-full">`（`components/admin/users-page.tsx:190` 起），表头 `bg-muted/50`、行 `hover:bg-muted/30`、`PAGE_SIZE = 15` + offset 分页。先把薄壳（`[&>tr]:h-15`、单元格继承字号、`color-mix` hover）与 6 个 `--table-*` 变量搬过来，统一 5 个 admin 列表页的视觉即可。
2. **抽 `StatusBadge` 作为语义色唯一入口。** 一张 variant→class 映射表 + 5 个语义 token + 3 种形态，一处改全局生效，还能靠 context 在移动卡片里自动降级为纯文本。
3. **抽屉骨架做成 className 常量而非组件。** galzy 已有 `sheet.tsx`/`drawer.tsx`，缺统一骨架；照 `drawer-layout.ts` 搬 5 个工厂，宽度分 600px（普通实体）/ 2xl（多分组配置）两档，提交按钮用 `form={id}` 跨 DOM 关联，省掉每页重复 footer。
4. **反馈三态收敛成三个原子。** galzy 现在是页内内联 `py-16` 空态 + `Loader2`（`users-page.tsx:183-188`）；替换成 Empty（`min-h-[300px]` / `h-[400px]`）+ ErrorState（唯一红图标 + outline Retry）+ 骨架屏，成本低、收益大。
5. **pageSize 记进全局 localStorage。** galzy 的 `PAGE_SIZE` 是页面常量（`users-page.tsx:71`），换页即丢。new-api 用单键 `page-size` 全局复用、`page/pageSize` 进 URL，并用 `ensurePageInRange` 处理「筛选后页码越界」。
6. **表单只搬视觉契约，不搬库。** galzy 用 `@tanstack/react-form`（new-api 用 react-hook-form），`form.tsx` 不能直接复制。可移植的是：`FormItem = grid gap-2` 的四级间距、`Label required` 红星、错误 `text-destructive text-sm` + `aria-invalid` 驱动控件红 ring、提交失败滚动聚焦首个错误。
