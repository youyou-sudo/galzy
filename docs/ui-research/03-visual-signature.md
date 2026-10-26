# new-api 视觉签名调研（设计令牌 / 主题预设 / 卡片 / 图表 / 动效 / 字体）

> 调研对象：`D:/Users/xiaoy/Documents/Github/new-api`（只读）。下文所有 `web/...` 路径均相对该仓库根目录。
> 一句话结论：new-api 的视觉签名不是某个组件好看，而是**四轴正交的可换肤令牌系统**（色彩预设 × 字体 × 圆角 × 密度）+ **1rem 大圆角 + 纯中性灰面 + 单一主色 + 用 `color-mix` 从主色派生整层 surface**；图表实际用 VChart，仓库里的 shadcn/recharts 封装是死代码。

## 0. 阅读清单（行数即证据面）

| 文件 | 行数 | 作用 |
| --- | --- | --- |
| `web/src/styles/theme.css` | 250 | `@theme inline` 桥 + `:root`(light) / `.dark` 全量令牌 + 字体栈 |
| `web/src/styles/index.css` | 747 | Tailwind 入口、base 层、动效关键帧、reduced-motion、glass/fade 工具类 |
| `web/src/styles/theme-presets.css` | 744 | 10 个色彩预设、语义 surface 桥、字体轴、圆角轴、密度轴 |
| `web/src/lib/theme-customization.ts` | 180 | 预设枚举、默认值、`resolveThemeFont` |
| `web/src/context/theme-customization-provider.tsx` | 245 | 把状态镜像成 `<body data-theme-*>` |
| `web/src/lib/theme-storage.ts` | 57 | localStorage 键（`newapi:theme:v1:*`） |
| `web/src/components/ui/card.tsx` `titled-card.tsx` `icon-badge.tsx` | 121/106/85 | 容器视觉骨架 |
| `web/src/components/ui/chart.tsx` | 389 | shadcn recharts 封装（**未被任何模块 import**） |
| `web/src/lib/motion.ts` + `components/page-transition.tsx` | 129/211 | 动效令牌与页面过渡 |
| `web/AGENTS.md` §3.3/§3.10 | — | 组件复用与样式纪律 |
| `web/index.html` | 41 | 首屏前解析主题、`theme-color` |

## 1. 设计令牌全表

### 1.1 令牌如何进入 Tailwind

`theme.css` 用 `@theme inline` 建立「CSS 变量 → Tailwind 颜色命名空间」的一对一映射（`web/src/styles/theme.css:21-95`）：`--color-card: var(--card)` 等 40 余条。所有 `bg-card` / `text-muted-foreground` / `ring-primary` 都由这层桥接生成。暗色不是独立一套类名，而是 `@custom-variant dark (&:is(.dark *))`（`:19`）+ `html.dark`。

圆角阶梯完全由 `--radius` 一个变量缩放（`theme.css:88-94`）：

```css
--radius-sm: calc(var(--radius) * 0.6);
--radius-md: calc(var(--radius) * 0.8);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) * 1.4);
--radius-2xl: calc(var(--radius) * 1.8);
--radius-3xl: calc(var(--radius) * 2.2);
--radius-4xl: calc(var(--radius) * 2.6);
```

基准 `--radius: 1rem`（`theme.css:98`），因此 `rounded-xl` = 1.4rem = 22.4px、`rounded-2xl` = 1.8rem = 28.8px。这是 new-api「圆」观感的第一来源（galzy 目前是 0.625rem，见 §8）。另外 `--app-header-height: 3rem`（`:99`）统一顶栏高度。

### 1.2 light / dark 全量令牌

来源：`:root` 在 `theme.css:106-179`，`.dark` 在 `theme.css:181-250`。

