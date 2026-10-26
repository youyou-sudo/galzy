# GalZY UI/UX 统一规范（以顶栏玻璃药丸为基准）

> 目标：把 `Header.tsx` 已经确立的视觉语言（固定顶栏 → 滚动玻璃药丸、发丝描边、大圆角、克制的颜色与动效）
> 扩展成全站唯一的设计语言。所有新增/改造页面按本文件执行，不再各页自造样式。
>
> 前置：P0 令牌已落地（`styles.css`），本文件只定义「怎么用」。

---

## 1. 基准拆解：顶栏为什么好看

`components/Header.tsx` 的四个特征，是全站要复用的：

| 特征 | 顶栏实现 | 全站转译 |
| --- | --- | --- |
| 悬浮面 | 滚动后 `max-w-4xl` + `rounded-2xl` + `ring-1 ring-border/60` + 软阴影 | 卡片/面板统一 `rounded-2xl` + `ring-1 ring-border/60`，静止无重阴影 |
| 玻璃 | `bg-background/70 backdrop-blur-xl`（滚动中降为 /95 省 GPU） | 只有「浮在内容之上」的层用玻璃：顶栏、全屏菜单、后台顶栏、弹层；普通卡片不用 blur |
| 克制 | 导航默认 `text-muted-foreground`，hover 才 `bg-muted/60 text-foreground` | 链接/按钮默认次要色，hover 才提亮；主色只给选中态、图标底片、主按钮 |
| 动效 | `duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]`，只过渡布局属性 | 颜色/底色 200ms；大的位移/显隐 300–500ms；只动 transform/opacity/color |

**一句话**：大圆角 + 发丝边 + 玻璃 + 克制的灰 + 主色点缀。

---

## 2. 令牌与基础件（已统一，禁止绕开）

| 用途 | 统一写法 |
| --- | --- |
| 主色 | `primary` / `primary-foreground` / `ring`（禁止 `blue-500` 等原始调色板） |
| 语义色 | `success` `warning` `info` `destructive` `neutral` + 各自 `-foreground` |
| 卡片 | `<Card>`（`ui/card.tsx` 已改为 `rounded-2xl ring-1 ring-border/60`） |
| 表单控件 | `<Input>` `<InputGroup>` `<SelectTrigger>` 默认 h-9 / rounded-xl |
| 按钮 | `<Button variant="default|outline|ghost|secondary|destructive" size="sm|default|lg|icon">` |
| 徽标 | `<Badge variant="default|secondary|outline|destructive|ghost">` |
| 图标尺寸 | 导航/行内 `size-4`；页面/区块底片图标 `size-4`；空态/大图标 `size-6~8` |
| 焦点 | `focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` |
| 数字 | `tabular-nums`（计数、排名、分页、统计） |

### 2.1 共享原语（`components/shared/`）

必须使用，不允许再手写同款：

```tsx
// icon-tile.tsx
<IconTile icon={Tags} size="sm|md|lg" tone="primary|muted" />

// page-header.tsx —— 用户端页面统一页头
<PageHeader
  icon={Library}
  title="精选合集"
  description="编辑精选的主题合集"
  meta={<span>共 128 个合集</span>}   // 可选，跟在标题后
  actions={<Button>…</Button>}         // 可选，右侧
  align="start|center"
/>

// section-header.tsx —— 首页/列表内的区块标题行
<SectionHeader
  icon={Flame}
  title="本周热门"
  count="24"
  action={<Link className={sectionActionClass}>更多游戏 <ArrowRight/></Link>}
/>

// empty-state.tsx
<EmptyState icon={Package} title="暂无合集" description="还没有创建任何合集" action={<Button/>} surface />

// pagination.tsx
<Pagination page={page} totalPages={total} onPageChange={setPage} />
<Pagination page={page} totalPages={total} renderLink={(p) => <Link to="/x" search={{page:p}} />} />
<Pagination variant="compact" … />

// search-field.tsx —— 标签/厂商/后台等简单搜索框
<SearchField value={value} onChange={setValue} onSubmit={submit} placeholder="…" />
```

### 2.2 页面配方

