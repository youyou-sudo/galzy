# galzy 前端现状审计（UX / UI）

> 审计对象：`apps/web-tanstack`（TanStack Start + React 19 + shadcn/ui base-nova + Tailwind v4）
> 对照实现：`new-api/web`（同栈）
> 全部结论附 `文件:行号`，行号对应当前工作区。**只读审计，未改动任何源码。**

---

## 1. 页面骨架与导航

### 1.1 双壳：用户端 Header+Footer / 后台独立 Shell

```tsx
// apps/web-tanstack/src/routes/__root.tsx:173-233（节选）
function AppChrome({ children }) {
  const matches = useMatches()
  const isAdmin = matches.some((m) => m.routeId.startsWith('/admin/'))
  if (isAdmin) return <>{children}</>          // 后台：交给 AdminShell
  return (
    <>
      <DeferredBackground />
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 pt-14 sm:px-6">
        <aside id="sidebar-ad" className="flex flex-col mx-auto lg:px-24 max-w-7xl px-4 py-0 opacity-70 relative mb-2">…</aside>
        {children}
      </main>
      <Footer />
    </>
  )
}
```

骨架层面的四个问题：

| 问题 | 证据 | 影响 |
|---|---|---|
| 两套栅格宽度 | 用户端 `max-w-7xl`（`__root.tsx:188`）vs 后台 `max-w-6xl`（`admin-shell.tsx:254`） | 从站点进后台，正文左右边界跳 64px |
| 广告位命名为 sidebar 却渲染在正文上方 | `__root.tsx:190-227`，`id="sidebar-ad"` | 全站**没有任何侧栏**；`lg:px-24` 让广告图比正文窄且不居中 |
| 顶栏滚动收缩 78% | `Header.tsx:101`：`max-w-7xl → max-w-4xl` | 宽屏下列表页顶栏与内容左右边界错位，界面「呼吸感」抖动 |
| 无常驻分类导航 | 顶栏仅 6 个入口（`nav-config.ts:148-155`） | 分类浏览只能跳到 `/tags/category/$categoryKey` 页面，站内没有可长期停留的导航骨架 |

顶栏本身已借鉴过 new-api（`Header.tsx:26` 注释「布局参考 new-api 的 PublicHeader」），滚动静止后切成玻璃药丸（`Header.tsx:108-116`），这块完成度不错。

### 1.2 导航结构

- **桌面**：6 项，其中「主页」「工具」为下拉面板，面板宽度写死 `w-[300px]` / `w-[280px]`（`nav-config.ts:131-134`，渲染见 `desktop-nav.tsx:119-135`）。
- **移动**：手写全屏覆盖层，**刻意不用 Sheet/Dialog**（`mobile-menu.tsx:99-108` 有完整原因说明），8 条主条目 + 工具分组，条目错峰入场。
- **后台**：三组 9 项，单一配置源 `admin-nav.ts:27-98`，侧栏、仪表盘快捷入口、系统状态都由它派生——这是仓库里做得最好的一处结构化设计。
- **缺失**：面包屑每页手写（`$id/_layout.tsx:127`、`topics/index.tsx:65`、`tags/index.tsx:42`、`collections/index.tsx:99` 等 7 处），没有从路由树派生；全站 0 处命令面板（无 `cmdk` 依赖）。

### 1.3 各版式问题

**首页**（`index.tsx:77-93`）

```tsx
<HomeHero />                                  {/* h1 text-4xl 居中纯文字，无插画无数据 */}
<CountComponent />
<div className="px-5 sm:px-20 lg:px-80 my-4"><SearchInput /></div>   {/* 左右内边距三档跳变 */}
<HotTagsSection tags={rankings.tag} />
<HotGamesSection games={rankings.game} />     {/* grid-cols-3 sm:4 md:6 */}
<CollectionsSection />
```

- 首屏唯一视觉锚点是一个 `text-4xl` 的纯文字标题（`home-hero.tsx:13`）+ 一个 outline Badge，**没有大幅视觉元素，也没有任何数据背书**（收录数在下一个区块才出现）。
- 搜索框用 `lg:px-80`（两侧各 320px）压到约 640px，而 `/games` 页用 `max-w-lg`（`games/index.tsx:685`），首页与列表页搜索框宽度不一致。
- 区块间距散装：section `mb-8`（`hot-games-section.tsx:78`）、搜索 `my-4`、列表页页头 `mb-6`（`games/index.tsx:678`）。
- 热门榜靠数字角标表达排名（`hot-games-section.tsx:100-102`），信息密度低且与卡片内容重复。