| 令牌 | light | dark |
| --- | --- | --- |
| `--background` | `oklch(1 0 0)` | `oklch(0.235 0 0)` |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.965 0 0)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.285 0 0)` |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.965 0 0)` |
| `--popover` | `oklch(1 0 0)` | `oklch(0.305 0 0)` |
| `--popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.965 0 0)` |
| `--primary` | `oklch(0.692 0.141 243.716)` | `oklch(0.54 0.142 248.516)` |
| `--primary-foreground` | `oklch(1 0 0)` | `oklch(1 0 0)` |
| `--secondary` | `oklch(0.95 0 0)` | `oklch(0.335 0 0)` |
| `--secondary-foreground` | `oklch(0.42 0.16 250)` | `oklch(0.9 0.05 250)` |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.305 0 0)` |
| `--muted-foreground` | `oklch(0.49 0 0)` | `oklch(0.78 0 0)` |
| `--accent` | `color-mix(in oklch, var(--primary) 12%, var(--background))` | 同式 `20%` |
| `--accent-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| `--success` | `oklch(0.596 0.145 163.225)` | `oklch(0.696 0.17 162.48)` |
| `--warning` | `oklch(0.681 0.162 75.834)` | `oklch(0.769 0.188 70.08)` |
| `--info` | `oklch(0.588 0.158 241.966)` | `oklch(0.613 0.14 239.919)` |
| `--neutral` | `oklch(0.708 0 0)` | `oklch(0.76 0 0)` |
| `--border` | `oklch(0.93 0 0)` | `oklch(1 0 0 / 10%)` |
| `--input` | `oklch(0.93 0 0)` | `oklch(1 0 0 / 17%)` |
| `--ring` | `oklch(0.708 0.16 249.003)` | `oklch(0.554 0.148 250.726)` |
| `--chart-1..5` | 250/200/280/325/155 色相，L .68-.72, C .12-.19 | 同色相，L 提到 .75-.76, C 降到 .13-.16 |
| `--sidebar` | `color-mix(in oklch, var(--foreground) 0.5%, var(--background))` | `oklch(0.225 0 0)` |
| `--sidebar-foreground` | `oklch(0.145 0 0)` | `oklch(0.95 0 0)` |
| `--sidebar-primary` | `oklch(0.64 0.197 253.892)` | `oklch(0.588 0.123 246.488)` |
| `--sidebar-accent` | `color-mix(in oklch, var(--primary) 12%, var(--background))` | `20%` |
| `--sidebar-accent-foreground` | `oklch(0.579 0.196 255.909)` | `oklch(0.9 0.05 250)` |
| `--sidebar-border` / `--sidebar-ring` | `oklch(0.93 0 0)` / `oklch(0.58 0.2 250)` | `oklch(1 0 0 / 11%)` / `oklch(0.7 0.17 250)` |

### 1.3 base 层之外的扩展令牌

- `--skeleton-base` / `--skeleton-highlight`（`theme.css:149-150` / `226-227`）：驱动 shimmer 渐变。
- `--table-row` / `--table-header` / `--table-header-hover` / `--table-disabled(-hover/-border)`（`:151-178`）：表格全部用 `color-mix(foreground N%, background)` 微调，禁用态刻意「安静」不做彩色告警。
- `--overview-accent-1..3`（`:138-140`）：概览页统计卡的专属强调色，命名预设下会被重绑到 `--chart-1..3`（`theme-presets.css:409-413`）。

## 2. 色彩策略

### 2.1 中性灰阶为什么 chroma = 0

所有中性令牌的 chroma 都是 0（`oklch(1 0 0)`、`oklch(0.93 0 0)`…）。这不是偷懒，而是**为预设机制留白**：中性面本身无色相，任何预设都可以用 `color-mix(--primary N%, --background)` 把同一层 surface 整体染成自己的色调，而不需要每个预设重写 20 多个中性变量（见 §3.4）。换言之：**纯灰是「可被乘色的基底」**。

### 2.2 主色是哪种蓝

`--primary = oklch(0.692 0.141 243.716)`——中高明度、中饱和的**天蓝/蔚蓝**（`hue 244` 落在 sRGB 蓝偏青一侧，接近 Tailwind `sky-500`/#0ea5e9 一族，而非 `blue-600` 的 262°）。暗色版降到 `L 0.54` 以保对比。`--ring` 是同色系更饱和的一版（`0.708 0.16 249`），`--sidebar-primary` 更艳（`0.64 0.197 253.892`）用于侧栏选中态。

