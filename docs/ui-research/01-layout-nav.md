# new-api 布局外壳与导航系统调研

> 调研对象：`D:/Users/xiaoy/Documents/Github/new-api/web/src`（只读快照）。行号均指该快照实际行号。
> 技术栈：TanStack Router `^1.170`（文件路由）+ @base-ui/react `^1.6`（非 Radix）+ Tailwind CSS v4 + motion `^12` + react-i18next `^17` + cmdk + react-top-loading-bar。
> **重要前置结论：主题不是 next-themes 实现的。** `web/package.json:62` 确实声明了 `next-themes ^0.4.6`，但 `src` 内 0 引用，主题走自研 `ThemeProvider`（见 §3）。

## 0. 文件地图

| 路径（相对 `web/src`） | 行数 | 职责 |
| --- | --- | --- |
| `components/layout/components/authenticated-layout.tsx` | 62 | 登录后台外壳唯一入口，组装 Provider |
| `components/layout/components/app-header.tsx` | 154 | 顶栏内容编排（品牌/导航/搜索/通知/语言/主题/头像） |
| `components/layout/components/header.tsx` | 39 | 顶栏 DOM + 高度变量 + SidebarTrigger |
| `components/layout/components/app-sidebar.tsx` | 77 | 侧栏容器 + 视图切换动画 |
| `components/layout/components/nav-group.tsx` | 267 | 分组/链接/折叠/折叠态下拉三种渲染 |
| `components/layout/components/section-page-layout.tsx` | 130 | 业务页统一头/内容/页脚插槽 |
| `components/ui/sidebar.tsx` | 741 | 尺寸常量、Provider、三 variant、折叠 |
| `hooks/use-sidebar-view.ts` / `hooks/use-sidebar-data.ts` | 82 / 183 | 侧栏视图解析 / 根导航数据 |
| `hooks/use-sidebar-config.ts` | 335 | 后台×用户两层层过滤 |
| `components/layout/lib/sidebar-view-registry.ts` | 41 | drill-in 视图注册表 |
| `context/theme-provider.tsx` / `lib/theme-storage.ts` | 144 / 57 | 三态主题 / 存储键约定 |
| `context/theme-customization-provider.tsx` | 245 | 外观轴（preset/font/radius/scale/contentLayout） |
| `components/command-menu.tsx` / `context/search-provider.tsx` | 122 / 62 | ⌘K 面板 / 开合状态 |

## 1. 外壳 DOM 结构与栅格

### 1.1 三层结构（不是默认的「一行两列」）

```tsx
// components/layout/components/authenticated-layout.tsx:41-56（节选）
<SidebarProvider defaultOpen={defaultOpen} className='flex-col'>
  <SkipToMain />
  <AppHeader />
  <div className='flex min-h-0 w-full flex-1'>
    <AppSidebar />
    <SidebarInset
      className={cn(
        '@container/content',
        'h-[calc(100svh-var(--app-header-height,0px))]',
        'min-h-0 overflow-hidden',
        'peer-data-[variant=inset]:h-[calc(100svh-var(--app-header-height,0px)-(var(--spacing)*4))]'
      )}
    >
      {props.children ?? <AnimatedOutlet />}
    </SidebarInset>
  </div>
</SidebarProvider>
```

关键点：`SidebarProvider` 被 `className='flex-col'` 改成纵向（`:41`），顶栏是第一行，第二行才是 `[AppSidebar][SidebarInset]`。所以顶栏横跨全宽、侧栏从顶栏下方开始——这是与 shadcn 官方 demo 最大的结构差异，也是 `--app-header-height` 必须存在的根因。

### 1.2 尺寸真值表

| 项 | 值 | 出处 |
| --- | --- | --- |
| `--app-header-height` | `3rem`（48px） | `styles/theme.css:99`；消费方 `header.tsx:28` |
| `--sidebar-width` | `13rem`（208px） | `components/ui/sidebar.tsx:50` |
| `--sidebar-width-icon`（折叠态） | `2.75rem`（44px） | `sidebar.tsx:52` |
| 移动端抽屉宽度 | `17rem` | `sidebar.tsx:51, 213` |
| `SidebarTrigger` | `size-8`（32px） | `header.tsx:34` |
| 顶栏内边距 | `px-2 sm:px-3`，gap `1.5/2` | `header.tsx:33` |
| sidebar 状态 cookie | `sidebar_state`，7 天 | `sidebar.tsx:48-49, 106` |
| 折叠快捷键 | `⌘/Ctrl + B` | `sidebar.tsx:53, 116-130` |