**列表页**（`games/index.tsx`）

- 虚拟滚动 + 无限加载（`736-748`），`pageSize: 24`（`215`）——性能取向正确，但没有页码/总数/结果计数。
- 栅格只有两档：`grid-cols-3 md:grid-cols-6`（`742`），**缺 sm 档**，640–767px 仍挤 3 列；对比首页热门区是 3 档（`hot-games-section.tsx:80`）。
- 筛选条只有两个 Select（排序字段 + 方向，`692-733`）。`startDate/endDate` 在 search schema 里（`161-162`），但**唯一的入口是首页搜索框 Popover 里的原生 `<input type="date">`**（`Search.tsx:286-301`），列表页自身看不到时间范围；已存在 `ui/calendar.tsx` 却被 `@source not` 排除（`styles.css:15`）。
- 没有「已选条件 chip」「重置」「结果计数」。

**详情页**

- 路由壳：面包屑 + `GameLayoutPage`（`$id/_layout.tsx:126-170`）；正文三明治结构 `Card[Header+Info] → Tabs → Card[Outlet]`（`game-layout-page.tsx:41-56`）。
- 5 个页签本质是子路由伪装成 tab（`GameTabs.tsx:33-112`，`TabsTrigger render={<Link …>}`），键盘/中键行为依赖 Link 是对的，但视觉上 tab 与路由状态强耦合，无法做「同一页内的局部切换」。
- 单列到底，没有右侧信息栏；且外层 `Card className="border-0"`（`game-layout-page.tsx:42`）与同页第二张 Card 的默认边框不一致。

---

## 2. 设计令牌现状

### 2.1 现有变量（`styles.css` 全 422 行，令牌区 28-139）

| 维度 | 实际取值 | 位置 |
|---|---|---|
| 主色 | `--primary: oklch(0.205 0 0)`（暗色 `0.922 0 0`） | `styles.css:35` / `:70` |
| 语义色 | **只有 destructive** `oklch(0.577 0.245 27.325)` | `styles.css:43` / `:78` |
| 图表 | `chart-1..5` = 251°/259°/262°/264°/265° 蓝紫 | `styles.css:47-51` / `:82-86` |
| 侧栏 | `sidebar` + foreground/primary/accent/border/ring 共 8 个 | `styles.css:53-60` / `:87-94` |
| 圆角 | `--radius: 0.625rem`(10px)，派生 sm…4xl = 0.6/0.8/1/1.4/1.8/2.2/2.6 倍 | `styles.css:52`、`:130-136` |
| 字体 | `--font-sans: 'Geist Variable', sans-serif`；`--font-heading` 是 `--font-sans` 的别名 | `styles.css:98`、`:137` |
| 缓动 | `--ease-out-quart: cubic-bezier(0.22, 1, 0.36, 1)` | `styles.css:138` |

三个硬事实：

1. **全站没有品牌色。** `--primary` 的 chroma = 0，是纯灰。`chart-1..5` 却保留了默认蓝紫，二者不在同一色彩体系里——一旦出现图表就是「灰色界面里飘着一条蓝线」。
2. **`--sidebar` 这一组令牌是半个死数据。** `ui/sidebar.tsx` 不存在，`animate-ui/components/radix/sidebar.tsx` 被 `@source not` 排除（`styles.css:22`），实际只有手写的 `admin-shell.tsx` 在消费它们。
3. **字体只 preload 了 latin 子集**（`__root.tsx:2` 的 `geist-latin-wght-normal.woff2`，`:84-89` 的 preload），中文全部落到泛型 `sans-serif`。Windows/Android 的默认中文 sans 各不相同，行高与字重观感在平台间漂移，且没有 `font-feature-settings` / `tabular-nums` 全局规则（只有个别页面手写 `tabular-nums`，如 `admin/_authL/index.tsx:124`）。

### 2.2 缺失的语义令牌（逐项）