### 2.3 语义色是「四色 + 一个 neutral」

`success`(绿 163°) / `warning`(琥珀 76°) / `info`(蓝 242°) / `destructive`(红 27°)，外加 `--neutral`(0.708 灰)。四者都各带 `-foreground`，成对使用（填充 + 反白）。`IconBadge` 把它们与 chart 色统一成 11 个 tone（`ui/icon-badge.tsx:28-40`），所以「语义色只出现在图标底片和文字」而非整块背景——这是它克制的关键。

### 2.4 accent / sidebar 全靠 color-mix 派生

```css
--accent: color-mix(in oklch, var(--primary) 12%, var(--background));
--sidebar: color-mix(in oklch, var(--foreground) 0.5%, var(--background));
--sidebar-accent: color-mix(in oklch, var(--primary) 12%, var(--background));
```

只改 `--primary` 一个值，hover 底色、侧栏选中、tab 背景会同步换色；不需要给每个组件写暗色分支。dark 版把比例提到 20%（`theme.css:198,222`），因为深底上 12% 几乎不可见。

## 3. 主题预设机制

### 3.1 四轴正交 + data-* 落点

`web/src/styles/theme-presets.css:19-33` 是权威说明：属性挂在 `<body>` 上。

```html
<body data-theme-preset="rose-garden" data-theme-radius="lg"
      data-theme-scale="sm" data-theme-font="serif"
      data-theme-content-layout="centered" />
```

React 侧由 `theme-customization-provider.tsx:130-159` 五个 effect 分别镜像；**等于默认值时移除属性**（`preset === default ? null : preset`），让 `:root` 兜底。值持久化在 localStorage：`newapi:theme:v1:{mode,preset,font,radius,scale,content-layout}`（`lib/theme-storage.ts:19-26`），读取时校验白名单，非法值回退默认。

### 3.2 有 10 个预设，每个自带 radius（部分自带字体）

`lib/theme-customization.ts:26-80` 的 `THEME_PRESETS`：`default / anthropic / simple-large / underground / rose-garden / lake-view / sunset-glow / forest-whisper / ocean-breeze / lavender-dream`。每个条目带两个 `swatches` 直接喂给设置面板的渐变预览卡（`components/config-drawer.tsx:270-287`）。

预设块只覆盖「有彩色语义」的变量：`primary / primary-foreground / secondary / ring / chart-1..5 / sidebar-primary / sidebar-accent* / sidebar-ring / --radius`（如 `theme-presets.css:36-53`）。surface（card/border/muted）不写，交给 §3.4 统一派生。radius 由预设给出的例子：`ocean-breeze: 0.3rem`、`underground/forest-whisper: 0.5rem`、`lake-view: 0.75rem`、`rose-garden/sunset-glow: 1rem`、`anthropic: 0.625rem`。

两个「反预设」是显式设计的例外：
- **anthropic**（`theme-presets.css:474-613`）：暖米色画布 + 陶土色主色，刻意**用暖中性做面**而非被主色染，并 `--font-body: var(--font-serif)`（`:559`）默认走衬线。
- **simple-large**（`:295-404`）：高对比黑白 + 放大字号阶梯，**连 `--text-*` 和 `--spacing` 一起改**（`:346-353`），是「预设可以改排版」的样板。

### 3.3 层叠顺序是这套系统的核心

`theme-presets.css` 的书写顺序即优先级（同特异性下后者胜）：

1. `:root` 默认（`theme.css`）
2. 各预设块（`:36-404`、`:495-613`）
3. 语义 surface 桥（`:430-472`，特异性 (0,3,0)，靠 `:not()` 抬权）
4. 字体轴（`:622-631`）
5. 圆角轴（`:684-698`）
6. 密度轴（`:702-731`）
7. 内容布局（`:738-744`）

注释里明确写了「radius 块刻意放在 preset 块之后，让用户显式选择覆盖预设默认半径」（`:30-32`）。