### 1.3 定位与折叠机制

桌面侧栏**不在文档流**：外层 `div.group.peer` 里放两个兄弟节点——`sidebar-gap`（占位，负责宽度过渡）与 `sidebar-container`（`fixed` 定位）。

```tsx
// components/ui/sidebar.tsx:238-259（节选，两个兄弟节点）
// ① sidebar-gap：在流内占位，只负责宽度过渡
'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear'
// ② sidebar-container：脱离文档流
'fixed top-[var(--app-header-height,0px)] bottom-0 z-10 hidden h-[calc(100svh-var(--app-header-height,0px))] w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex'
// variant=inset|floating 时：p-2 + 折叠宽度 = icon + spacing*4 (+2px)
```

- **三 variant**：`inset`（项目默认，见 `context/layout-provider.tsx:32`）/`floating`/`sidebar`。inset 时 `SidebarInset` 加 `m-2 rounded-xl shadow-sm`（`sidebar.tsx:330`），并且 `body` 被 `styles/index.css:113` 的 `has-[div[data-variant='inset']]:bg-sidebar` 染成侧栏底色——所以视觉上是「一张圆角卡片浮在侧栏底板上」。
- **`collapsible` 三取值**：`icon`（项目默认，`layout-provider.tsx:33`）、`offcanvas`、`none`。`icon` 折叠后多级菜单降级为右侧弹出 `DropdownMenu`（`nav-group.tsx:215-267`），宽度收到 `--sidebar-width-icon`。
- **高度 calc 有两处必须同步**：`authenticated-layout.tsx:49` 与 `sidebar.tsx:253`。改 `--app-header-height` 只改一处会错位，但两处都用 `var(--app-header-height,0px)` 兜底，所以漏定义不会彻底崩。
- 折叠动画**只有 CSS 宽度过渡 200ms**，没走 motion；motion 只用在内容切换（`app-sidebar.tsx:56-71`）。

### 1.4 滚动归属与内容宽度

- `body` 不滚（`index.css:109-118`：`html overflow-x-hidden`、`body min-h-svh`）。
- `SidebarInset` 是 `overflow-hidden`，`Main` 也是 `overflow-hidden flex-col`（`components/layout/components/main.tsx:29`）。**真正滚动的只有每页内容区**：`section-page-layout.tsx:108-113` 的 `overflow-auto`（`fixedContent` 时为 `overflow-hidden`，交给内部表格自己滚）。
- 内容宽度：`Main` 默认 `fluid=true` 全宽；`fluid=false` 时用容器查询 `@7xl/content:max-w-7xl`（`components/layout/components/main.tsx:30-32`），`/content` 容器由 `SidebarInset` 的 `@container/content` 建立（`authenticated-layout.tsx:48`）。
- 用户可选「居中」内容布局：`data-theme-content-layout='centered'` 时 ≥1280px 给 `SidebarInset` 的每个直接子元素加 `max-width:var(--max-content-width,1280px); margin-inline:auto`（`styles/theme-presets.css:738-744`）。注意 `--max-content-width` 全仓**从未定义**，实际恒为 1280px。

## 2. 导航信息架构

### 2.1 数据模型

```ts
// components/layout/types.ts:25-78（节选）
type BaseNavItem = {
  title: string
  badge?: string
  icon?: React.ElementType
  activeUrls?: (LinkProps['to'] | (string & {}))[]   // 额外高亮命中的 URL
  configUrls?: (LinkProps['to'] | (string & {}))[]   // 参与后台配置过滤的 URL
  requiredRole?: number                              // 低于此角色不可见
}
export type NavLink = BaseNavItem & { url: ...; items?: never; type?: never }
export type NavCollapsible = BaseNavItem & { items: (...& { url } )[]; url?: never }
export type NavChatPresets = BaseNavItem & { type: 'chat-presets' }
export type NavItem = NavCollapsible | NavLink | NavChatPresets
export type NavGroup = { id?: string; title: string; items: NavItem[] }
```