| 缺失令牌 | 现在的替代做法 | 证据 |
|---|---|---|
| `success` / `warning` / `info` | 硬编码 Tailwind 调色板，**104 处 / 31 个文件** | `users-page.tsx:263` `text-green-600 border-green-600/30`；`tasks-page.tsx:100-141` `bg-blue-500 / text-green-600 / text-red-600 / text-amber-600` |
| `destructive-foreground` | 无（destructive 一律半透明底） | `badge.tsx:16` `bg-destructive/10 text-destructive` |
| `table-row` / `table-header` / `table-header-hover` / `table-disabled` | 每页手写 `bg-muted/50`、`hover:bg-muted/30` | `users-page.tsx:192、214`（其余 5 个后台页同样写法） |
| `skeleton-base` / `skeleton-highlight` | 用默认 `bg-muted` + `animate-pulse` | `skeleton.tsx` + `games/index.tsx:754-765` |
| CJK 字体栈 | 泛型 `sans-serif` | `styles.css:98` |
| 头部高度 `app-header-height` | `pt-14`（`__root.tsx:188`）与 `scroll-padding-top: 4.5rem`（`styles.css:381`）**两个值** | 名字对不上，锚点滚动让位 72px 而顶栏只有 56px |
| spacing / typography 比例令牌 | 散装 `text-2xl` / `text-4xl` / `text-[11px]` / `tracking-[0.18em]` | `admin-page-header.tsx:23-27`、`home-hero.tsx:13` |

对照 new-api `web/src/styles/theme.css`：`:60-67` 有 `--color-success/warning/info/neutral` 及其 foreground，`:122-129` 是 light 取值、`:202-209` 是 dark 取值；`:151-178` 是 `--table-row/table-header/table-header-hover/table-disabled/table-disabled-border`，全部用 `color-mix(in oklch, …)` 从 foreground 派生；`--radius: 1rem`（`:98`，是 galzy 的 1.6 倍）；`:30-36` 是手写的 CJK serif 栈（Noto/Source Han/Songti/PingFang/SimSun 逐级兜底）。

---

## 3. 组件存量与缺口

### 3.1 存量

- `components/ui/`：**35 个**（accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, chart, dialog, drawer, dropdown-menu, field, input, input-group, input-otp, item, label, navigation-menu, popover, progress, scroll-area, select, separator, sheet, skeleton, sonner, spinner, tabs, textarea, toggle, toggle-group, tooltip）。
- 其中 **11 个文件被 `@source not` 排除出 Tailwind 扫描**（`styles.css:14-24`）：`ui/accordion`、`ui/calendar`、`ui/sonner`，以及 animate-ui 的 accordion / collapsible / dialog / dropdown-menu / progress / sidebar / switch / trash-2。也就是说**有文件但样式不会生成**。实测在这 11 个文件里，`ui/sonner`、`ui/accordion`、`ui/calendar` 在整个 `src` 下**没有任何 import**（grep `ui/sonner|ui/accordion|ui/calendar` 只命中 `styles.css` 自身），`ui/sonner.tsx` 是彻底死代码（`__root.tsx:15` 直接从 `sonner` 包导 `Toaster`）。
- `components/animate-ui/`：11 个 radix 包装 + 动效原语，除 `icons/copy`、`text/sliding-number` 外基本未启用。
- 业务组件层是真正的资产：`home/game/` 8 个、`tags/` 8 个、`admin/`（含 meilisearch 子目录）17 个，加上 `shared/route-skeletons`、`game/game-detail-pending`、`tags/tag-detail-pending` 的骨架体系相当完整。

### 3.2 缺口：new-api 有而 galzy 没有（60 − 35 = **25 个**）

```
button-group  carousel  checkbox  collapsible  combobox  combobox-input
command       context-menu  direction  empty  form  hover-card  icon-badge
kbd           markdown  menubar  native-select  pagination  radio-group
resizable     sidebar  slider  switch  table  titled-card
```

其中真正卡住改造的是这五个：

| 缺件 | 直接后果 | new-api 实现体量 |
|---|---|---|
| `table` | 6 个后台页手写 `<table className="w-full">` | `web/src/components/ui/table.tsx` 148 行（Table/Header/Body/Footer/Row/Head/Cell/Caption） |
| `pagination` | 9 处各自手写，两套实现（见 §4） | `ui/pagination.tsx` 160 行（含 Ellipsis/Previous/Next/Link） |
| `empty` | 空态文案散落 **24 个文件 / 27 处**，只有 1 个 `EmptyState` 且仅 meilisearch 内部复用 | `ui/empty.tsx` 119 行（Empty/Header/Media/Title/Description/Content） |
| `sidebar` | 后台侧栏是手写 `aside`（`admin-shell.tsx:243-249`），无折叠/无快捷键/无 cookie 记忆 | `ui/sidebar.tsx` **741 行**（`SIDEBAR_COOKIE_NAME`、`SIDEBAR_WIDTH 13rem`、`SidebarProvider/Trigger/Rail`） |
| 数据表格系统 | 完全没有对应物 | `web/src/components/data-table/` **26 个文件**（core / layout / static / toolbar 四层） |