### 3.4 语义 surface 桥（最值得抄的一段）

```css
[data-theme-preset]:not([data-theme-preset='default']):not(
  [data-theme-preset='anthropic']
):not([data-theme-preset='simple-large']) {
  --card: color-mix(in oklch, var(--primary) 3%, var(--background));
  --popover: color-mix(in oklch, var(--primary) 5%, var(--background));
  --muted: color-mix(in oklch, var(--primary) 7%, var(--background));
  --accent: color-mix(in oklch, var(--primary) 14%, var(--background));
  --border: color-mix(in oklch, var(--primary) 20%, var(--background));
  --success: var(--chart-2);  --warning: var(--chart-4);  --info: var(--chart-1);
}
```

效果：选中「Rose Garden」后不是只有按钮变红，卡片、边框、muted、popover、语义色全部跟着变粉，但都只是 3%-20% 的极低混入，观感仍是「灰面稍稍染了一点色」。这也是为什么 10 个预设不需要各写 40 个变量。

### 3.5 字体轴：三档 + 预设默认字体

`lib/theme-customization.ts:160-180`：

```ts
export const PRESET_DEFAULT_FONT = { anthropic: 'serif' }
export function resolveThemeFont(font, preset) {
  if (font === 'default') return PRESET_DEFAULT_FONT[preset] ?? 'system'
  return font
}
```

`default`（UI 显示为 Auto）在运行时被解析成 `system / sans / serif` 三个**具体值**再写到 DOM，所以 CSS 只需要简单属性选择器（`theme-presets.css:622-631`）：`system` → 浏览器 sans-serif；`sans` → 显式 Public Sans；`serif` → Lora 栈。用户选 Auto 时，Anthropic 预设自动得衬线，别的预设得系统字体——避免「字体开关」和「预设」互相打架。

### 3.6 密度轴是「改 Tailwind 令牌本身」

`[data-theme-scale='sm']` 同时覆盖 `--text-xs..3xl` 与 `--spacing`（`theme-presets.css:702-711`，0.225rem）。Tailwind v4 的工具类编译成 `calc(var(--spacing) * N)` 与 `var(--text-sm)`，所以在 body 上覆盖这两个变量 = **全站内边距、字号、行高同时缩放**，零组件改动。`simple-large` 复用同一手法（`:346-353`）。

## 4. 卡片与容器

### 4.1 Card：用 ring 代替 border，默认无阴影

`ui/card.tsx:29-38`：`bg-card rounded-xl ring-1 ring-foreground/10 gap-4 py-4 text-sm overflow-hidden`，`size='sm'` 时降为 `gap-3 py-3`。三个细节：
- 边框是 `ring-foreground/10`（前景色 10% 透明环）而不是 `border-border`，深浅主题下都自然，且不占布局尺寸。
- 首尾图片自动贴合圆角：`*:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl`。
- 有 footer 时自动去底 padding：`has-data-[slot=card-footer]:pb-0`。

悬浮效果写在全局 CSS 里，且**可由组件 opt-out**（`index.css:560-577`）：

```css
[data-slot='card']:not([data-card-hover='false']) { transition: transform 150ms ease, box-shadow 150ms ease; }
@media (min-width: 641px) {
  [data-slot='card']:not([data-card-hover='false']):hover {
    transform: translateY(-1px); box-shadow: 0 4px 12px rgb(0 0 0 / 0.06);
  }
  .dark [data-slot='card']:not([data-card-hover='false']):hover { box-shadow: 0 4px 12px rgb(0 0 0 / 0.3); }
}
```

——阴影只在 hover 出现，静止态靠 ring 定界；这是 new-api 看起来「轻」的原因。

### 4.2 TitledCard：业务层卡片的标准形

`ui/titled-card.tsx:64-104`：`Card` + `gap-0 py-0`，头部 `border-b p-3 !pb-3 sm:p-5 sm:!pb-5`，内容 `p-3 sm:p-5`。标题区结构固定为「IconBadge(size='title') + [CardTitle + CardDescription] + action 右对齐」，标题 `text-lg sm:text-xl tracking-tight`，描述 `text-xs sm:text-sm`。`disableHoverEffect` 就是写 `data-card-hover='false'`。