**用户端页面**
```tsx
<PageBreadcrumb>…</PageBreadcrumb>              {/* 现有 shared/breadcrumb，mb-4 */}
<PageHeader icon={…} title="…" description="…" actions={…} />
<div className="flex flex-col gap-8">           {/* 区块间距固定 8 */}
  <section>…</section>
</div>
```

**列表卡片**
```tsx
<Card className="transition-colors duration-200 hover:bg-muted/40 hover:ring-border">
  …
</Card>
```
卡片本身不做 `hover:-translate-y-1`；只有「封面类」卡片允许极小位移，且 ≤ 2px。

**空态**：一律 `EmptyState`，禁止手写「text-center py-20 图标 opacity-30」。
**加载态**：保留各页既有骨架组件；骨架不新增 `animate-pulse` 常驻动画。
**分页**：一律 `Pagination`，禁止再复制 `paginationRange`。

---

## 3. 排版尺度（全站唯一）

| 层级 | 类 |
| --- | --- |
| 页面标题 h1 | `text-2xl font-semibold tracking-tight`（首页 hero 可 `text-3xl sm:text-4xl`） |
| 区块标题 h2 | `text-lg font-semibold tracking-tight` |
| 卡片标题 | `text-base font-medium` |
| 正文 | `text-sm` |
| 辅助信息 | `text-xs text-muted-foreground` |
| 行内链接 | `text-muted-foreground hover:text-foreground transition-colors` |
| 主链接 | `text-primary hover:text-primary/80` |

禁止：`font-extrabold`、`font-bold` 滥用（标题最多 semibold）、`tracking-[0.18em]` 之外的随意字距、`text-blue-500` / `text-cyan-600` 等原始色。

---

## 4. 交互与 UX 规则

1. **点击区域**：所有可点控件高度 ≥ 36px（h-9）；图标按钮 ≥ 32px（size-8），移动端主操作 36–40px。
2. **状态可读**：hover / active / focus-visible / disabled / aria-invalid 五态必须可区分；选中导航用 `bg-muted/60 text-foreground`（对标顶栏）。
3. **键盘**：搜索框支持 Enter 提交、Esc 清空；分页/菜单有可见焦点环；页面提供「跳到主内容」。
4. **移动端**：断点保持 `sm/md/lg`；列表补齐 `sm` 档；不依赖 hover 表达关键信息；横向滚动条隐藏但保留滚动。
5. **反馈**：列表刷新只用 `aria-busy` + 变暗（既有做法），不整块换骨架；空态必须给出下一步动作。
6. **文案**：动词开头、句尾不带句号；错误信息说明「发生了什么 + 怎么办」。

---

## 5. 颜色使用边界

- 主色：选中态、图标底片、主按钮、可点击强调；一块区域内主色面积 ≤ 10%。
- 语义色：只给状态徽标/图标/文字，不给整块背景；`bg-*-10 + text-*` 成对。
- 排名：1–3 名用 `primary` 或 `warning` 的单色淡底，不再 red/yellow/blue 三色拼盘。
- 例外：R18「涩！」保留粉色（品牌表达），但只限该按钮。
- 删除/危险：`destructive`，hover 用 `destructive/10` 底，不用实心红。

---

## 6. 文件职责（并行改造时不要越界）

| 范围 | 负责人 |
| --- | --- |
| `styles.css`、`components/ui/*`、`components/shared/*`、`components/Header.tsx`、`components/header/*`、`components/Footer.tsx`、`routes/__root.tsx`、`components/home/{home-hero,Count,search,hot-*,collections-section}`、`components/error.tsx`、`components/tools/*`、`components/{contact,friend-links,openapi}-page.tsx` | Lead |
| `routes/games/**`、`routes/tags/**`、`routes/producer/**`、`routes/collections/**`、`components/tags/**`、`components/producer/**`、`components/home/collection-card.tsx` | 目录组 |
| `routes/topics/**`、`routes/auth/**`、`routes/user/**`、`components/topics/**`、`components/cmments/**`、`components/auth/**`、`components/user/**` | 社区组 |
| `components/home/game/**`、`components/game/**`、`components/introduction/**`、`routes/$id/**`、`routes/introduction/**` | 详情组 |
| `components/admin/**`、`routes/admin/**` | 后台组 |