数据表格系统的分层值得单独记一笔，因为它是「总表页」这一形态的完整答案：

```
data-table/
├── core/      data-table-view, column-header, pagination, row-action-menu,
│              table-empty, table-skeleton, truncated-cell, badge-cell
├── layout/    data-table-page(562行), card-grid, mobile-card-list, card-row-content
├── static/    static-data-table, static-row-actions
└── toolbar/   toolbar, faceted-filter, bulk-actions, mobile-filter-panel, view-mode-toggle
```

`DataTablePage` 一个组件就封装了「工具条 → 桌面表格 / 移动卡片列表 → 分页 + 加载骨架 + 空态 + 批量操作条」：
`data-table-page.tsx:343-365` 是布局主干，`:412-491` 在 `max-width: 640px` 时整体换成 `MobileCardList` 或 `DataTableCardGrid`，`:391-410` 把分页 portal 到页面 footer，`:506-530` 支持表格/卡片视图切换。

### 3.3 表单与交互基础件的错配

- `@tanstack/react-form` **已装**（`apps/web-tanstack/package.json`），仅 6 处使用：`auth/login.tsx:96`、`auth/signup/index.tsx:81`、`topics/topic-form.tsx:56`、`introduction/article-form.tsx:84`、`user/ProfileMenu/SecurityTab.tsx:35`、`cmments/reply-edit-input.tsx:111`。**后台 CRUD 页面 0 处使用**，全部裸 `useState`。
- **没有 `@tanstack/react-table`**（依赖清单里不存在），所以即使补 `ui/table` 也只是样式壳。
- **没有 `cmdk`**，无命令面板。
- `react-day-picker` 在依赖里，`ui/calendar.tsx` 存在但被 `@source not` 排除，结果是日期选择一律退回原生 `<input type="date">`。

---

## 4. 后台管理页的问题

后台是「仿照 new-api 改造」收益最大的区域。现状：

### 4.1 手写表格 × 6

| 页面 | 行数 | `<table` 位置 |
|---|---|---|
| 用户管理 | 860 | `users-page.tsx:190` |
| 合集管理 | 1004 | `collections-page.tsx:196` |
| 评论管理 | 698 | `comments-page.tsx:266` |
| 文章管理 | 634 | `articles-page.tsx:241` |
| 话题管理 | 485 | `topics-page.tsx:173` |
| 任务队列 | 923 | `tasks-page.tsx:763` |

6 个文件合计 **4,604 行**，全部重复同一种结构：`Card > 搜索条 > 手写 table > 手写空态 > 手写分页`。表头 className 在每个 `<th>` 上逐字重复：

```tsx
// users-page.tsx:191-209 —— 5 个 <th> 完全同款 class
<tr className="border-b bg-muted/50">
  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">用户</th>
  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">邮箱</th>
  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">角色</th>
  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">状态</th>
  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">操作</th>
</tr>
```

没有列定义、没有列宽、没有排序、没有列显隐、没有行选择（全后台只有 `collections-page.tsx:382` 一个 `type="checkbox"`），也没有 pinned column。

### 4.2 分页：9 处、两套实现

```
数字页码：collections/index.tsx:144-197   producers-page.tsx:185-217
纯上下页：topics/index.tsx:103-129        user/index.tsx:239-258, 303-322
          users-page.tsx:289-315          comments-page.tsx:416-424
          topics-page.tsx:274-282         tasks-page.tsx:898-906
          articles-page.tsx:363-371       collections-page.tsx:292-300
```

`paginationRange()` 被**复制粘贴了两份**（`collections/index.tsx:203-209` 与 `producer/producers-page.tsx:227`），其余 7 处只给「上一页/下一页」，没有总数、没有跳页、没有每页条数切换。后台 `PAGE_SIZE` 也写死在各自文件里（`users-page.tsx:71` = 15）。

### 4.3 筛选：状态在 `useState`，不在 URL

```tsx
// users-page.tsx:93-95
const [searchInput, setSearchInput] = useState("")
const [search, setSearch] = useState("")
const [offset, setOffset] = useState(0)
```

公开页全部用 `validateSearch` + `search params`（`games/index.tsx:184`、`tags/index.tsx:57`、`topics/index.tsx:38`），**后台反其道而行**：`articles-page.tsx:85-86` 的 `statusFilter/typeFilter` 也是 `useState`。后果是刷新、返回、分享链接都会丢筛选态。搜索维度也写死（`users-page.tsx:108-109`：`searchField: 'email'`，无法按用户名搜）。