### 4.3 面板/统计卡：第二层容器语言

- `features/dashboard/components/ui/panel-wrapper.tsx:70-73`：`overflow-hidden rounded-2xl border bg-card shadow-xs` + 头部 `border-b px-4 py-3 sm:px-5`。**注意这里用 `border` + `shadow-xs`，与 Card 的 `ring` 不同**——仪表盘面板比通用 Card 更「实」。
- `overview/summary-cards.tsx:256`：`bg-card overflow-hidden rounded-2xl border shadow-xs`，内部再嵌 `bg-background/60 rounded-lg border` 小格（`:273`, `:313`）。三层容器：面板(2xl+border+shadow) → 小格(lg+border+bg/60) → 内容。
- `ui/stat-card.tsx:276`：数值统一 `font-mono ... tabular-nums tracking-tight`，`text-base sm:text-2xl`；描述 `text-muted-foreground/60 text-[11px] sm:text-xs`。**等宽数字 + 紧凑字距**是数据密集页面的招牌。

### 4.4 其它小件

`Badge` 圆角 `rounded-4xl`（= `--radius × 2.6` = 2.6rem，对 `h-5`=20px 的胶囊而言等价全圆角）、高固定 `h-5`、`text-xs`，语义变体用 `bg-*/10 + text-*` 的淡底彩色而非实心（`ui/badge.tsx:26-42`）。`Kbd` `h-5 rounded-sm bg-muted font-sans text-xs`（`ui/kbd.tsx:26`）。`Progress` 轨道 `h-1 bg-muted rounded-full`、指示条 `bg-primary transition-all`（`ui/progress.tsx:49-68`）——极细进度条。

## 5. 图表

### 5.1 双轨事实：真正在用的是 VChart

`components/ui/chart.tsx` 是标准 shadcn/recharts 封装（`ChartContainer`/`ChartStyle`/`ChartTooltipContent`，配色通过 `--color-{key}` 注入，`:100-131`），但全仓库**没有任何模块 import 它**（仅自引用）；`ChartContainer` 也只在该文件内出现。实际图表全部用 `@visactor/react-vchart`（`package.json:44-45`）+ `recharts: 3.9.1` 仅作为依赖残留。

调用点：`features/dashboard/components/models/model-charts.tsx:156`、`consumption-distribution-chart.tsx:159`、`users/user-charts.tsx:248`、`flow/flow-charts.tsx:503`、`features/rankings/**`。

### 5.2 chart-1..5 与 VChart 调色板的关系（重要坑）

仪表盘的柱/线/饼配色**不读 `--chart-N`**，而是取 VChart 内置 dataScheme：

```ts
// web/src/features/dashboard/lib/charts.ts:42-51
export function getDashboardChartColors(domainLength: number): string[] {
  const scheme = vchartDefaultDataScheme.find(
    (item) => !item.maxDomainLength || domainLength <= item.maxDomainLength
  ) ?? vchartDefaultDataScheme.at(-1)
  return (scheme?.scheme ?? []).filter((c): c is string => typeof c === 'string')
}
```

`--chart-1..5` 主要用于：`IconBadge` 的 chart tone、JSON 编辑器语法高亮（`index.css:82-92`：字符串=chart-5、数字=chart-4、关键字=chart-1）、以及预设的 `overview-accent` 与语义色重绑（`theme-presets.css:409-452`）。**改主题预设不会改 VChart 数据系列颜色**。

### 5.3 主题与图表联动的真实管线

1. `useChartTheme()`（`lib/use-chart-theme.ts:32-60`）懒加载 `ThemeManager` 并 `setCurrentTheme('dark'|'light')`，返回 `themeReady` 让图表延迟渲染，避免白底闪一下。
2. 需要「用 token 画图」的地方（如 `chart.tsx` 工具提示、canvas 类图表）走 `resolveThemeColor()`（`lib/theme-color.ts:27-44`）：把探针 div 的 `var(--foreground)` 经 canvas 归一化成 `rgba()`，因为 `oklch()`/`color-mix()` 图表库解析不了。这个函数监听 `html.class` 与 `body[data-theme-preset]` 变化重算（`:51-68`），是「令牌 → 图表引擎」的通用适配层。