三种节点：单链接、可折叠（二级）、动态列表（`chat-presets` 从接口拉会话预设，见 `nav-group.tsx:77-79`）。

### 2.2 根导航：4 组 / 19 项

来源 `hooks/use-sidebar-data.ts:55-181`，全部文案过 `t()`：

| group.id | 标题 | 条目 |
| --- | --- | --- |
| `chat` | Chat | Playground `/playground`；Chat（`type:'chat-presets'` 动态） |
| `general` | General | Overview `/dashboard/overview`、Dashboard `/dashboard/models`、API Keys `/keys`、Usage Logs `/usage-logs/common`、Audit Logs `/usage-logs/audit`、Task Logs `/usage-logs/task`（`activeUrls:['/usage-logs/drawing']`） |
| `personal` | Personal | Wallet `/wallet`、Profile `/profile`、Security `/security` |
| `admin` | Admin | Channels、Models、Users、Redemption Codes、Subscriptions、System Info`*`、Task Plugins`*`、System Settings`*`（`*` = `requiredRole: ROLE.SUPER_ADMIN`） |

组标签样式：`text-[11px] uppercase tracking-wider text-muted-foreground/70`（`nav-group.tsx:69`），组内 `px-2 py-1`。

### 2.3 二级导航 = `$section` 动态段 + section registry

二级页不是嵌套路由树，而是**一个动态段参数 + 一份 section 注册表**：

```tsx
// routes/_authenticated/system-settings/auth/$section.tsx:27-40（节选）
export const Route = createFileRoute('/_authenticated/system-settings/auth/$section')({
  beforeLoad: ({ params }) => {
    if (!(AUTH_SECTION_IDS as unknown as string[]).includes(params.section)) {
      throw redirect({
        to: '/system-settings/auth/$section',
        params: { section: AUTH_DEFAULT_SECTION },
      })
    }
  },
  component: AuthSettings,
})
```

注册表工厂同时产出「侧栏子项」和「正文内容」：

```ts
// features/system-settings/utils/section-registry.ts:66-74
function getSectionNavItems(t: TFunction) {
  return sections.map((section) => ({
    title: t(section.titleKey),
    url:
      urlStyle === 'path'
        ? `${basePath}/${section.id}`
        : `${basePath}?section=${section.id}`,
  }))
}
```

每个模块导出四个符号：`X_SECTION_IDS`（路由校验用）、`X_DEFAULT_SECTION`（非法段回退）、`getXSectionNavItems`（喂侧栏）、`getXSectionContent`（按 id 渲染）。全仓共 **11 个 `$section.tsx`**：

```text
dashboard/$section.tsx
models/$section.tsx
usage-logs/$section.tsx
system-settings/{auth,billing,content,models,operations,request-policies,security,site}/$section.tsx
```

同级还有 `index.tsx`（只做 `redirect` 到默认段，如 `routes/_authenticated/system-settings/index.tsx:21-27`）与 `route.tsx`（角色守卫，如 `system-settings/route.tsx:25-36`）。

### 2.4 drill-in 二级侧栏（Vercel / Cloudflare 式）

`AppSidebar` 不堆叠子导航，而是**按 URL 换掉整个侧栏**：

```ts
// components/layout/config/system-settings.config.ts:107-115
export const SYSTEM_SETTINGS_VIEW: SidebarView = {
  id: 'system-settings',
  pathPattern: /^\/system-settings(\/|$)/,
  parent: {
    to: '/dashboard/overview',
    label: 'Back to Dashboard',
  },
  getNavGroups: getSystemSettingsNavGroups,
}
```

- 注册表只有一项（`lib/sidebar-view-registry.ts:31`），按数组顺序首个命中生效（`:39-41`）。
- 命中后侧栏顶部渲染 `SidebarViewHeader`（仅一个 `← Back to Dashboard` 按钮，`sidebar-view-header.tsx:66-67`），刻意不放标题行（注释 `:41-42`）。
- 侧栏内容用 `AnimatePresence mode='wait'` + `key={view.key ?? '__root'}` 做左右滑切换（`app-sidebar.tsx:56-71`，`use-sidebar-view.ts:32, 78`）。
- **嵌套视图故意不过 config 过滤**：`use-sidebar-view.ts:43-46` 注释说明过滤表只覆盖已知 dashboard URL，越权已在路由 `beforeLoad` 挡掉。