跨范围要改共享件 → 先在群里说，由 Lead 改。
---

## 7. 本次落地记录（实施结果）

### 7.1 新增共享件

| 文件 | 作用 |
| --- | --- |
| `components/shared/page-header.tsx` | 用户端/管理端统一页头（图标、标题、描述、meta、眉标、右侧操作） |
| `components/shared/section-header.tsx` | 区块标题行 + `sectionActionClass` |
| `components/shared/empty-state.tsx` | 全站空态（surface / sm 两种尺寸） |
| `components/shared/pagination.tsx` | 全站唯一分页（回调式 / renderLink，mobile 收起数字页码） |
| `components/shared/search-field.tsx` | 简单搜索框（Enter 提交、Esc 清空、清除按钮） |
| `components/shared/icon-tile.tsx` | 图标底片（primary/muted/语义色） |
| `components/admin/admin-table.tsx` | 后台表格基元（TableCard/Toolbar/Table/THead/Tr/Td/Empty/Skeleton/Pagination/StatusPill） |
| `components/auth/brand-mark.tsx` | 登录/注册/验证页品牌标识 |

### 7.2 基础件与外壳

- `ui/card`：`rounded-2xl` + `ring-1 ring-border/60`，取消重阴影。
- `ui/button`：默认 h-9、sm h-8，焦点环统一 2px。
- `ui/input / input-group / select / textarea`：h-9（select sm 为 h-8）、`rounded-xl`、`bg-background/60`。
- `ui/breadcrumb`：text-xs，字号让位给页面标题。
- 弹层（dropdown/popover/select/navigation-menu）：`rounded-xl` + `ring-border/60` + 柔和阴影。
- `Footer`：与正文同容器、品牌 + 链接 + 版权，发丝分隔线。
- `__root`：跳过导航链接、`main#main-content`、广告位居中、`main` 撑满视口把页脚压底。
- `Header`：保留滚动玻璃药丸；右侧三个入口统一 32px；R18 用 success/pink 语义；品牌图标补发丝边。
- `error.tsx`：移除远程 404 图片依赖，改为统一空态 + 错误码 + 主次操作 + 可折叠详情。

### 7.3 页面覆盖

- 首页：品牌 hero、计数条、搜索宽度、热门标签/热游/合集区块、卡片标题与排名徽标。
- 目录：games / tags / tag 分类 / producer / collections 列表与详情。
- 社区：topics 列表/详情/发帖/编辑、comments、user、auth（登录/注册/验证）。
- 详情：游戏详情外壳、头部、页签、下载、关系、统计、攻略列表/详情/编辑。
- 后台：仪表盘、6 个表格页、meilisearch、vndb-sync、任务队列。
- 杂项：tools / plate / contact / friend-links / openapi。

### 7.4 刻意保留

- View Transition 共享元素、虚拟滚动、图片预取/解码门控、R18 遮挡、SSR 首屏策略：一行不改。
- 顶栏滚动收缩为 `max-w-4xl` 的「玻璃药丸」行为：作为全站视觉签名保留。
- 后台 6 页未迁移到 `@tanstack/react-table`：本次只统一样式与分页，数据表系统留待后续。
- `tag-hierarchy.tsx` 关系图未改：交互密集、体量大，单列后续任务。

### 7.5 验收

```bash
bun --cwd apps/web-tanstack lint      # 0 warnings / 0 errors
bunx tsc --noEmit -p apps/web-tanstack/tsconfig.json
bun --cwd apps/web-tanstack test      # 19 files / 114 tests
bun --cwd apps/web-tanstack build     # ✓
bun run lint                          # 全仓通过（仅 biome schema 版本提示）
```

> 说明：本次没有可用的 API/数据库环境，未进行浏览器逐页视觉回归；所有页面结构均通过 SSR 单测、类型检查与生产构建验证。真机/浏览器复核建议执行 `bun run dev` 后过一遍首页、/games、/topics、/$id、/admin。