### 4.4 编辑弹窗：每个动作一个 Dialog 组件

`users-page.tsx` 里 5 个独立组件，每个都自带 `open/提交中/表单字段` 三组 `useState`：`CreateUserDialog`(`:322`)、`SetRoleDialog`(`:441`)、`SetPasswordDialog`(`:523`)、`BanUserDialog`(`:615`)、`RemoveUserDialog`(`:753`)。共 **538 行**只为一个列表页的 5 个动作。

```tsx
// users-page.tsx:322-361（CreateUserDialog 的提交段，校验只有 if + toast）
const handleCreate = async () => {
  if (!email || !password) { toast.error("邮箱和密码为必填项"); return }
  setSubmitting(true)
  try {
    const res = await authClient.admin.createUser({ email, password, name: name || "", role })
    if (res.error) { toast.error(res.error.message || "创建用户失败"); return }
    toast.success("用户创建成功"); setOpen(false); setName(""); setEmail(""); setPassword(""); setRole("user")
  } catch { toast.error("创建用户出错") } finally { setSubmitting(false) }
}
```

问题是系统性的：没有字段级错误提示（只有 toast）、没有 loading 骨架（`Loader2Icon` 转圈，`:179-182`）、没有 dirty 确认、没有统一 `ConfirmDialog`（删除确认要用户手输邮箱，`:764-768`）。

### 4.5 语义/交互硬伤

- 封禁时长让用户直接输入**秒数**，附带提示「常用：86400 = 1天 · 604800 = 7天」（`users-page.tsx:681-691`）。
- 状态色硬编码：正常 = `text-green-600 border-green-600/30`（`:263`），没有 success 令牌。
- 任务队列一页里堆了 15 处硬编码色（`tasks-page.tsx:100-141`），状态语义完全靠调色板表达。
- 移动端靠 `overflow-x-auto` 横滚（`users-page.tsx:189`），5–6 列表格在 375px 下不可用。

---

## 5. 响应式与移动端现状

**做得好的部分**（不要动）：

- `dvh` 双写兜底 + `@supports` 覆盖，避开 lightningcss 去重（`styles.css:153-165`）。
- `@media (pointer: coarse)` 下降级 View Transition、`prefers-reduced-motion` 全量关闭动画（`styles.css:309-340`）。
- 移动端顶栏全屏菜单自己管焦点归还与 Tab 循环（`mobile-menu.tsx:130-165`），比直接用 Sheet 更正确。
- 每个列表页都配了专用 skeleton（`shared/route-skeletons.tsx`、`game-detail-pending.tsx`、`tags/tag-detail-pending.tsx`）。

**不够的部分**：

- 断点前缀分布不均（采样 154 处匹配中的近似计数）：`sm:` 118、`lg:` 51、`md:` 48、`xl:` 4。`xl` 几乎不用，说明布局没设计「超宽屏」形态。
- `games/index.tsx:742` 缺 sm 档（3 → 6 列直接跳档），`collections/index.tsx:126` 却是 6 档（2→3→4→5→6），同类列表页的响应式策略不统一。
- 后台表格在小屏只能横滚，没有卡片降级（new-api 的 `MobileCardList` 正是解这个）。
- 广告位 `lg:px-24`（`__root.tsx:192`）在 <lg 时归零，于是移动端广告图铺满、桌面端反而更窄。

---

## 6. 差距清单