### 2.5 高亮规则

`components/layout/lib/url-utils.ts:57-122` 的 `checkIsActive(href, item, mainNav = false)` 判定顺序：

1. `item.activeUrls` 命中当前 URL（去 query 后精确）→ 高亮；
2. 可折叠项：任一子项 URL 匹配 → 父项高亮；子项 URL **带 query** 时要求 query 也相等，否则只比路径；
3. 单链接：先精确比，再比去 query 后的路径；
4. `mainNav=true` 时退化为「一级路径相同即高亮」。

视觉上不用左侧指示条，而是背景块 + 字重（`sidebar.tsx:498`）：

```text
... rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden
transition-[width,height,padding] hover:bg-muted hover:text-sidebar-foreground
focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground
data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground
[&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate
```

### 2.6 三层可见性过滤（照抄时最值得抄的部分）

1. **角色层**（`use-sidebar-view.ts:54-65`）：`group.id === 'admin'` 要求 `role >= ROLE.ADMIN(10)`；单条 `requiredRole` 再比一次（`ROLE = {GUEST:0, USER:1, ADMIN:10, SUPER_ADMIN:100}`，`lib/roles.ts:21-26`）。路由级守卫独立存在（如 `routes/_authenticated/system-settings/route.tsx:29-33` 只放行 SUPER_ADMIN）。
2. **后端模块开关 × 用户偏好层**（`hooks/use-sidebar-config.ts`）：`status.SidebarModulesAdmin` 是权威层，`auth.user.sidebar_modules` 只能再收窄；两层 AND。

```ts
// hooks/use-sidebar-config.ts:183-196
const adminAllowed = Boolean(adminSection?.enabled && adminSection[module] === true)
if (!adminAllowed) return false       // 后台关掉 = 对所有人隐藏
if (!userConfig) return true          // user 配置为 null = 不额外收窄（旧用户）
const userSection = userConfig[section]
if (!userSection) return true
if (userSection.enabled === false) return false
return userSection[module] !== false  // 用户只能再收窄，不能放开
```

映射表是硬编码白名单 `URL_TO_CONFIG_MAP`（`:99-123`，约 20 条 URL）；**未登记的 URL 默认可见**（`:177-181` 注释「新功能默认显示」）。另外 `permissions.sidebar_settings === false`（如 root）时整个用户层被跳过（`:297-300`），避免历史脏值把管理员锁在外面。

### 2.7 面包屑：实际不存在（重要的「负结论」）

- `components/ui/breadcrumb.tsx`（144 行）实现完整，但**全仓 0 引用**（grep `readcrumb` 只命中自身 22 处 + `section-page-layout.tsx` 8 处插槽定义）。
- `SectionPageLayout.Breadcrumb` 插槽存在（`section-page-layout.tsx:47-50, 76-78, 85-87`），业务页面无一处使用。
- 页面级定位靠三样东西替代：侧栏 drill-in 的返回按钮、`SectionPageLayout.Title`（`h2 truncate text-base font-bold sm:text-lg`，`:96`）、顶栏 `TopNav`。
- **坑**：`SkipToMain` 的 `href='#content'`（`skip-to-main.tsx:26`）在全仓找不到 `id="content"` 的元素，跳转焦点落空。

## 3. 主题切换实现

### 3.1 自研三态 ThemeProvider

```ts
// context/theme-provider.tsx:88-112（节选）
useEffect(() => {
  const root = window.document.documentElement
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const applyTheme = () => {
    const nextResolvedTheme = theme === 'system' ? getSystemTheme() : theme
    root.classList.remove('light', 'dark')
    root.classList.add(nextResolvedTheme)   // 写 class，不是 data-theme
    setResolvedTheme(nextResolvedTheme)
  }
  applyTheme()
  mediaQuery.addEventListener('change', applyTheme)   // system 态实时跟随
  return () => mediaQuery.removeEventListener('change', applyTheme)
}, [theme])
// setTheme(theme) = writeThemePreference(localStorage) + setState
```