### 5.4 若启用 chart.tsx，其轴线风格由 className 定义

`chart.tsx:84` 一段长选择器：坐标轴刻度文字 `fill-muted-foreground`、网格线 `stroke-border/50`、tooltip 光标线 `stroke-border`、径向背景 `fill-muted`、容器 `aspect-video text-xs`；tooltip 面板 `border-border/50 bg-background rounded-lg shadow-xl text-xs`（`:210`），数值用 `font-mono tabular-nums`（`:272`）。即「网格极淡、文字次要色、面板带阴影」的克制风格。

## 6. 动效

### 6.1 令牌（`web/src/lib/motion.ts`）

| 名称 | 值 |
| --- | --- |
| 时长 | `fast 0.15s / normal 0.25s / slow 0.35s / instant 0`（`:23-28`） |
| 缓动 | `EASE_OUT_CUBIC = [0.33, 1, 0.68, 1]`，全部 transition 共用（`:21`） |
| spring | `{ type:'spring', damping:20, stiffness:300 }`（`:34`） |
| stagger | table `0.03` / list `0.04` / card `0.05` / sidebar `0.03 + delayChildren 0.05` |

页面入场是这套系统的签名动作（`motion.ts:39-50`）：`opacity 0→1, y 8→0, blur(4px)→blur(0.01px)`，并在 `transitionEnd` 释放 filter（注释说明：精确 0 blur 在部分 Android 渲染器上会把整页刷白）。

```ts
pageEnter: {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0.01px)',
             transitionEnd: { filter: 'none' } },
  exit: { opacity: 0, y: -4, filter: 'blur(2px)' },
}
```

### 6.2 页面过渡的 key 选择

`components/page-transition.tsx:58-87` 的 `AnimatedOutlet` 用 **routeId 而不是 pathname** 做 key：`/dashboard/$section` 下切 tab 时同路由不同参数**原地重渲染**，不会 remount 丢掉已选时间范围。这是很实际的细节。

### 6.3 CSS 侧动效

- 表格逐行入场 `tableRowEnter 0.2s` + `nth-child` 25ms 递增延迟，最多到第 11 行（`index.css:589-633`）。
- 骨架屏 shimmer `1.8s ease-in-out infinite`（`:142-162`），并强制覆盖 `auto-skeleton-react` 的内联样式（`:165-176`）。
- 按钮 active 缩放 `scale(0.98)`（`:579-582`）；表格行底色过渡 120ms。
- 营销页入场：`landing-animate-* 0.6s cubic-bezier(0.16, 1, 0.3, 1)`（`:532-546`），配合 `AnimateInView` 的 IntersectionObserver（`components/animate-in-view.tsx:55-67`，`, rootMargin '0px 0px -40px 0px'`, threshold 0.15）。
- 特殊效果：`@property --auto-group-flow-angle` + conic-gradient + `mask-composite: exclude` 实现「3.2s 绕边流光」（`:692-729`）。

### 6.4 reduced-motion 是三处封堵，不是一处

1. React 层：`useReducedMotion()` 在每个 motion 组件入口**提前 return 纯 div**（`page-transition.tsx:40-44, 68-74, 96-100, 132-136, 160-164, 192-196`）。
2. CSS 层：`@media (prefers-reduced-motion: reduce)` 出现 6 次，分别关掉 shimmer（`index.css:178`）、appear/scroll/table（`:448`）、stream-fade（`:476`）、landing（`:548`）、terminal demo（`:683`），并把流光边框直接 `display:none`（`:743`）。
3. 反向用法：`@media (prefers-reduced-motion: no-preference)` 包裹 hover/表格入场，默认不播（`:261`, `:561`）。

## 7. 字体