| 维度 | galzy 现状 | new-api 做法 | 改造难度 |
|---|---|---|---|
| 品牌色 / 语义色 | `--primary` chroma=0 纯灰；无 success/warning/info；104 处硬编码调色板 | `theme.css:60-67` 定义 success/warning/info/neutral + foreground，body 用 `color-mix` 派生 | **低** |
| 圆角 / 密度 | `--radius: 0.625rem`；表头/行高靠 `px-4 py-3` 手写 | `--radius: 1rem`；`--table-*` 令牌统一行/表头/禁用态底色 | **低** |
| 字体栈 | 只有 Geist latin，中文落泛型 `sans-serif` | `theme.css:30-36` 手写 CJK serif/sans 逐级兜底 | **低** |
| 页面骨架 | 无侧栏；顶栏 fixed 契约 78% 收缩；广告位混进正文流 | `layout/components/` 24 个文件区分 public-layout / authenticated-layout / app-sidebar / main / page-footer | **中** |
| 列表页范式 | 每页自拼 breadcrumb + h1 + 栅格 + 无计数 + 无重置 | `DataTablePage` 一个组件承包工具条/表格/移动卡片/分页/空态/批量操作 | **高** |
| 表格 | 6 页手写 `<table>`，合计 4,604 行 | `ui/table.tsx` + `data-table/core`（colgroup/header/row/view/pinned） | **高** |
| 分页 | 9 处手写，2 套实现，`paginationRange` 复制 2 份 | `ui/pagination.tsx` + `core/pagination.tsx`，默认 portal 到页脚 | **中** |
| 筛选 | 后台 `useState` 不入 URL；每页自己的 Select 堆 | `toolbar/faceted-filter.tsx` + `mobile-filter-panel.tsx` | **中** |
| 空态 | 24 个文件 / 27 处手写文案，仅 `meilisearch/shared.tsx:83` 一个可复用组件（且未跨模块） | `ui/empty.tsx`（6 个子组件）+ `core/table-empty.tsx` | **低** |
| 加载态 | `Loader2` 转圈为主；列表页有 skeleton | `core/table-skeleton.tsx`，翻页时 `isFetching` 只降透明度不换骨架 | **低** |
| 表单 | `@tanstack/react-form` 已装但后台 0 使用，裸 `useState` + toast 校验 | `ui/form.tsx` + 字段级错误 | **中** |
| 弹窗 | 每动作一个 Dialog 组件，5 个动作 538 行 | `dialog-layout` 统一布局 + `alert-dialog` 确认 | **中** |
| 侧栏 | 手写 `aside w-64`，无折叠/无 cookie/无快捷键 | `ui/sidebar.tsx` 741 行（Provider/Rail/Trigger/⌘B/13rem） | **中** |
| 卡片/统计 | 后台 StatCard 是页面内私有组件（`admin/_authL/index.tsx:90`） | `ui/titled-card`、`ui/icon-badge`、`features/dashboard/.../stat-card` | **低** |
| 视图切换 | 无 | `toolbar/view-mode-toggle` + localStorage 记忆（`data-table-page.tsx:255-280`） | **中** |
| 命令面板 | 无 `cmdk` 依赖，0 处实现（`animate-ui/.../sidebar.tsx:106` 有 ⌘B 逻辑但该文件被排除） | `ui/command.tsx` | **中** |
| 移动端表格 | 横滚 | `layout/mobile-card-list.tsx` 自动降级 | **中** |
| 动效体系 | View Transition + 手写关键帧，质量高 | 以 Radix/Base 过渡为主 | **保持**（galzy 更强） |

---

## 7. 对「仿照 new-api 改造 galzy 前端」的三条判断

1. **先补令牌，再补组件，最后才碰布局。** 令牌是最便宜的一刀：`styles.css:28-95` 加 `--success/--warning/--info(+foreground)`、`--table-*`、`--skeleton-*`、CJK 字体栈、`--app-header-height`，就能把 104 处硬编码色逐步收敛（`users-page.tsx:263`、`tasks-page.tsx:100-141` 是最脏的两处）。若先动骨架，所有硬编码色会跟着搬迁成本翻倍。注意 `--radius` 从 0.625rem 调到 1rem 是全局视觉变化，需要单独一次 commit 便于回滚。

2. **后台是 ROI 最高的切入点，而且不需要动用户端一行。** 后台已是独立壳（`__root.tsx:177-179`、`_authL.tsx:24-30`），改坏不影响线上站点。把 6 个手写表格页（4,604 行）迁到 `DataTablePage` 形态、把 9 处分页收敛成 1 个 `ui/pagination`、把 `useState` 筛选迁到 search params，能一次性砍掉大部分重复代码，并顺带获得移动端卡片降级与批量操作。建议顺序：`ui/table + ui/pagination + ui/empty` → 迁移 1 个最简单页（`topics-page`，485 行）验证 → 再铺开。

3. **用户端不要照搬 new-api 的信息架构，只借「骨架能力」。** new-api 是控制台式（侧栏常驻 + 高密度表格），galzy 是消费型内容站（海报栅格 + 沉浸详情页），把侧栏硬套到用户端会挤掉本已偏窄的 6 列海报栅格（`games/index.tsx:742`）。真正该借的是：`layout/` 里 `public-header / page-footer / section-page-layout` 那层「可组合骨架」、`ui/empty` 与 `ui/table` 这类中性件，以及首页首屏的「数据背书 + 视觉锚点」做法——现状 `home-hero.tsx:13` 只有一个纯文字 h1，是全站最明显的设计空白。