- 三态 `'dark' | 'light' | 'system'`，默认 `system`（`:34-38`）。
- 写的是 `html.classList` 的 `light`/`dark`（**不是** `data-theme`）；`system` 时同时监听 `matchMedia` 变化。
- 存储键集中在 `lib/theme-storage.ts:19-26`：`newapi:theme:v1:mode|preset|font|radius|scale|content-layout`。刻意用 localStorage 而不用 cookie（`:36-37` 注释：cookie 跨端口共享会串味）。
- `resolvedTheme` 除了驱动 sonner（`components/ui/sonner.tsx:35-37`），也用于任何需要「真实亮/暗」而非三态的地方。

### 3.2 防闪烁：head 内同步脚本

```html
<!-- web/index.html:20-33（首帧前消除闪烁；键名与 THEME_STORAGE_KEYS.mode 手工同步） -->
<script>
  ;(function () {
    var theme = 'system'
    try { theme = localStorage.getItem('newapi:theme:v1:mode') || 'system' } catch (e) {}
    if (theme !== 'dark' && theme !== 'light') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    document.documentElement.classList.add(theme)
  })()
</script>
```

要点：脚本写死存储键字面量（注释明确要求与 `THEME_STORAGE_KEYS.mode` 手工同步），首帧前就把 class 落好；`theme-color` meta 由 `ThemeSwitch` 在切换时更新为 `#020817`/`#fff`（`theme-switch.tsx:39-43`）。

### 3.3 CSS：`.dark` 与 `color-scheme`

- `:root`（光）与 `.dark`（暗）两块完整 token 覆盖，全 OKLCH（`styles/theme.css:97-179` / `181-250`）。
- `.dark` 首行显式 `color-scheme: dark`（`theme.css:184`），注释说明原生控件跟随主题、且 Dark Reader 靠它判断站内已有暗色。
- `--radius: 1rem`，再由它派生 `--radius-sm..4xl`（倍率 0.6/0.8/1/1.4/1.8/2.2/2.6，`theme.css:88-94`）。
- 侧栏同色系微差：光模式 `--sidebar: color-mix(in oklch, var(--foreground) 0.5%, var(--background))`、`--sidebar-accent: primary 12%`（`theme.css:141-148`），暗模式 `primary 20%`（`:222`）。
- Tailwind v4 主题桥接在 `@theme inline`（`theme.css:60-95`），`--color-sidebar-*` 全部映射到 `--sidebar-*`。

### 3.4 两个切换器，两种形态

| 组件 | 位置 | 形态 |
| --- | --- | --- |
| `theme-switch.tsx` | 顶栏 / 公共页 header | ghost icon 按钮 `h-9 w-9` + 下拉三选项 + `Check` 打勾 |
| `theme-quick-switcher.tsx` | ConfigDrawer 内 | segmented radiogroup，motion 弹簧滑块 |

```tsx
// components/theme-switch.tsx:50-52 —— 太阳/月亮交叉旋转，纯 CSS dark: 变体
<Sun className='size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90' />
<Moon className='absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0' />
```

```tsx
// components/theme-quick-switcher.tsx:57-68 —— 滑块用 layoutId 在三个按钮间飞行
{theme === 'system' && (
  <motion.span
    layoutId='theme-switcher-active'
    className='bg-accent ring-border absolute inset-0 rounded-md ring-1'
    transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.2 }}
    animate={{ rotate: 360 }}
  />
)}
```

容器样式：`border-muted/50 bg-muted/40 inline-flex gap-1.5 rounded-lg border px-1.5 py-1`（`:43`），按钮 `size-7`，`role='radiogroup'/'radio'` + `aria-checked`。

### 3.5 外观轴系统（preset / font / radius / scale / content-layout）

`theme-customization-provider.tsx` 把 5 个偏好镜像成 `body` 的 `data-*`（`:130-159`：`data-theme-preset`、`data-theme-font`、`data-theme-radius`、`data-theme-scale`、`data-theme-content-layout`），由 `styles/theme-presets.css` 在合适层级覆盖 CSS 变量。其中 scale 的实现最巧——直接重定义字号与间距刻度：