- **Public Sans**（`@fontsource-variable/public-sans`，`index.css:22`）只用于**用户显式选 Sans**时（`theme-presets.css:625-628` 设 `--font-ui-sans: var(--font-public-sans)`）。Auto 默认给浏览器 `sans-serif`（`theme.css:104`）——即「尊重系统字体」，而非硬塞品牌字。
- **Lora**（`@fontsource-variable/lora`，`index.css:28`）是 `serif` 轴与 Anthropic 预设的正文面，全局加载以便切换时零 FOUT（注释 `:23-27`）。
- **CJK 回退链是重点**（`theme.css:30-36`）：Lora 只有拉丁字形，若直接落到 generic `serif`，浏览器在 Windows 小字号下的中文衬线选择不确定、常常看起来像黑体。所以显式列出 `Noto Serif SC/TC/JP/KR → Source Han Serif → Songti/STSong → PingFang SC → SimSun/宋体 → FangSong/仿宋 → KaiTi/楷体 → Georgia → Times → Cambria → Liberation Serif`。
- **字体落点只有一处**：`body { font-family: var(--font-body) }`（`index.css:117`），`--font-body` 由预设或字体轴赋值。衬线模式额外做排版精修（`theme-presets.css:653-681`）：`font-feature-settings: kern/liga/calt/tnum`、标题 `font-weight 500 + letter-spacing -0.012em`、`h1/.text-3xl+` 收紧到 `-0.02em`。
- `--font-inter`/`--font-manrope`（`theme.css:37-42`）实际都是系统字体栈别名，历史兼容用，不加载网络字体。

## 8. 对「仿照 new-api 改造 galzy」的差异与建议

galzy 现状（`apps/web-tanstack/src/styles.css`）与 new-api 的硬差异：

| 维度 | galzy 现状 | new-api |
| --- | --- | --- |
| `--radius` | 0.625rem（`:52`） | **1rem**（`theme.css:98`） |
| `--primary` | `oklch(0.205 0 0)` 近黑（`:38`） | `oklch(0.692 0.141 243.716)` 天蓝 |
| 语义色 | 仅 `destructive` | success/warning/info/neutral 五件套 + `IconBadge` 11 tone |
| surface 派生 | 无，逐令牌写死 | `color-mix(primary N%, background)` 桥 |
| 预设层 | 无 `data-theme-*` | 10 预设 × 4 轴 |
| 字体 | Geist Variable（`:98`） | Public Sans / Lora + CJK 衬线链 |
| 图表 | recharts 3.10.1 | VChart + `resolveThemeColor` 适配层 |
| reduced-motion | 2 处 CSS | React 早退 + 6 处 CSS 封堵 |

三条最有杠杆的建议：

1. **先上「语义 surface 桥」，再谈换色**。把 `--card/--popover/--muted/--accent/--border` 从写死改成 `color-mix(in oklch, var(--primary) N%, var(--background))`（N=3/5/7/14/20），galzy 立刻获得「换一个 `--primary` 就整站换气质」的能力，而不用像现在这样逐令牌维护。
2. **radius 从 0.625rem 提到 1rem + 卡片改 `ring-foreground/10` 无阴影 + hover 才浮起 1px**。这三处是 new-api「圆 + 轻」观感的 80%，改动面极小（`styles.css` 一行 + `Card` 组件类名 + 一段全局 hover CSS）。
3. **若要预设，务必用 `data-* on <body>` + 书写顺序做层叠，而不是 JS 算主题**。new-api 的预设块只写 12 个变量、radius 轴排在 preset 之后、字体轴把 Auto 解析成具体值，这三点让 10 套预设的 CSS 总量压在 744 行内且无运行时开销；直接复制这套骨架比自研 ThemeProvider 便宜得多。

> 反向提醒：new-api 的 `chart-1..5` 与真实图表配色是**脱钩**的（§5.2）。galzy 若继续用 recharts，正好可以直接消费 `--chart-N`（new-api 的 `ui/chart.tsx` 已示范 `--color-{key}` 注入），这一点不必照抄它的脱钩现状。