```css
/* styles/theme-presets.css:722-731 */
[data-theme-scale='xl'] {
  --text-xs: 0.9rem;
  --text-sm: 1rem;
  --text-base: 1.125rem;
  --text-lg: 1.25rem;
  --text-xl: 1.45rem;
  --text-2xl: 1.75rem;
  --text-3xl: 2.15rem;
  --spacing: 0.3rem;
}
```

唯一 UI 入口是 `ConfigDrawer`（Sheet，`sm:max-w-md`，`components/config-drawer.tsx:101`），9 个区块：Theme / Preset / Font / Radius / Scale / Sidebar(variant) / Layout(collapsible) / ContentLayout / Dir（`:109-117`），底部一键 Reset 会同时重置 dir+theme+layout+customization（`:78-84`）。

## 4. i18n 切换器形态

```tsx
// components/language-switcher.tsx:42-54
const handleChangeLanguage = useCallback(
  async (code: string) => {
    await i18n.changeLanguage(code)
    if (user) {
      try {
        await api.put('/api/user/self', { language: code })
      } catch {
        // Best-effort persistence; don't block the UI on failure
      }
    }
  },
  [i18n, user]
)
```

- 视觉与 `ThemeSwitch` 完全同构：ghost icon 按钮 `h-9 w-9` + `align='end'` 下拉 + 末尾 `Check`（`:57-79`），图标 `Languages`。
- 选项来自 `i18n/languages.ts` 的 `INTERFACE_LANGUAGE_OPTIONS`，当前值经 `normalizeInterfaceLanguage(i18n.language)` 归一（`:41`）。
- 先切 UI（同步、立即生效），再 best-effort 回写用户偏好；失败静默。

## 5. 交互细节

| 细节 | 实现 | 出处 |
| --- | --- | --- |
| 选中态 | 背景块 + 字重，无左侧指示条 | `sidebar.tsx:498` |
| hover | `hover:bg-muted hover:text-sidebar-foreground` | 同上 |
| 聚焦环 | `focus-visible:ring-2` + `ring-sidebar-ring`，全局 `* { outline-ring/50 }` | `sidebar.tsx:498`；`index.css:104-108` |
| 折叠态子菜单 | `DropdownMenu side='right' sideOffset={4}` | `nav-group.tsx:239` |
| chevron 旋转 | `transition-transform duration-200` + `group-data-[panel-open]:rotate-90` | `nav-group.tsx:184` |
| 侧栏宽度过渡 | CSS `duration-200 ease-linear` | `sidebar.tsx:241` |
| 页面进入 | opacity 0→1、y 8→0、blur 4px→0.01px（规避 Android 全 0 blur 白屏，动画后再释放 filter） | `lib/motion.ts:39-49` |
| 路由 key | 用 `matches.at(-1).routeId` 而非 pathname → 换 `$section` 不重挂载、保留筛选状态 | `components/page-transition.tsx:64-66` |
| 顶栏进度条 | react-top-loading-bar，2px，色 `var(--muted-foreground)` | `navigation-progress.tsx:36-41` |
| Skip link | `fixed start-44 z-999 -translate-y-52`，`focus:translate-y-3` 滑入 | `skip-to-main.tsx:25` |

**⌘K 命令面板**（`components/command-menu.tsx`）：

```tsx
// components/command-menu.tsx:44-66（节选）—— 与侧栏共用同一份 navGroups
const { open, setOpen } = useSearch()
const { navGroups } = useSidebarView()   // 已被角色 + 配置过滤过
<CommandDialog modal open={open} onOpenChange={setOpen}>
  <Command>
    <CommandInput placeholder={t('Type a command or search...')} />
    <CommandList>
      <ScrollArea className='h-72 pe-1'>
        {navGroups.map((group) => (
          <CommandGroup key={group.id || group.title} heading={group.title}>
```

- 触发：`document` 上监听 `⌘/Ctrl + K` 切换（`context/search-provider.tsx:36-40`）；状态放在 `SearchProvider`，`CommandMenu` 挂在 `AuthenticatedLayout` 最外层。
- 与侧栏共用同一份 `navGroups`——**被角色或配置隐藏的页面不会出现在搜索里**，这是很值得学的一致性设计。
- 视觉：`ScrollArea h-72`；每条前置 `ArrowRight size-2 text-muted-foreground/80`；二级项显示 `父 > 子`；末尾 `CommandSeparator` + 固定 Theme 组（Light/Dark/System）。

## 6. 给 galzy 的移植建议（按性价比排序）

1. **先抄「尺寸变量 + 两行布局骨架」，别抄组件。** galzy 的 `apps/web-tanstack/src/components/admin/admin-shell.tsx` 目前是 `sticky h-14` 顶栏（`:203`）+ `aside fixed w-64`（`:243`）+ `lg:pl-64`（`:252`）+ `main max-w-6xl`（`:254`），高度 14 与左内边距 64 是两处必须人肉同步的魔法数。改成 `--app-header-height` + `SidebarInset` 的 `h-[calc(100svh-var(--app-header-height))]` 后，折叠/展开/换 variant 都不再动布局代码。
2. **把 `adminNav` 平铺组升级成 `NavGroup/NavItem` + drill-in 视图注册表。** galzy 已有单一配置源 `components/admin/admin-nav.ts`（5 个分区 / 10 个入口，同时喂侧栏、仪表盘快捷入口、系统状态），这点比 new-api 更干净，别退回去。要补的是：给 `AdminNavItem` 加 `activeUrls` / `requiredRole` / `badge`，再引入 `pathPattern → getNavGroups` 的 `SidebarView`（new-api 只注册 1 个视图、41 行代码），让「VNDB 同步 / Meilisearch / 任务」进入后换掉整个侧栏。
3. **导航数据只留一份，让 ⌘K、侧栏、面包屑都吃它**。new-api 的 `useSidebarView()` 同时供 `AppSidebar`（`app-sidebar.tsx:48`）与 `CommandMenu`（`command-menu.tsx:47`）使用，过滤逻辑（角色 10/100、后台开关、用户偏好）自然对两者一致。galzy 目前 `header/nav-config.ts` 与 `admin/admin-nav` 是两套，容易长歪。
4. **表格化过滤不要抄硬编码 URL 白名单**。`use-sidebar-config.ts:99-123` 的 `URL_TO_CONFIG_MAP` 有 20 条硬编码，新路由默认可见（`:177-181`）——正确但容易漏配。galzy 建议改成 `NavItem.configKeys?: string[]`，让配置键跟着导航定义走。
5. **防闪烁脚本可以照抄但要换键名**。galzy 已有同类脚本（`routes/__root.tsx:49` 的 `THEME_INIT_SCRIPT`，键 `theme`，还会写 `data-theme` + `style.colorScheme`）——new-api 少了 `colorScheme` 而这正是 `.dark{color-scheme:dark}` 之外的运行时兜底，可互补。
6. **主题切换器做两个层级**：顶栏 icon 下拉（省空间）+ 设置面板内 segmented 三态（可发现性）。galzy 现有 `ThemeToggle` 是单按钮循环，建议至少补 `role='radiogroup'` 版本。

## 7. 照抄前必读的不一致清单（均为实测，非推测）

| # | 现象 | 位置 |
| --- | --- | --- |
| 1 | `SkipToMain` 指向 `#content`，全仓无该 id 元素 → 焦点跳转失效 | `skip-to-main.tsx:26` |
| 2 | `ui/breadcrumb.tsx` 144 行实现 + `SectionPageLayout.Breadcrumb` 插槽，业务 0 使用 | grep `readcrumb` 仅命中这两个文件 |
| 3 | `MobileDrawer` 从 barrel 导出但 0 处渲染 | `components/layout/index.ts:40` |
| 4 | `next-themes` 声明依赖但 src 0 引用 | `web/package.json:62` |
| 5 | `--max-content-width` 被消费但从未定义，恒为 1280px 兜底 | `theme-presets.css:740` |
| 6 | `SystemBrand` 的 `variant='sidebar'` 分支（`:80-101`）无调用方，品牌只在顶栏 inline 出现 | `app-header.tsx:117` |
| 7 | `ThemeQuickSwitcher` 滑块同时 `layoutId` 位移 + `animate rotate:360`，每次切换整块转一圈 | `theme-quick-switcher.tsx:58-68` |
| 8 | 侧栏折叠态下 `SidebarGroupLabel` 用 `-mt-8 + opacity-0` 隐藏（占位仍在） | `sidebar.tsx:423` |
