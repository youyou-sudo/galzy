# Tailwind 类名整理报告 — apps/web-tanstack

> 基线 commit： `4559044`　工作区改动：149 files changed, 1077 insertions(+), 1077 deletions(-)
> 范围：apps/web-tanstack/src 下全部 .tsx/.ts（排除自动生成的 routeTree.gen.ts）

**一句话总结**：149 个文件、1079 处类名字符串按 Tailwind 官方分组顺序重排，10 处 px/py -> p 等值合并，0 处删除类名；机器验证「字符串外零改动 + 再跑幂等 + tsc 通过 + oxlint 0 警告」。剩余 1 处真实冲突与若干口径问题需你拍板（见 §3），重复组合与拆分建议见 §4。

> **后续追加（不属于本报告的类名整理）**：按需求把首页站标外面的「底片」去掉——`components/home/home-hero.tsx` 删掉 `bg-primary/5`、`ring-1 ring-border/60`、圆角裁剪容器，只保留 favicon 原图（与顶栏一致）；同时把 `game-detail-pending.test.tsx` / `tag-detail-pending.test.tsx` 里 6 处按旧顺序断言类名的期望值同步为新顺序。因此当前工作区共 151 个文件改动 = 149 个类名整理 + 2 个测试断言同步（home-hero 本身已在 149 内，附录 A 里它的站标类名串现已进一步删除）。

## 1. 整理后的完整代码

所有文件**已在原位置改写完成**（工作区即最终结果，可直接提交/替换原文件），不是片段：

- 涉及文件 149 个，全部位于 `apps/web-tanstack/src/`。
- 改动只发生在字符串字面量内部（类名 token 顺序 + 10 处等价简写合并）：代码结构、缩进、换行、非类名字符串零改动。
- 查看完整 diff：`git diff -- apps/web-tanstack/src`。

下面给出 3 个示例文件的**完整内容**（与原文件同路径同格式，可直接替换）：

### `apps/web-tanstack/src/components/header/mobile-menu.tsx`

```tsx
import { Link } from "@tanstack/react-router";
import { cn } from "@web/lib/utils";
import { ChevronRight, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Ref } from "react";
import { mobilePrimaryKeys, navItem, toolMenuKeys } from "./nav-config";
import type { HeaderNavItem } from "./nav-config";

/**
 * 覆盖层里的一行：左侧图标 + 主文案 +（可选）次要描述 + 右侧箭头。
 *
 * 手机端默认折叠说明文字，只保留一行 44px 的可点区域：
 * 8 个主入口 + 工具分组可以在不滚动的一屏内看完；需要看说明时由底部按钮展开。
 */
const rowClass = cn(
	"group/row galzy-mobile-item flex gap-2.5 items-center px-2.5 py-2 min-h-11 rounded-xl",
	"text-foreground no-underline outline-none transition-colors duration-200",
	"hover:bg-muted/60 focus-visible:bg-muted/60",
	"focus-visible:ring-2 focus-visible:ring-ring/60",
	// TanStack Link 命中当前路由时自带 data-status="active"
	"data-[status=active]:bg-muted/60",
);

type NavRowProps = {
	item: HeaderNavItem;
	/** 全局序号（跨分组连续），用于错峰入场延迟 */
	index: number;
	open: boolean;
	onSelect: () => void;
	rowRef?: Ref<HTMLAnchorElement>;
	/** 默认 false：说明文字折叠，保证首屏信息密度 */
	showDescription: boolean;
};

/**
 * 站外条目走原生 <a>（新标签页打开），站内条目走 TanStack Link 保留预取；
 * 两种行共享同一套排版，只差渲染目标。
 */
function NavRow({
	item,
	index,
	open,
	onSelect,
	rowRef,
	showDescription,
}: NavRowProps) {
	const Icon = item.icon;
	// 关闭后移除延迟，下次打开时关键帧从干净的起点重播
	const style = open ? { animationDelay: `${80 + index * 45}ms` } : undefined;

	const content = (
		<>
			<span
				className={cn(
					"flex shrink-0 justify-center items-center size-8 rounded-lg",
					"text-muted-foreground bg-muted/70 transition-colors duration-200",
					"group-hover/row:text-foreground group-hover/row:bg-background",
				)}
			>
				<Icon className="size-4" />
			</span>
			<span className="flex flex-col flex-1 min-w-0">
				<span className="text-sm leading-tight font-medium truncate">
					{item.label}
				</span>
				{showDescription && (
					<span className="mt-0.5 text-xs font-normal text-muted-foreground truncate">
						{item.description}
					</span>
				)}
			</span>
			<ChevronRight
				className={cn(
					"shrink-0 size-4 text-muted-foreground/60",
					"transition-transform duration-200",
					"group-hover/row:translate-x-0.5",
				)}
			/>
		</>
	);

	if (item.type === "external") {
		return (
			<a
				ref={rowRef}
				href={item.href}
				target="_blank"
				rel="noreferrer"
				className={rowClass}
				style={style}
				onClick={onSelect}
			>
				{content}
			</a>
		);
	}

	return (
		<Link
			ref={rowRef}
			to={item.to}
			preload="viewport"
			className={rowClass}
			style={style}
			onClick={onSelect}
		>
			{content}
		</Link>
	);
}

/**
 * 移动端顶栏全屏菜单。
 *
 * 这里刻意不用 Sheet / Dialog：Base UI 的焦点陷阱会把焦点锁在覆盖层内，
 * 而顶栏（z-50）要浮在覆盖层（z-40）之上且汉堡按钮必须保持可点，
 * 两者会互相抢焦点。手写覆盖层 + Esc + 焦点归还，行为可控且没有额外依赖。
 *
 * Header 首次打开后保持挂载、只切换 open，所以进出场动画全部由 open 驱动：
 * 入场读 styles.css 的 .galzy-mobile-overlay / .galzy-mobile-item 关键帧
 * （data-open="true" 时播放），退场交给这里的 opacity transition 完成。
 */
export function HeaderMobileMenu({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const triggerRef = useRef<HTMLElement | null>(null);
	const firstRowRef = useRef<HTMLAnchorElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);
	// 点导航行/外链后关闭：焦点应该跟着导航走，不能抢回汉堡按钮
	const skipFocusReturn = useRef(false);
	// 说明文字默认折叠：手机端首屏优先放完整入口，需要解释时再展开
	const [showDescriptions, setShowDescriptions] = useState(false);

	const dismissByNavigation = () => {
		skipFocusReturn.current = true;
		onOpenChange(false);
	};

	// 焦点管理：打开时记录焦点来源（通常就是顶栏汉堡按钮）并把焦点交给
	// 第一个条目；Esc / 点遮罩 / 点汉堡关闭时归还，键盘用户不会「掉」到页面顶部。
	useEffect(() => {
		if (!open) {
			if (!skipFocusReturn.current) triggerRef.current?.focus();
			skipFocusReturn.current = false;
			// 下次打开重新记录（触发器可能换了一个）
			triggerRef.current = null;
			return;
		}
		// 只在「关 → 开」的第一次记录：StrictMode 会把 effect 跑两遍，
		// 第二遍时焦点已经在第一行上，无条件覆盖会把触发者记成菜单里的链接，
		// 关闭时焦点就会「还」给一个立刻被 inert 抹掉的元素。
		if (!triggerRef.current) {
			const active = document.activeElement;
			triggerRef.current =
				active instanceof HTMLElement &&
				active !== document.body &&
				!overlayRef.current?.contains(active)
					? active
					: document.querySelector<HTMLElement>(
							'[aria-controls="galzy-mobile-menu"]',
						);
		}
		firstRowRef.current?.focus();
	}, [open]);

	// 关闭菜单后恢复折叠，下次打开仍是高密度的一屏
	useEffect(() => {
		if (!open) setShowDescriptions(false);
	}, [open]);

	// 滚动锁：保存原值再恢复，避免覆盖其他组件对 body.style.overflow 的写法。
	// html 上有 scrollbar-gutter: stable，隐藏溢出不会引起横向抖动。
	useEffect(() => {
		if (!open) return;
		const { body } = document;
		const previous = body.style.overflow;
		body.style.overflow = "hidden";
		return () => {
			body.style.overflow = previous;
		};
	}, [open]);

	// 键盘：Esc 关闭 + Tab 首尾循环。
	// 覆盖层自称 aria-modal，但顶栏（z-50）在其上方且必须可点，所以不能交给
	// Dialog 的焦点陷阱；手写「首尾哨兵」把 Tab 圈在覆盖层内，避免焦点跑到
	// 被覆盖层盖住的正文里。
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onOpenChange(false);
				return;
			}
			if (event.key !== "Tab") return;

			const root = overlayRef.current;
			if (!root) return;
			const focusables = Array.from(
				root.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]):not([tabindex="-1"])',
				),
			).filter(
				(el) => el.offsetParent !== null || el === document.activeElement,
			);
			if (focusables.length === 0) return;

			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement;
			const outside = !root.contains(active);

			if (event.shiftKey && (active === first || outside)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && (active === last || outside)) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, onOpenChange]);

	return (
		<div
			ref={overlayRef}
			// 顶栏汉堡按钮（mobile-trigger.tsx）用 aria-controls 指向这里
			id="galzy-mobile-menu"
			// styles.css 的入场关键帧依赖 data-open
			data-open={open}
			className={cn(
				"galzy-mobile-overlay fixed inset-0 z-40",
				// 顶部留出 z-50 顶栏的安全区，汉堡按钮始终露在外面可点
				"overflow-y-auto overscroll-contain pt-16 pb-6",
				"bg-background/95 backdrop-blur-xl",
				"transition-opacity duration-200 ease-out",
				open ? "opacity-100" : "opacity-0 pointer-events-none",
			)}
			role="dialog"
			aria-modal="true"
			aria-label="主导航"
			// open=false 时整棵子树退出可访问树与 Tab 序列（覆盖层不卸载）。
			// 只用 inert：它本身就会把子树移出可访问树，再加 aria-hidden 会在
			// 关闭瞬间「有焦点后代」而触发 Chrome 的 aria-hidden 警告。
			inert={!open}
			onClick={(event) => {
				// 点空白处收起，符合全屏菜单的直觉；行内点击的 target 不是容器本身，
				// 因此不会重复触发关闭
				if (event.target === event.currentTarget) onOpenChange(false);
			}}
		>
			<nav className="flex flex-col gap-0.5 px-4 mx-auto w-full max-w-md">
				{/* 主菜单顺序：mobilePrimaryKeys（主站→OpList→防失联→标签→会社→
            合集→论坛→联系），与桌面端导航同一份数据源 */}
				{mobilePrimaryKeys.map((key, index) => (
					<NavRow
						key={key}
						item={navItem(key)}
						index={index}
						open={open}
						onSelect={dismissByNavigation}
						rowRef={index === 0 ? firstRowRef : undefined}
						showDescription={showDescriptions}
					/>
				))}

				<div className="mx-2 my-1.5 h-px bg-border" />
				<p
					className={cn(
						"px-2.5 pt-1 pb-1 text-[10px] font-semibold tracking-wider",
						"text-muted-foreground uppercase",
					)}
				>
					工具
				</p>
				{/* 工具分组：toolMenuKeys（所有工具 / 车牌号跳转） */}
				{toolMenuKeys.map((key, index) => (
					<NavRow
						key={key}
						item={navItem(key)}
						index={mobilePrimaryKeys.length + index}
						open={open}
						onSelect={dismissByNavigation}
						showDescription={showDescriptions}
					/>
				))}

			</nav>

			{/* 折叠说明 + 关闭提示合并为一行，少占一屏高度 */}
			<div className="flex gap-2 justify-center items-center mt-2 text-[11px] text-muted-foreground">
				<button
					type="button"
					aria-pressed={showDescriptions}
					onClick={() => setShowDescriptions((value) => !value)}
					className="inline-flex gap-1 items-center px-2 min-h-8 rounded-lg transition-colors duration-200 hover:text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
				>
					<Info className="size-3.5" aria-hidden="true" />
					{showDescriptions ? "收起说明" : "显示说明"}
				</button>
				<span aria-hidden="true">·</span>
				<span>Esc 关闭</span>
			</div>
		</div>
	);
}
```

### `apps/web-tanstack/src/components/home/Count.tsx`

```tsx
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@web/components/ui/skeleton";
import { getTotalCount } from "@web/server/game";
import { Send } from "lucide-react";

/**
 * 收录总数条：数字与频道入口并排，作为首屏的「数据背书」。
 * 保留「共收录了：…条目」的文案切分，便于 pending 测试按区间断言。
 */
export default function CountComponent() {
	return (
		<div className="flex flex-wrap gap-x-3 gap-y-1 justify-center items-center my-4 text-xs text-muted-foreground sm:text-sm">
			<span className="inline-flex gap-1.5 items-center tabular-nums">
				共收录了：<Count /> 条目
			</span>
			<span aria-hidden="true" className="hidden w-px h-3 bg-border sm:block" />
			<a
				className="inline-flex gap-1 items-center font-medium text-primary no-underline transition-colors hover:text-primary/80"
				target="_blank"
				href="https://t.me/ziyuanlinyin"
				rel="noopener"
			>
				频道
				<Send className="size-3.5" />
			</a>
		</div>
	);
}

/**
 * 收录总数。
 *
 * 刻意不用 Suspense / useSuspenseQuery：SSR 期间只要挂起，整页 HTML 都要等这次请求
 * 才能开始发（首字节被一个数字拖住）。这里用普通 useQuery + 数字骨架：服务端先出
 * 「共收录了：…条目」的外壳，数字在客户端补上，文案与布局都不跳。
 */
const Count = () => {
	const { data } = useQuery({
		queryKey: ["totalCount"],
		queryFn: () => getTotalCount(),
	});

	if (data === undefined) {
		return <Skeleton className="inline-block mx-0.5 w-10 h-4 align-middle" />;
	}

	return <>{data}</>;
};
```

### `apps/web-tanstack/src/components/shared/page-header.tsx`

```tsx
import { cn } from "@web/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile } from "./icon-tile";

/**
 * 用户端统一页面头。
 *
 * 结构固定：图标底片 + 标题（+ 行内计数/眉标）+ 描述 + 右侧操作。
 * 各页不再自拼 h1/描述/操作区的间距与字号。
 */
export function PageHeader({
	icon,
	title,
	description,
	meta,
	eyebrow,
	actions,
	align = "start",
	className,
}: {
	icon?: LucideIcon;
	title: ReactNode;
	description?: ReactNode;
	/** 标题右侧的行内信息，如「共 128 个」 */
	meta?: ReactNode;
	/** 标题上方的小眉标 */
	eyebrow?: ReactNode;
	actions?: ReactNode;
	align?: "start" | "center";
	className?: string;
}) {
	const centered = align === "center";

	return (
		<header
			className={cn(
				"flex flex-col gap-4 mb-6 sm:flex-row sm:justify-between sm:items-start",
				centered && "items-center text-center sm:flex-col sm:items-center",
				className,
			)}
		>
			<div
				className={cn(
					"flex flex-col gap-1.5 min-w-0",
					centered && "items-center",
				)}
			>
				{eyebrow && (
					<p className="text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase">
						{eyebrow}
					</p>
				)}
				<div
					className={cn(
						"flex flex-wrap gap-x-3 gap-y-1 items-center min-w-0",
						centered && "justify-center",
					)}
				>
					{icon && <IconTile icon={icon} size="md" />}
					<h1 className="min-w-0 text-2xl font-semibold tracking-tight text-balance">
						{title}
					</h1>
					{meta && (
						<span className="text-sm tabular-nums text-muted-foreground">
							{meta}
						</span>
					)}
				</div>
				{description && (
					<p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
						{description}
					</p>
				)}
			</div>
			{actions && (
				<div className="flex flex-wrap shrink-0 gap-2 items-center">
					{actions}
				</div>
			)}
		</header>
	);
}
```

## 2. 变更说明

### 2.1 统计

| 指标 | 数值 |
| --- | --- |
| 扫描文件（含 className） | 176 |
| 实际改写文件 | 149 |
| 静态类名字符串（扫描） | 2349 |
| 发生改动的字符串 | 1079 |
| 等价合并 | 10 |
| 删除重复类名 | 0 |
| 保留冲突对（未擅自删除，见待确认） | 1 |
| 动态拼接类名（未改动，见附录 B） | 23 |

### 2.2 按模块

| 目录 | 文件数 | 改动字符串数 |
| --- | --- | --- |
| components/admin | 15 | 194 |
| components/ui | 33 | 178 |
| routes | 13 | 109 |
| components/home | 18 | 106 |
| components/animate-ui | 12 | 77 |
| components/tags | 7 | 75 |
| components/shared | 7 | 58 |
| components/cmments | 4 | 42 |
| components/header | 4 | 35 |
| components/user | 5 | 31 |
| components/EmojiPicker | 2 | 25 |
| components/game | 3 | 22 |
| components/markdown-components.tsx | 1 | 19 |
| components/editor | 2 | 15 |
| components/tools | 2 | 12 |
| components/auth | 2 | 9 |
| components/Header.tsx | 1 | 9 |
| components/introduction | 2 | 9 |
| components/topics | 2 | 9 |
| components/error.tsx | 1 | 7 |
| components/Footer.tsx | 1 | 7 |
| components/shadcn-io | 1 | 7 |
| components/theme-menu.tsx | 1 | 6 |
| components/friend-links-page.tsx | 1 | 4 |
| components/producer | 2 | 4 |
| components/code-block.tsx | 1 | 2 |
| components/EditorDraftBanner.tsx | 1 | 2 |
| components/openapi-page.tsx | 1 | 2 |
| components/bbcode.tsx | 1 | 1 |
| components/contact-page.tsx | 1 | 1 |
| components/RichContent.tsx | 1 | 1 |
| components/SmartMarkdown.tsx | 1 | 1 |

### 2.3 典型变更（位置 | 原类名 | 新类名 | 原因）

| 位置 | 原类名 | 新类名 | 原因 |
| --- | --- | --- | --- |
| `components/admin/admin-shell.tsx:163` | `flex items-center justify-between border-b border-sidebar-border px-4 py-4` | `flex justify-between items-center p-4 border-b border-sidebar-border` | 合并 px-4 py-4 -> p-4 |
| `components/editor/MarkdownEditor.tsx:202` | `flex items-center gap-0.5 px-1 py-1 border-b border-input bg-muted/30 overflow-x-auto flex-nowrap` | `flex overflow-x-auto flex-nowrap gap-0.5 items-center p-1 bg-muted/30 border-b border-input` | 合并 px-1 py-1 -> p-1 |
| `components/editor/RichTextEditor.tsx:367` | `flex items-center gap-0.5 flex-wrap px-1 py-1 border-b border-input bg-muted/30` | `flex flex-wrap gap-0.5 items-center p-1 bg-muted/30 border-b border-input` | 合并 px-1 py-1 -> p-1 |
| `components/game/game-detail-pending.tsx:92` | `grid gap-5 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-7 sm:px-6 sm:py-5` | `grid gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-7 sm:px-6 sm:py-5` | 合并 px-4 py-4 -> p-4 |
| `components/game/game-layout-page.tsx:55` | `grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 sm:px-5` | `grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 sm:px-5` | 合并 px-4 py-4 -> p-4 |
| `components/home/game/tags.tsx:41` | `mt-3 mb-3` | `my-3` | 合并 mt-3 mb-3 -> my-3 |
| `components/markdown-components.tsx:126` | `mt-6 mb-4 overflow-x-auto rounded-xl border border-border/70 bg-muted px-4 py-4` | `overflow-x-auto p-4 mt-6 mb-4 bg-muted rounded-xl border border-border/70` | 合并 px-4 py-4 -> p-4 |
| `components/shared/search-field.tsx:65` | `h-9 rounded-xl bg-background/60 pr-9 pl-9` | `px-9 h-9 bg-background/60 rounded-xl` | 合并 pr-9 pl-9 -> px-9 |
| `components/admin/admin-table.tsx:48` | `flex flex-col gap-2 border-b border-border/60 p-4 sm:flex-row sm:flex-wrap sm:items-center` | `flex flex-col gap-2 p-4 border-b border-border/60 sm:flex-row sm:flex-wrap sm:items-center` | 重排（分组顺序） |
| `components/admin/collections-page.tsx:223` | `inline-flex items-center gap-1 rounded text-sm font-medium text-primary transition-colors duration-200 hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `inline-flex gap-1 items-center text-sm font-medium text-primary rounded transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| `components/admin/comments-page.tsx:315` | `inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-200 hover:text-primary/80` | `inline-flex gap-1 items-center text-xs font-medium text-primary transition-colors duration-200 hover:text-primary/80` | 重排（分组顺序） |
| `components/admin/meilisearch/searchable-tab.tsx:93` | `cursor-grab touch-none shrink-0 rounded text-muted-foreground hover:text-foreground active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `shrink-0 text-muted-foreground rounded cursor-grab touch-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing` | 重排（分组顺序） |
| `components/admin/topics-page.tsx:194` | `inline-flex items-center gap-1 rounded text-sm font-medium text-primary transition-colors duration-200 hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `inline-flex gap-1 items-center text-sm font-medium text-primary rounded transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| `components/admin/users-page.tsx:779` | `inline-flex items-center justify-center size-5 rounded hover:bg-muted transition-colors` | `inline-flex justify-center items-center size-5 rounded transition-colors hover:bg-muted` | 重排（分组顺序） |
| `components/admin/vndb-sync-page.tsx:265` | `grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 text-sm` | `grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 lg:grid-cols-7` | 重排（分组顺序） |
| `components/animate-ui/components/radix/accordion.tsx:103` | `flex flex-1 text-start items-center justify-between py-4 font-medium hover:underline` | `flex flex-1 justify-between items-center py-4 font-medium text-start hover:underline` | 重排（分组顺序） |
| `components/animate-ui/components/radix/dialog.tsx:71` | `bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg sm:max-w-lg` | `grid fixed top-[50%] left-[50%] z-50 gap-4 p-6 w-full max-w-[calc(100%-2rem)] bg-background rounded-lg border shadow-lg translate-x-[-50%] translate-y-[-50%] sm:max-w-lg` | 重排（分组顺序） |
| `components/animate-ui/components/radix/dropdown-menu.tsx:98` | `focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `flex relative gap-2 items-center px-2 py-1.5 text-sm rounded-sm outline-hidden cursor-default select-none focus:text-accent-foreground data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |

### 2.4 等价合并明细（全部 10 处）

| 位置 | 合并 | 结果 |
| --- | --- | --- |
| `components/admin/admin-shell.tsx:163` | `px-4 py-4 -> p-4` | `flex justify-between items-center p-4 border-b border-sidebar-border` |
| `components/admin/admin-shell.tsx:251` | `px-4 py-4 -> p-4` | `p-4 border-b border-sidebar-border` |
| `components/admin/admin-shell.tsx:264` | `lg:px-8 lg:py-8 -> lg:p-8` | `flex-1 px-4 py-6 mx-auto w-full max-w-7xl outline-none sm:px-6 lg:p-8` |
| `components/editor/MarkdownEditor.tsx:202` | `px-1 py-1 -> p-1` | `flex overflow-x-auto flex-nowrap gap-0.5 items-center p-1 bg-muted/30 border-b border-input` |
| `components/editor/RichTextEditor.tsx:367` | `px-1 py-1 -> p-1` | `flex flex-wrap gap-0.5 items-center p-1 bg-muted/30 border-b border-input` |
| `components/game/game-detail-pending.tsx:92` | `px-4 py-4 -> p-4` | `grid gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-7 sm:px-6 sm:py-5` |
| `components/game/game-layout-page.tsx:55` | `px-4 py-4 -> p-4` | `grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 sm:px-5` |
| `components/home/game/tags.tsx:41` | `mt-3 mb-3 -> my-3` | `my-3` |
| `components/markdown-components.tsx:126` | `px-4 py-4 -> p-4` | `overflow-x-auto p-4 mt-6 mb-4 bg-muted rounded-xl border border-border/70` |
| `components/shared/search-field.tsx:65` | `pr-9 pl-9 -> px-9` | `px-9 h-9 bg-background/60 rounded-xl` |

### 2.5 排序分组规则（实际执行顺序）

| 序号 | 分组 | 包含 |
| --- | --- | --- |
| 1 | 布局 | display / position / inset(top,right,bottom,left) / float / clear / overflow(-x,-y) / overscroll / visibility / z / box / aspect / columns |
| 2 | Flex/Grid | basis / flex-direction / flex-wrap / flex / grow / shrink / order / grid-cols(-span,start,end) / grid-rows / grid-flow / auto-* / gap(-x,-y) / justify / items / content / self / place |
| 3 | 间距 | p / px / py / pt / pr / pb / pl / ps / pe，m 系列，space-x/y |
| 4 | 尺寸 | w / min-w / max-w / h / min-h / max-h / size |
| 5 | 排版 | font-family / font-size / antialiased / italic / weight / tabular-nums / tracking / line-clamp / leading / list / text-align / text-color / underline / decoration / underline-offset / truncate / uppercase / text-wrap / whitespace / break / indent / align / placeholder / caret / content / hyphens / text-shadow / prose |
| 6 | 背景 | bg-color / bg-image / gradient(from,via,to) / position / size / repeat / attachment / clip / origin / blend |
| 7 | 圆角/边框 | rounded / border-width / border-color / border-style / divide / outline / ring / ring-offset / ring-inset |
| 8 | 效果 | shadow / inset-shadow / opacity / mix-blend / backdrop / filter(blur 等) |
| 9 | 过渡与动画 | transition / duration / ease / delay / animate / tw-animate-css(animate-in、fade-*、zoom-*) |
| 10 | 变换 | transform / translate / rotate / scale / skew / origin / perspective / backface |
| 11 | 交互 | accent / appearance / cursor / pointer-events / resize / scroll-* / snap / touch / select / will-change / field-sizing / scrollbar / sr-only / table / fill / stroke |
| 12 | 其他 | 无法识别的自定义类（galzy-* 等）排在基础类最后 |
| 13 | 状态变体 | hover/focus/active/disabled/dark/sm/md/max-*/data-*/aria-*/group-*/任意变体 一律最后：伪元素 → 结构伪类 → 状态 → 交互 → group/peer/has/not → aria/data/supports → dark → print/动效偏好 → 断点(sm→2xl→max-*→min-*) → 任意变体 |

### 2.6 为什么可以保证「视觉表现完全不变」

1. **className 的书写顺序不影响 CSS 生效**：层叠由生成的样式表决定，重排本身零风险。
2. **但 cn() 里的顺序有意义**（clsx + tailwind-merge 后者覆盖前者）：脚本用 tailwind-merge 实测每一对类是否互相覆盖，把互相覆盖的类组成「冲突簇」并冻结其相对顺序，只整体移动到合适分组，因此 cn() 的运行时语义不变。
3. **合并只在数学等价时进行**：同一变体前缀下、恰好只有 px-X + py-X（或 mt-X+mb-X、ml-X+mr-X、pt-X+pb-X）且值完全相同时才合并；一旦出现第三种 padding/margin 类就放弃合并。
4. **没有擅自删除**：本次未发现完全重复 token；同属性不同取值的冲突全部保留并列入待确认。
5. **机器验证**：TS AST 掩码比对证明 149 个文件的非字符串部分与基线逐字节一致、字符串字面量数量一致；二次运行改动为 0（幂等）；tsc --noEmit 通过；oxlint 0 warning / 0 error。
6. **保留字符串首尾空白**：人工复核发现 card.tsx 里有 object-cover + ${hoverClasses} 这种**无分隔拼接**，早期版本 trim 掉前导空格会产生 object-covertransition（object-cover 与 transition 双双失效）；最终版工具**只重排内部 token、保留首尾空白**，这类字符串同样安全。

## 3. 待确认项

### A. 必须由你拍板的冲突 / 冗余

| # | 位置 | 现状 | 判断与建议 |
| --- | --- | --- | --- |
| 1 | `components/home/card.tsx:328` | `w-67.5 w-min-[270px] h-50` | `w-min-[270px]` 是全仓唯一的 `w-min-[`：`w-min` 是 `width:min-content`，后面不能再接任意值，**不是合法工具类**。`w-67.5` = 67.5 × 4px = 270px，与 270px 数值一致：按无效类处理时删掉它视觉零变化；若要 `min-width` 语义应改成 `min-w-[270px]`（属语义修正，需你确认）。工具已保留两者相对顺序，未擅自删除。 |
| 2 | `components/home/game/download-options.tsx:418` | `flex-row gap-2 justify-center sm:justify-center` | `sm:justify-center` 与基础类 `justify-center` **同值**，属死代码（所有断点都已被覆盖）。可安全删除，但删除变体类不在「等价重排」范围内，留给你确认。 |
| 3 | `components/home/card.tsx:288` | `galzy-image-reveal absolute inset-0` | `galzy-image-reveal` 在 `styles.css` 中**没有定义**（已定义的自定义类为 `galzy-page-in/out`、`galzy-scroll-x`、`galzy-fade-x`、`galzy-mobile-*`、`galzy-site-header`、`galzy-prose`、`galzy-vt-group-fade`、`galzy-editor-min-height`、`galzy-max-h-85dvh`）。疑似历史死类；若它由 JS 运行时动态添加，则不能删——需你确认。 |
| 4 | `components/producer/producer-detail-page.tsx:68` | `className="text-center "` | 尾随空格被**刻意保留**（拼接安全优先，见 §2.6 第 6 条）。这是纯 JSX 静态 className，手动去掉无风险但无必要。 |
| 5 | `components/home/game/download-options.tsx:64` | `px-2 pr-8 py-0.5` | `px` 与 `pr` 在 tailwind-merge 中互相覆盖（`twMerge("pr-8 px-2")` 会丢掉 `pr-8`），属于同一「冲突簇」，簇内保持原相对顺序，导致 `py` 被挤到后面。语义正确（右侧留位 2rem 生效）；手工改成 `px-2 py-0.5 pr-8` 也不影响样式。 |

### B. 需要你认可的实现口径

| # | 事项 | 本次采用 | 备注 |
| --- | --- | --- | --- |
| 6 | 变体内部顺序 | `hover → focus → focus-visible → active → enabled/disabled → group/peer/has/not → aria/data/supports → dark → print/motion → sm → md → lg → xl → 2xl → max-* → 任意变体` | 与 `prettier-plugin-tailwindcss` 的 `dark` 位置不同（它把 dark 放前面）。如需对齐，改 `tw-classify.mjs` 里 `variantRankOne` 的一张表重跑即可。 |
| 7 | 非工具类类名的位置 | `group`/`peer` 与项目自定义类（`galzy-*`）统一**置顶**；`prose` 归排版组 | 早期版本把未知类放末尾，与 `group` 置顶不一致；最终版统一置顶（`group/row galzy-mobile-item flex gap-2.5 items-center …`）。 |
| 8 | 复合变体被打散 | `components/ui/alert-dialog.tsx:55`：`data-[size=default]:max-w-xs … data-[size=sm]:max-w-xs … data-[size=default]:sm:max-w-sm` | 按「变体层级数」排序，双级变体（`data-[size=default]:sm:`）排在单级之后，视觉上被拆到串尾。twMerge 语义无问题，仅可读性；如要按 data 条件聚合需人工调。 |
| 9 | 任意变体按字典序 | `components/bbcode.tsx:103`：`[&_p:first-child]` 排在 `[&_p]` 之前（`:` < `]`） | 语义无影响，纯可读性。 |
| 10 | `text-*` + `leading-*` 必须相邻 | `components/admin/admin-shell.tsx:70/73`、`components/header/mobile-menu.tsx:63` 等 | 这不是排序 bug：`twMerge("leading-none text-sm")` 会丢掉 `leading-none`，所以工具把它们冻结为同一个冲突簇。**请勿"顺手"按排版子序拆开**。 |

### C. 工具无法自动判定、需人工维护的部分

| # | 事项 | 说明 |
| --- | --- | --- |
| 11 | 动态类名 23 处（附录 B） | 模板字符串/拼接/变量类名未改动。其中 `components/home/card.tsx:606` 是 `object-cover${hoverClasses}` **无分隔拼接**——这类字符串的首尾空格是语义的一部分，后续手工整理时务必保留。 |
| 12 | 跨字符串覆盖 | 调用点覆盖（`<Button className="h-6">` 覆盖组件内 `h-9`）无法静态判定，本次未动，也不在检测范围。 |
| 13 | `components/ui/**` shadcn 受管文件 | 30 个文件已一并整理；将来 `shadcn` CLI 更新会覆盖回上游顺序。若不希望，下次清理可用 `--only` 参数排除 `components/ui`。 |
| 14 | `space-y-*` 110 处 | 项目规范建议用 `gap`，但 `space-y-*` 与 `gap` 的 DOM/间距行为不完全等价（margin 折叠、子元素选择器），改属行为变更，本次未动。 |

## 4. 优化建议

### 4.1 可抽取的重复类名组合（同文件 ≥3 次）

全仓单类高频（统计口径：静态类名字符串内出现次数）：`size-4` 72 次、`size-3.5` 47、`space-y-2` 37、`animate-spin size-4` 36、`w-full` 30、`text-muted-foreground text-xs` 26、`space-y-4` 24、`font-medium` 24。

| 位置 | 重复组合 | 次数 | 建议 |
| --- | --- | --- | --- |
| `components/admin/vndb-sync-page.tsx`（5 个文件合计 23） | `size-4 animate-spin` | 6 | 复用已有 `components/ui/spinner.tsx`：`<Spinner className="size-4" />`（meilisearch 两个 tab 已这么做） |
| `components/admin/users-page.tsx` | `mr-1 size-4 animate-spin` | 5 | 抽 `<SubmitSpinner />`，或给 `<Button>` 加 `loading` prop；6 个对话框可一起收敛 |
| `components/admin/tasks-page.tsx` | `text-xs text-muted-foreground` | 7 | `@apply` 成 `.meta-text`，或抽 `<MetaText>`（vndb-sync / admin-table 同形态也出现） |
| `components/admin/vndb-sync-page.tsx` | `flex flex-col gap-1` + `text-sm font-medium` 成对出现 | 各 5 | 明显是同一个「报告列表项」重复 5 次：抽 `<ReportListSection title>`，一次消掉 10 处 |
| `components/admin/collections-page.tsx` / `users-page.tsx` | `space-y-2` / `space-y-4` | 10 / 3、9 / 5 | 抽 `<FormStack>`；或按项目规范改用 `flex flex-col gap-*`（行为需确认） |
| `components/home/card.tsx` | `relative w-full h-full`、`text-2xl font-semibold text-white`、`mt-1 text-xs text-white/70`、`absolute right-2 bottom-2`、`bg-black/40 backdrop-blur-sm` | 各 3 | 这 5 组是同一段「敏感图浮层」的复制：抽 `<SensitiveCoverOverlay coarse radius onReveal />`，一次消 15 处，顺便解耦无分隔拼接（object-cover 紧跟 hoverClasses） |
| `components/tags/tag-hierarchy.tsx` | `size-8 rounded-full sm:size-6` | 5 | 同一工具栏 5 个图标按钮：抽 `<HierarchyIconButton>` 或导出 `iconButtonClass` 常量 |
| `components/tags/tag-detail-pending.tsx` | `w-24 h-7 rounded-lg` | 3 | 三行完全相同：`Array.from({ length: 3 }).map(...)` |
| `components/markdown-components.tsx` | `font-semibold tracking-tight scroll-m-20`（其中 4 次带 `first:mt-0`） | 9 | 抽 `<Heading level>` 组件或 `headingBase` 常量，`first:mt-0` 做 cva 变体 |
| `components/ui/dropdown-menu.tsx` | item base ×4、`data-disabled:… [&_svg]:… size-4` 图标规则 ×3 | 4 / 3 | 抽 `menuItemBase`、`menuItemIconRules` 常量（或一个 cva `item` 变体） |
| `components/animate-ui/components/radix/sidebar.tsx` | `rounded-md outline-hidden ring-sidebar-ring` | 3 | 抽 `sidebarInteractiveBase` 常量（GroupLabel / GroupAction / MenuAction 共用） |
| `components/shared/route-skeletons.tsx` | `w-24 h-8 rounded-full`、`w-20 h-8 rounded-md` | 各 3（连续行） | 用 map 渲染，删掉手写三行 |
| `components/editor/RichTextEditor.tsx` | `mx-1 h-5` | 4 | 抽 `<ToolbarSeparator />` |
| `components/editor/MarkdownEditor.tsx` | `gap-1 px-2 py-0.5 text-xs` | 3 | 抽 `tabTriggerCn` 常量或给 TabsTrigger 加 `size="xs"` |
| `components/auth/OauthButton.tsx` | `gap-1.5 px-2 w-full text-xs` | 6 | 该文件本身就是一个列表渲染，抽 `<OauthRow>` 即可 |

### 4.2 建议拆分的文件（按收益排序）

| 文件 | 规模 | 建议边界 |
| --- | --- | --- |
| `components/tags/tag-hierarchy.tsx` | 1405 行 / 22 个函数 / 19 处类名改动 | `lib/tag-graph.ts`（布局纯函数，可单测）+ `tags/hierarchy/node-chip.tsx` + `tags/hierarchy/use-hierarchy-viewport.ts`（手势/缩放，768-1075）；主文件只留组合与工具条 |
| `components/EmojiPicker/emoji-picker.tsx` | 1139 行（含大量静态数据） | 数据抽 `emoji-data.ts`，UI 拆 list / search / trigger |
| `components/admin/collections-page.tsx` | 963 行 / 21 处 | `collections/entity-picker.tsx`（ProducerSearch 与 GameSearch 275-484 几乎同构）+ `collections/collection-dialogs.tsx`（Create/Edit/Delete 485-963） |
| `components/admin/tasks-page.tsx` | 869 行 / 39 处（本仓改动最多） | `tasks/task-detail-drawer.tsx`（289-508）+ `tasks/task-overview.tsx`（StatCards + QueueStatusStrip 168-288） |
| `components/animate-ui/components/radix/sidebar.tsx` | 817 行 / 24 个组件 / 23 处 | `sidebar-context.ts`（context + cookie）+ `sidebar-shell.tsx`（168-433）+ `sidebar-menu.tsx`（434-800） |
| `routes/games/index.tsx` | 865 行 | 搜索区 / 筛选区 / 列表区 / 分页区拆分（当前单组件 570 行） |
| `components/admin/users-page.tsx` | 820 行 / 13 处 | `users/user-table.tsx` + `users/user-dialogs.tsx`（6 个对话框共用同一套 spinner/表单模式） |
| `components/home/card.tsx` | 664 行 / 20 处 | `home/card/thumbhash-image.tsx`（39-322）+ `sensitive-overlay.tsx` + `images.tsx`（360-495）+ `card-skeletons.tsx`（324-358） |
| `components/editor/RichTextEditor.tsx` | 399 行 | `rich-text-upload.ts`（XHR 上传，73-117）+ `rich-text-toolbar.tsx`（365-399）+ `rich-text-slash-menu.tsx` |
| `components/ui/chart.tsx` | 372 行 | `chart-context.tsx` + `chart-style.tsx`（82-114，CSS 变量注入）+ `chart-tooltip.tsx`（117-270）+ `chart-legend.tsx`（273-327） |

### 4.3 防回归建议

1. **把排序纳入 lint**：仓库已装 Biome 2.6.2（无新依赖），可在 `biome.json` 打开 `nursery.useSortedClasses`（`attributes: ["className"]`、`functions: ["cn", "clsx", "cva", "twMerge"]`），先用本次顺序作为基线，之后 `bun run lint` 即可拦住回退（具体选项名以 Biome 文档为准）。
2. **className 组合只走 `cn()`**：本项目 `cn = clsx + twMerge`，已满足「规则 4」的要求，不要在组件里直接 `clsx(...)` 拼类名，否则跨分支覆盖不再受 twMerge 保护。
3. **拼接约定**：拼接类名一律带分隔符 —— 首选 `cn("object-cover", hoverClasses)`；若必须用模板字符串，变量前要留空格（写成 object-cover 后跟一个空格再接 hoverClasses）。本次脚本已保留首尾空白兜底，但代码层面写清楚更稳。
4. **规范写死两条口径**：非工具类类名（`group`/`peer`/`galzy-*`）置顶；变体统一放最后、`dark` 在断点之前。
5. **一次性 bulk 工具**：`.dsh-tmp/tool/tw-codemod.mjs`（TS AST + tailwind-merge 冲突检测 + 幂等）可复用；升级 tailwindcss / tailwind-merge 后建议先 dry-run 对比再 apply。

### 4.4 顺带发现（本次未改动）

- `space-y-*` 共 110 处，与「用 gap 不用 space-y」的项目规范不一致；改动属行为变更。
- `components/home/card.tsx:288` 的 `galzy-image-reveal`、`:328` 的 `w-min-[270px]` 疑似死类/笔误（见待确认 1、3）。
- admin 区多处对话框重复「loading spinner + 文案」模式（users-page 5 处、tasks-page 3 处），统一 `<Button loading>` 收益最大。

## 附录 A：全部 1079 处改动明细

| # | 位置 | 原类名 | 新类名 | 原因 |
| --- | --- | --- | --- | --- |
| 1 | `components/admin/admin-shell.tsx:65` | `flex items-center gap-3 px-2` | `flex gap-3 items-center px-2` | 重排（分组顺序） |
| 2 | `components/admin/admin-shell.tsx:66` | `flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_1px_2px_oklch(0_0_0/0.08)]` | `flex justify-center items-center size-9 text-primary-foreground bg-primary rounded-xl shadow-[0_1px_2px_oklch(0_0_0/0.08)]` | 重排（分组顺序） |
| 3 | `components/admin/admin-shell.tsx:70` | `text-sm font-semibold tracking-tight leading-none` | `text-sm leading-none font-semibold tracking-tight` | 重排（分组顺序） |
| 4 | `components/admin/admin-shell.tsx:73` | `mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground leading-none` | `mt-1 text-[10px] leading-none tracking-[0.2em] text-muted-foreground uppercase` | 重排（分组顺序） |
| 5 | `components/admin/admin-shell.tsx:89` | `flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4` | `flex overflow-y-auto flex-col flex-1 gap-6 px-3 py-4` | 重排（分组顺序） |
| 6 | `components/admin/admin-shell.tsx:92` | `px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70` | `px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase` | 重排（分组顺序） |
| 7 | `components/admin/admin-shell.tsx:105` | `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200` | `flex gap-3 items-center px-3 py-2 text-sm font-medium rounded-xl transition-colors duration-200` | 重排（分组顺序） |
| 8 | `components/admin/admin-shell.tsx:107` | `bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border/60` | `text-sidebar-accent-foreground bg-sidebar-accent ring-1 ring-sidebar-border/60` | 重排（分组顺序） |
| 9 | `components/admin/admin-shell.tsx:108` | `text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground` | `text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60` | 重排（分组顺序） |
| 10 | `components/admin/admin-shell.tsx:113` | `size-4 shrink-0` | `shrink-0 size-4` | 重排（分组顺序） |
| 11 | `components/admin/admin-shell.tsx:130` | `flex flex-col gap-1 border-t border-sidebar-border px-3 py-4` | `flex flex-col gap-1 px-3 py-4 border-t border-sidebar-border` | 重排（分组顺序） |
| 12 | `components/admin/admin-shell.tsx:133` | `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground` | `flex gap-3 items-center px-3 py-2 text-sm font-medium text-muted-foreground rounded-xl transition-colors duration-200 hover:text-sidebar-foreground hover:bg-sidebar-accent/60` | 重排（分组顺序） |
| 13 | `components/admin/admin-shell.tsx:135` | `size-4 shrink-0` | `shrink-0 size-4` | 重排（分组顺序） |
| 14 | `components/admin/admin-shell.tsx:160` | `flex w-72 flex-col gap-0 bg-sidebar p-0 text-sidebar-foreground` | `flex flex-col gap-0 p-0 w-72 text-sidebar-foreground bg-sidebar` | 重排（分组顺序） |
| 15 | `components/admin/admin-shell.tsx:163` | `flex items-center justify-between border-b border-sidebar-border px-4 py-4` | `flex justify-between items-center p-4 border-b border-sidebar-border` | 合并 px-4 py-4 -> p-4 |
| 16 | `components/admin/admin-shell.tsx:204` | `sticky top-0 z-30 flex h-[var(--app-header-height)] items-center gap-3 border-b border-border/60 bg-background/80 px-4 sm:px-6 lg:px-8` | `flex sticky top-0 z-30 gap-3 items-center px-4 h-[var(--app-header-height)] bg-background/80 border-b border-border/60 sm:px-6 lg:px-8` | 重排（分组顺序） |
| 17 | `components/admin/admin-shell.tsx:211` | `flex min-w-0 items-center gap-2` | `flex gap-2 items-center min-w-0` | 重排（分组顺序） |
| 18 | `components/admin/admin-shell.tsx:216` | `truncate text-sm font-semibold tracking-tight` | `text-sm font-semibold tracking-tight truncate` | 重排（分组顺序） |
| 19 | `components/admin/admin-shell.tsx:220` | `ml-auto flex items-center gap-2` | `flex gap-2 items-center ml-auto` | 重排（分组顺序） |
| 20 | `components/admin/admin-shell.tsx:223` | `hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted/60 hover:text-foreground sm:flex` | `hidden gap-1.5 items-center px-2.5 h-8 text-xs font-medium text-muted-foreground rounded-lg transition-colors duration-200 hover:text-foreground hover:bg-muted/60 sm:flex` | 重排（分组顺序） |
| 21 | `components/admin/admin-shell.tsx:242` | `flex min-h-screen w-full bg-muted/40 dark:bg-background` | `flex w-full min-h-screen bg-muted/40 dark:bg-background` | 重排（分组顺序） |
| 22 | `components/admin/admin-shell.tsx:245` | `fixed top-3 left-3 z-[100] -translate-y-20 rounded-xl bg-background px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-border transition-transform duration-200 focus:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `fixed top-3 left-3 z-[100] px-4 py-2 text-sm font-medium bg-background rounded-xl ring-1 ring-border shadow-lg transition-transform duration-200 -translate-y-20 focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 23 | `components/admin/admin-shell.tsx:250` | `fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border/70 bg-sidebar text-sidebar-foreground lg:flex` | `hidden fixed inset-y-0 left-0 z-40 flex-col w-64 text-sidebar-foreground bg-sidebar border-r border-sidebar-border/70 lg:flex` | 重排（分组顺序） |
| 24 | `components/admin/admin-shell.tsx:251` | `border-b border-sidebar-border px-4 py-4` | `p-4 border-b border-sidebar-border` | 合并 px-4 py-4 -> p-4 |
| 25 | `components/admin/admin-shell.tsx:259` | `flex min-w-0 flex-1 flex-col lg:pl-64` | `flex flex-col flex-1 min-w-0 lg:pl-64` | 重排（分组顺序） |
| 26 | `components/admin/admin-shell.tsx:264` | `mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8` | `flex-1 px-4 py-6 mx-auto w-full max-w-7xl outline-none sm:px-6 lg:p-8` | 合并 lg:px-8 lg:py-8 -> lg:p-8 |
| 27 | `components/admin/admin-table.tsx:28` | `flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border/60` | `flex overflow-hidden flex-col bg-card rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 28 | `components/admin/admin-table.tsx:48` | `flex flex-col gap-2 border-b border-border/60 p-4 sm:flex-row sm:flex-wrap sm:items-center` | `flex flex-col gap-2 p-4 border-b border-border/60 sm:flex-row sm:flex-wrap sm:items-center` | 重排（分组顺序） |
| 29 | `components/admin/admin-table.tsx:66` | `w-full overflow-x-auto` | `overflow-x-auto w-full` | 重排（分组顺序） |
| 30 | `components/admin/admin-table.tsx:82` | `w-full border-collapse text-sm` | `w-full text-sm border-collapse` | 重排（分组顺序） |
| 31 | `components/admin/admin-table.tsx:111` | `px-4 py-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground` | `px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap` | 重排（分组顺序） |
| 32 | `components/admin/admin-table.tsx:246` | `border-t border-border/60 px-4 py-3` | `px-4 py-3 border-t border-border/60` | 重排（分组顺序） |
| 33 | `components/admin/admin-table.tsx:289` | `inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap` | `inline-flex gap-1 items-center px-2 h-5 text-xs font-medium whitespace-nowrap rounded-full` | 重排（分组顺序） |
| 34 | `components/admin/admin-table.tsx:295` | `size-3 shrink-0` | `shrink-0 size-3` | 重排（分组顺序） |
| 35 | `components/admin/articles-page.tsx:253` | `text-sm font-medium truncate block` | `block text-sm font-medium truncate` | 重排（分组顺序） |
| 36 | `components/admin/articles-page.tsx:276` | `text-xs whitespace-nowrap text-muted-foreground` | `text-xs text-muted-foreground whitespace-nowrap` | 重排（分组顺序） |
| 37 | `components/admin/articles-page.tsx:280` | `flex items-center justify-end gap-1.5` | `flex gap-1.5 justify-end items-center` | 重排（分组顺序） |
| 38 | `components/admin/articles-page.tsx:559` | `text-sm border-l-2 pl-3 text-muted-foreground italic` | `pl-3 text-sm italic text-muted-foreground border-l-2` | 重排（分组顺序） |
| 39 | `components/admin/collections-page.tsx:223` | `inline-flex items-center gap-1 rounded text-sm font-medium text-primary transition-colors duration-200 hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `inline-flex gap-1 items-center text-sm font-medium text-primary rounded transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 40 | `components/admin/collections-page.tsx:226` | `size-3 shrink-0` | `shrink-0 size-3` | 重排（分组顺序） |
| 41 | `components/admin/collections-page.tsx:235` | `text-xs whitespace-nowrap text-muted-foreground` | `text-xs text-muted-foreground whitespace-nowrap` | 重排（分组顺序） |
| 42 | `components/admin/collections-page.tsx:241` | `flex items-center justify-end gap-1.5` | `flex gap-1.5 justify-end items-center` | 重排（分组顺序） |
| 43 | `components/admin/collections-page.tsx:317` | `ml-1 rounded transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `ml-1 rounded transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 44 | `components/admin/collections-page.tsx:332` | `max-h-40 divide-y overflow-y-auto rounded-xl ring-1 ring-border/60` | `overflow-y-auto max-h-40 rounded-xl divide-y ring-1 ring-border/60` | 重排（分组顺序） |
| 45 | `components/admin/collections-page.tsx:334` | `flex items-center justify-center py-4` | `flex justify-center items-center py-4` | 重排（分组顺序） |
| 46 | `components/admin/collections-page.tsx:335` | `size-4 animate-spin text-muted-foreground` | `size-4 text-muted-foreground animate-spin` | 重排（分组顺序） |
| 47 | `components/admin/collections-page.tsx:341` | `flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/40` | `flex gap-2 items-center px-3 py-2 transition-colors cursor-pointer hover:bg-muted/40` | 重排（分组顺序） |
| 48 | `components/admin/collections-page.tsx:350` | `text-sm block truncate` | `block text-sm truncate` | 重排（分组顺序） |
| 49 | `components/admin/collections-page.tsx:352` | `text-xs text-muted-foreground block truncate` | `block text-xs text-muted-foreground truncate` | 重排（分组顺序） |
| 50 | `components/admin/collections-page.tsx:357` | `text-xs font-mono text-muted-foreground shrink-0` | `shrink-0 font-mono text-xs text-muted-foreground` | 重排（分组顺序） |
| 51 | `components/admin/collections-page.tsx:434` | `ml-1 rounded transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `ml-1 rounded transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 52 | `components/admin/collections-page.tsx:449` | `max-h-40 divide-y overflow-y-auto rounded-xl ring-1 ring-border/60` | `overflow-y-auto max-h-40 rounded-xl divide-y ring-1 ring-border/60` | 重排（分组顺序） |
| 53 | `components/admin/collections-page.tsx:451` | `flex items-center justify-center py-4` | `flex justify-center items-center py-4` | 重排（分组顺序） |
| 54 | `components/admin/collections-page.tsx:452` | `size-4 animate-spin text-muted-foreground` | `size-4 text-muted-foreground animate-spin` | 重排（分组顺序） |
| 55 | `components/admin/collections-page.tsx:459` | `flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 disabled:opacity-50` | `flex gap-2 items-center px-3 py-2 w-full text-left transition-colors hover:bg-muted/40 disabled:opacity-50` | 重排（分组顺序） |
| 56 | `components/admin/collections-page.tsx:470` | `text-sm block truncate` | `block text-sm truncate` | 重排（分组顺序） |
| 57 | `components/admin/collections-page.tsx:474` | `text-xs font-mono text-muted-foreground shrink-0` | `shrink-0 font-mono text-xs text-muted-foreground` | 重排（分组顺序） |
| 58 | `components/admin/collections-page.tsx:565` | `size-4 mr-1` | `mr-1 size-4` | 重排（分组顺序） |
| 59 | `components/admin/collections-page.tsx:937` | `text-sm border-l-2 pl-3 text-muted-foreground italic` | `pl-3 text-sm italic text-muted-foreground border-l-2` | 重排（分组顺序） |
| 60 | `components/admin/comments-page.tsx:278` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 61 | `components/admin/comments-page.tsx:280` | `size-3.5 text-muted-foreground shrink-0` | `shrink-0 size-3.5 text-muted-foreground` | 重排（分组顺序） |
| 62 | `components/admin/comments-page.tsx:288` | `text-[11px] text-muted-foreground block mt-0.5` | `block mt-0.5 text-[11px] text-muted-foreground` | 重排（分组顺序） |
| 63 | `components/admin/comments-page.tsx:294` | `flex items-start gap-1` | `flex gap-1 items-start` | 重排（分组顺序） |
| 64 | `components/admin/comments-page.tsx:296` | `size-3 text-muted-foreground mt-1 shrink-0` | `shrink-0 mt-1 size-3 text-muted-foreground` | 重排（分组顺序） |
| 65 | `components/admin/comments-page.tsx:315` | `inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-200 hover:text-primary/80` | `inline-flex gap-1 items-center text-xs font-medium text-primary transition-colors duration-200 hover:text-primary/80` | 重排（分组顺序） |
| 66 | `components/admin/comments-page.tsx:318` | `size-3 shrink-0` | `shrink-0 size-3` | 重排（分组顺序） |
| 67 | `components/admin/comments-page.tsx:334` | `text-xs whitespace-nowrap text-muted-foreground` | `text-xs text-muted-foreground whitespace-nowrap` | 重排（分组顺序） |
| 68 | `components/admin/comments-page.tsx:338` | `flex items-center justify-end gap-1.5` | `flex gap-1.5 justify-end items-center` | 重排（分组顺序） |
| 69 | `components/admin/comments-page.tsx:617` | `text-sm border-l-2 pl-3 text-muted-foreground italic` | `pl-3 text-sm italic text-muted-foreground border-l-2` | 重排（分组顺序） |
| 70 | `components/admin/meilisearch/embedders-tab.tsx:144` | `flex items-center justify-between gap-2` | `flex gap-2 justify-between items-center` | 重排（分组顺序） |
| 71 | `components/admin/meilisearch/embedders-tab.tsx:156` | `text-muted-foreground shrink-0` | `shrink-0 text-muted-foreground` | 重排（分组顺序） |
| 72 | `components/admin/meilisearch/embedders-tab.tsx:253` | `flex items-center gap-3` | `flex gap-3 items-center` | 重排（分组顺序） |
| 73 | `components/admin/meilisearch/indexes-tab.tsx:133` | `space-y-3 rounded-xl bg-muted/40 p-4 ring-1 ring-border/60` | `p-4 space-y-3 bg-muted/40 rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 74 | `components/admin/meilisearch/indexes-tab.tsx:150` | `p-4 bg-muted/50 rounded-lg space-y-3` | `p-4 space-y-3 bg-muted/50 rounded-lg` | 重排（分组顺序） |
| 75 | `components/admin/meilisearch/indexes-tab.tsx:176` | `flex items-center justify-between text-xs text-muted-foreground` | `flex justify-between items-center text-xs text-muted-foreground` | 重排（分组顺序） |
| 76 | `components/admin/meilisearch/indexes-tab.tsx:204` | `max-h-36 space-y-0.5 overflow-y-auto rounded-xl bg-muted/60 p-2.5 font-mono text-xs ring-1 ring-border/60` | `overflow-y-auto p-2.5 space-y-0.5 max-h-36 font-mono text-xs bg-muted/60 rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 77 | `components/admin/meilisearch/indexes-tab.tsx:212` | `flex items-start gap-1.5` | `flex gap-1.5 items-start` | 重排（分组顺序） |
| 78 | `components/admin/meilisearch/indexes-tab.tsx:214` | `text-muted-foreground/60 shrink-0` | `shrink-0 text-muted-foreground/60` | 重排（分组顺序） |
| 79 | `components/admin/meilisearch/indexes-tab.tsx:217` | `size-3 shrink-0 mt-0.5` | `shrink-0 mt-0.5 size-3` | 重排（分组顺序） |
| 80 | `components/admin/meilisearch/indexes-tab.tsx:226` | `text-xs text-muted-foreground py-2` | `py-2 text-xs text-muted-foreground` | 重排（分组顺序） |
| 81 | `components/admin/meilisearch/indexes-tab.tsx:261` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | `text-destructive-foreground bg-destructive hover:bg-destructive/90` | 重排（分组顺序） |
| 82 | `components/admin/meilisearch/indexes-tab.tsx:292` | `grid sm:grid-cols-2 lg:grid-cols-3 gap-4` | `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` | 重排（分组顺序） |
| 83 | `components/admin/meilisearch/indexes-tab.tsx:320` | `flex items-center gap-2.5 text-sm` | `flex gap-2.5 items-center text-sm` | 重排（分组顺序） |
| 84 | `components/admin/meilisearch/indexes-tab.tsx:327` | `flex items-center gap-2.5 text-sm` | `flex gap-2.5 items-center text-sm` | 重排（分组顺序） |
| 85 | `components/admin/meilisearch/overview-tab.tsx:89` | `grid grid-cols-2 md:grid-cols-4 gap-3` | `grid grid-cols-2 gap-3 md:grid-cols-4` | 重排（分组顺序） |
| 86 | `components/admin/meilisearch/overview-tab.tsx:146` | `flex items-center justify-between gap-4 py-1` | `flex gap-4 justify-between items-center py-1` | 重排（分组顺序） |
| 87 | `components/admin/meilisearch/overview-tab.tsx:147` | `flex items-center gap-3 min-w-0` | `flex gap-3 items-center min-w-0` | 重排（分组顺序） |
| 88 | `components/admin/meilisearch/properties-tab.tsx:85` | `flex items-center justify-between gap-2` | `flex gap-2 justify-between items-center` | 重排（分组顺序） |
| 89 | `components/admin/meilisearch/properties-tab.tsx:96` | `flex flex-wrap items-end gap-3` | `flex flex-wrap gap-3 items-end` | 重排（分组顺序） |
| 90 | `components/admin/meilisearch/properties-tab.tsx:99` | `font-medium text-foreground ml-1` | `ml-1 font-medium text-foreground` | 重排（分组顺序） |
| 91 | `components/admin/meilisearch/properties-tab.tsx:107` | `min-w-[200px] flex-1 space-y-1.5` | `flex-1 space-y-1.5 min-w-[200px]` | 重排（分组顺序） |
| 92 | `components/admin/meilisearch/properties-tab.tsx:129` | `flex items-center gap-3 text-xs text-muted-foreground` | `flex gap-3 items-center text-xs text-muted-foreground` | 重排（分组顺序） |
| 93 | `components/admin/meilisearch/properties-tab.tsx:151` | `flex max-h-[400px] flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-muted/30 p-3 ring-1 ring-border/60` | `flex overflow-y-auto flex-wrap gap-1.5 p-3 max-h-[400px] bg-muted/30 rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 94 | `components/admin/meilisearch/properties-tab.tsx:158` | `cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 95 | `components/admin/meilisearch/properties-tab.tsx:170` | `font-mono text-xs hover:bg-secondary/80 transition-colors` | `font-mono text-xs transition-colors hover:bg-secondary/80` | 重排（分组顺序） |
| 96 | `components/admin/meilisearch/searchable-tab.tsx:90` | `flex items-center gap-2 rounded-xl bg-background px-3 py-2 ring-1 ring-border/60` | `flex gap-2 items-center px-3 py-2 bg-background rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 97 | `components/admin/meilisearch/searchable-tab.tsx:93` | `cursor-grab touch-none shrink-0 rounded text-muted-foreground hover:text-foreground active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `shrink-0 text-muted-foreground rounded cursor-grab touch-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing` | 重排（分组顺序） |
| 98 | `components/admin/meilisearch/searchable-tab.tsx:105` | `size-7 text-muted-foreground hover:text-destructive shrink-0` | `shrink-0 size-7 text-muted-foreground hover:text-destructive` | 重排（分组顺序） |
| 99 | `components/admin/meilisearch/searchable-tab.tsx:260` | `flex items-center justify-between gap-2` | `flex gap-2 justify-between items-center` | 重排（分组顺序） |
| 100 | `components/admin/meilisearch/searchable-tab.tsx:265` | `text-xs bg-muted px-1 rounded` | `px-1 text-xs bg-muted rounded` | 重排（分组顺序） |
| 101 | `components/admin/meilisearch/searchable-tab.tsx:274` | `text-muted-foreground shrink-0` | `shrink-0 text-muted-foreground` | 重排（分组顺序） |
| 102 | `components/admin/meilisearch/searchable-tab.tsx:284` | `flex items-center gap-3 text-xs` | `flex gap-3 items-center text-xs` | 重排（分组顺序） |
| 103 | `components/admin/meilisearch/searchable-tab.tsx:287` | `font-medium text-foreground ml-1` | `ml-1 font-medium text-foreground` | 重排（分组顺序） |
| 104 | `components/admin/meilisearch/searchable-tab.tsx:299` | `text-muted-foreground inline-flex items-center gap-1` | `inline-flex gap-1 items-center text-muted-foreground` | 重排（分组顺序） |
| 105 | `components/admin/meilisearch/searchable-tab.tsx:310` | `flex items-center justify-between` | `flex justify-between items-center` | 重排（分组顺序） |
| 106 | `components/admin/meilisearch/searchable-tab.tsx:313` | `text-xs text-muted-foreground ml-2 font-normal` | `ml-2 text-xs font-normal text-muted-foreground` | 重排（分组顺序） |
| 107 | `components/admin/meilisearch/searchable-tab.tsx:331` | `max-h-80 space-y-1.5 overflow-y-auto rounded-xl bg-muted/30 p-2 ring-1 ring-border/60` | `overflow-y-auto p-2 space-y-1.5 max-h-80 bg-muted/30 rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 108 | `components/admin/meilisearch/searchable-tab.tsx:346` | `flex items-end gap-2` | `flex gap-2 items-end` | 重排（分组顺序） |
| 109 | `components/admin/meilisearch/searchable-tab.tsx:389` | `flex items-center gap-3` | `flex gap-3 items-center` | 重排（分组顺序） |
| 110 | `components/admin/meilisearch/shared.tsx:22` | `flex items-center gap-2 text-muted-foreground py-8 justify-center` | `flex gap-2 justify-center items-center py-8 text-muted-foreground` | 重排（分组顺序） |
| 111 | `components/admin/meilisearch/shared.tsx:31` | `space-y-3 p-6` | `p-6 space-y-3` | 重排（分组顺序） |
| 112 | `components/admin/meilisearch/shared.tsx:32` | `h-5 w-1/3` | `w-1/3 h-5` | 重排（分组顺序） |
| 113 | `components/admin/meilisearch/shared.tsx:33` | `h-4 w-2/3` | `w-2/3 h-4` | 重排（分组顺序） |
| 114 | `components/admin/meilisearch/shared.tsx:35` | `h-10 w-full` | `w-full h-10` | 重排（分组顺序） |
| 115 | `components/admin/meilisearch/shared.tsx:43` | `grid grid-cols-2 md:grid-cols-4 gap-4` | `grid grid-cols-2 gap-4 md:grid-cols-4` | 重排（分组顺序） |
| 116 | `components/admin/meilisearch/shared.tsx:46` | `h-3 w-16` | `w-16 h-3` | 重排（分组顺序） |
| 117 | `components/admin/meilisearch/shared.tsx:47` | `h-7 w-20` | `w-20 h-7` | 重排（分组顺序） |
| 118 | `components/admin/meilisearch/shared.tsx:64` | `flex flex-col items-center gap-3 py-8 text-center` | `flex flex-col gap-3 items-center py-8 text-center` | 重排（分组顺序） |
| 119 | `components/admin/meilisearch/shared.tsx:68` | `text-sm text-muted-foreground mt-0.5 max-w-sm` | `mt-0.5 max-w-sm text-sm text-muted-foreground` | 重排（分组顺序） |
| 120 | `components/admin/meilisearch/shared.tsx:140` | `flex items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-border/60` | `flex gap-3 items-start p-4 bg-card rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 121 | `components/admin/meilisearch/shared.tsx:167` | `flex items-start justify-between gap-4` | `flex gap-4 justify-between items-start` | 重排（分组顺序） |
| 122 | `components/admin/meilisearch/shared.tsx:171` | `text-xs text-muted-foreground mt-0.5` | `mt-0.5 text-xs text-muted-foreground` | 重排（分组顺序） |
| 123 | `components/admin/tasks-page.tsx:216` | `flex items-center gap-3 p-4` | `flex gap-3 items-center p-4` | 重排（分组顺序） |
| 124 | `components/admin/tasks-page.tsx:236` | `flex items-center gap-2.5 text-base` | `flex gap-2.5 items-center text-base` | 重排（分组顺序） |
| 125 | `components/admin/tasks-page.tsx:248` | `flex flex-col gap-1.5 rounded-xl p-3 ring-1 ring-border/60` | `flex flex-col gap-1.5 p-3 rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 126 | `components/admin/tasks-page.tsx:250` | `flex items-center gap-1.5` | `flex gap-1.5 items-center` | 重排（分组顺序） |
| 127 | `components/admin/tasks-page.tsx:255` | `animate-pulse bg-success` | `bg-success animate-pulse` | 重排（分组顺序） |
| 128 | `components/admin/tasks-page.tsx:265` | `flex items-center gap-3 text-xs text-muted-foreground` | `flex gap-3 items-center text-xs text-muted-foreground` | 重排（分组顺序） |
| 129 | `components/admin/tasks-page.tsx:340` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 130 | `components/admin/tasks-page.tsx:349` | `flex-1 overflow-y-auto px-4 pb-4 space-y-4` | `overflow-y-auto flex-1 px-4 pb-4 space-y-4` | 重排（分组顺序） |
| 131 | `components/admin/tasks-page.tsx:353` | `text-muted-foreground text-xs` | `text-xs text-muted-foreground` | 重排（分组顺序） |
| 132 | `components/admin/tasks-page.tsx:359` | `text-muted-foreground text-xs` | `text-xs text-muted-foreground` | 重排（分组顺序） |
| 133 | `components/admin/tasks-page.tsx:363` | `text-muted-foreground text-xs` | `text-xs text-muted-foreground` | 重排（分组顺序） |
| 134 | `components/admin/tasks-page.tsx:367` | `text-muted-foreground text-xs` | `text-xs text-muted-foreground` | 重排（分组顺序） |
| 135 | `components/admin/tasks-page.tsx:372` | `text-muted-foreground text-xs` | `text-xs text-muted-foreground` | 重排（分组顺序） |
| 136 | `components/admin/tasks-page.tsx:378` | `text-muted-foreground text-xs` | `text-xs text-muted-foreground` | 重排（分组顺序） |
| 137 | `components/admin/tasks-page.tsx:386` | `flex items-center justify-between text-xs text-muted-foreground` | `flex justify-between items-center text-xs text-muted-foreground` | 重排（分组顺序） |
| 138 | `components/admin/tasks-page.tsx:395` | `rounded-xl bg-destructive/10 p-3 text-sm text-destructive ring-1 ring-destructive/20` | `p-3 text-sm text-destructive bg-destructive/10 rounded-xl ring-1 ring-destructive/20` | 重排（分组顺序） |
| 139 | `components/admin/tasks-page.tsx:396` | `font-medium flex items-center gap-1` | `flex gap-1 items-center font-medium` | 重排（分组顺序） |
| 140 | `components/admin/tasks-page.tsx:442` | `rounded-xl bg-muted/60 p-3 text-xs` | `p-3 text-xs bg-muted/60 rounded-xl` | 重排（分组顺序） |
| 141 | `components/admin/tasks-page.tsx:443` | `font-medium text-muted-foreground mb-1` | `mb-1 font-medium text-muted-foreground` | 重排（分组顺序） |
| 142 | `components/admin/tasks-page.tsx:444` | `break-all whitespace-pre-wrap font-mono` | `font-mono break-all whitespace-pre-wrap` | 重排（分组顺序） |
| 143 | `components/admin/tasks-page.tsx:452` | `text-sm font-medium mb-2` | `mb-2 text-sm font-medium` | 重排（分组顺序） |
| 144 | `components/admin/tasks-page.tsx:454` | `flex items-center gap-2 text-muted-foreground text-sm py-4` | `flex gap-2 items-center py-4 text-sm text-muted-foreground` | 重排（分组顺序） |
| 145 | `components/admin/tasks-page.tsx:459` | `max-h-80 space-y-1 overflow-y-auto rounded-xl bg-muted/60 p-3 font-mono text-xs` | `overflow-y-auto p-3 space-y-1 max-h-80 font-mono text-xs bg-muted/60 rounded-xl` | 重排（分组顺序） |
| 146 | `components/admin/tasks-page.tsx:466` | `flex items-start gap-1.5` | `flex gap-1.5 items-start` | 重排（分组顺序） |
| 147 | `components/admin/tasks-page.tsx:468` | `text-muted-foreground/60 shrink-0` | `shrink-0 text-muted-foreground/60` | 重排（分组顺序） |
| 148 | `components/admin/tasks-page.tsx:471` | `size-3 shrink-0 mt-0.5` | `shrink-0 mt-0.5 size-3` | 重排（分组顺序） |
| 149 | `components/admin/tasks-page.tsx:631` | `flex items-center gap-2.5 text-base` | `flex gap-2.5 items-center text-base` | 重排（分组顺序） |
| 150 | `components/admin/tasks-page.tsx:664` | `flex flex-wrap items-center justify-between gap-3` | `flex flex-wrap gap-3 justify-between items-center` | 重排（分组顺序） |
| 151 | `components/admin/tasks-page.tsx:665` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 152 | `components/admin/tasks-page.tsx:666` | `text-base flex items-center gap-2` | `flex gap-2 items-center text-base` | 重排（分组顺序） |
| 153 | `components/admin/tasks-page.tsx:675` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 154 | `components/admin/tasks-page.tsx:720` | `text-xs text-muted-foreground tabular-nums` | `text-xs tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 155 | `components/admin/tasks-page.tsx:770` | `rounded text-left focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 156 | `components/admin/tasks-page.tsx:776` | `text-xs text-muted-foreground font-mono truncate` | `font-mono text-xs text-muted-foreground truncate` | 重排（分组顺序） |
| 157 | `components/admin/tasks-page.tsx:787` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 158 | `components/admin/tasks-page.tsx:790` | `h-2 flex-1` | `flex-1 h-2` | 重排（分组顺序） |
| 159 | `components/admin/tasks-page.tsx:792` | `text-xs text-muted-foreground tabular-nums w-8 text-right` | `w-8 text-xs tabular-nums text-right text-muted-foreground` | 重排（分组顺序） |
| 160 | `components/admin/tasks-page.tsx:797` | `text-xs whitespace-nowrap text-muted-foreground` | `text-xs text-muted-foreground whitespace-nowrap` | 重排（分组顺序） |
| 161 | `components/admin/tasks-page.tsx:801` | `flex items-center justify-end gap-1` | `flex gap-1 justify-end items-center` | 重排（分组顺序） |
| 162 | `components/admin/topics-page.tsx:194` | `inline-flex items-center gap-1 rounded text-sm font-medium text-primary transition-colors duration-200 hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `inline-flex gap-1 items-center text-sm font-medium text-primary rounded transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 163 | `components/admin/topics-page.tsx:197` | `size-3 shrink-0` | `shrink-0 size-3` | 重排（分组顺序） |
| 164 | `components/admin/topics-page.tsx:208` | `text-xs whitespace-nowrap text-muted-foreground` | `text-xs text-muted-foreground whitespace-nowrap` | 重排（分组顺序） |
| 165 | `components/admin/topics-page.tsx:212` | `flex items-center justify-end gap-1.5` | `flex gap-1.5 justify-end items-center` | 重排（分组顺序） |
| 166 | `components/admin/topics-page.tsx:412` | `text-sm border-l-2 pl-3 text-muted-foreground italic` | `pl-3 text-sm italic text-muted-foreground border-l-2` | 重排（分组顺序） |
| 167 | `components/admin/users-page.tsx:201` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 168 | `components/admin/users-page.tsx:209` | `size-7 rounded-full bg-muted flex items-center justify-center` | `flex justify-center items-center size-7 bg-muted rounded-full` | 重排（分组顺序） |
| 169 | `components/admin/users-page.tsx:222` | `text-sm text-muted-foreground break-all cursor-default` | `text-sm break-all text-muted-foreground cursor-default` | 重排（分组顺序） |
| 170 | `components/admin/users-page.tsx:251` | `flex items-center justify-end gap-1.5` | `flex gap-1.5 justify-end items-center` | 重排（分组顺序） |
| 171 | `components/admin/users-page.tsx:386` | `size-4 animate-spin mr-1` | `mr-1 size-4 animate-spin` | 重排（分组顺序） |
| 172 | `components/admin/users-page.tsx:388` | `size-4 mr-1` | `mr-1 size-4` | 重排（分组顺序） |
| 173 | `components/admin/users-page.tsx:471` | `size-4 animate-spin mr-1` | `mr-1 size-4 animate-spin` | 重排（分组顺序） |
| 174 | `components/admin/users-page.tsx:563` | `size-4 animate-spin mr-1` | `mr-1 size-4 animate-spin` | 重排（分组顺序） |
| 175 | `components/admin/users-page.tsx:666` | `size-4 animate-spin mr-1` | `mr-1 size-4 animate-spin` | 重排（分组顺序） |
| 176 | `components/admin/users-page.tsx:773` | `inline-flex items-center gap-1` | `inline-flex gap-1 items-center` | 重排（分组顺序） |
| 177 | `components/admin/users-page.tsx:774` | `font-mono text-destructive select-all break-all` | `font-mono break-all text-destructive select-all` | 重排（分组顺序） |
| 178 | `components/admin/users-page.tsx:779` | `inline-flex items-center justify-center size-5 rounded hover:bg-muted transition-colors` | `inline-flex justify-center items-center size-5 rounded transition-colors hover:bg-muted` | 重排（分组顺序） |
| 179 | `components/admin/users-page.tsx:812` | `size-4 animate-spin mr-1` | `mr-1 size-4 animate-spin` | 重排（分组顺序） |
| 180 | `components/admin/vndb-sync-page.tsx:189` | `flex items-center gap-2.5 text-base` | `flex gap-2.5 items-center text-base` | 重排（分组顺序） |
| 181 | `components/admin/vndb-sync-page.tsx:246` | `inline-flex items-center gap-1 text-xs text-muted-foreground` | `inline-flex gap-1 items-center text-xs text-muted-foreground` | 重排（分组顺序） |
| 182 | `components/admin/vndb-sync-page.tsx:258` | `flex items-center gap-2.5 text-base` | `flex gap-2.5 items-center text-base` | 重排（分组顺序） |
| 183 | `components/admin/vndb-sync-page.tsx:265` | `grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 text-sm` | `grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 lg:grid-cols-7` | 重排（分组顺序） |
| 184 | `components/admin/vndb-sync-page.tsx:342` | `flex items-center gap-2.5 text-base` | `flex gap-2.5 items-center text-base` | 重排（分组顺序） |
| 185 | `components/admin/vndb-sync-page.tsx:358` | `flex items-center gap-2 text-muted-foreground` | `flex gap-2 items-center text-muted-foreground` | 重排（分组顺序） |
| 186 | `components/admin/vndb-sync-page.tsx:364` | `grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm` | `grid grid-cols-2 gap-4 text-sm sm:grid-cols-4` | 重排（分组顺序） |
| 187 | `components/admin/vndb-sync-page.tsx:430` | `max-h-96 space-y-1 overflow-y-auto rounded-xl bg-muted/60 p-4 font-mono text-xs` | `overflow-y-auto p-4 space-y-1 max-h-96 font-mono text-xs bg-muted/60 rounded-xl` | 重排（分组顺序） |
| 188 | `components/admin/vndb-sync-page.tsx:441` | `size-3 inline mr-1` | `inline mr-1 size-3` | 重排（分组顺序） |
| 189 | `components/admin/vndb-sync-page.tsx:472` | `flex flex-col gap-3 border-t pt-4` | `flex flex-col gap-3 pt-4 border-t` | 重排（分组顺序） |
| 190 | `components/admin/vndb-sync-page.tsx:503` | `max-h-48 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs flex flex-col gap-2` | `flex overflow-y-auto flex-col gap-2 p-3 max-h-48 font-mono text-xs bg-muted rounded-lg` | 重排（分组顺序） |
| 191 | `components/admin/vndb-sync-page.tsx:523` | `max-h-48 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs flex flex-col gap-2` | `flex overflow-y-auto flex-col gap-2 p-3 max-h-48 font-mono text-xs bg-muted rounded-lg` | 重排（分组顺序） |
| 192 | `components/admin/vndb-sync-page.tsx:541` | `max-h-40 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs flex flex-col gap-1` | `flex overflow-y-auto flex-col gap-1 p-3 max-h-40 font-mono text-xs bg-muted rounded-lg` | 重排（分组顺序） |
| 193 | `components/admin/vndb-sync-page.tsx:557` | `max-h-40 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs flex flex-col gap-1` | `flex overflow-y-auto flex-col gap-1 p-3 max-h-40 font-mono text-xs bg-muted rounded-lg` | 重排（分组顺序） |
| 194 | `components/admin/vndb-sync-page.tsx:583` | `max-h-32 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs flex flex-wrap gap-x-2 gap-y-1` | `flex overflow-y-auto flex-wrap gap-x-2 gap-y-1 p-3 max-h-32 font-mono text-xs bg-muted rounded-lg` | 重排（分组顺序） |
| 195 | `components/animate-ui/components/radix/accordion.tsx:103` | `flex flex-1 text-start items-center justify-between py-4 font-medium hover:underline` | `flex flex-1 justify-between items-center py-4 font-medium text-start hover:underline` | 重排（分组顺序） |
| 196 | `components/animate-ui/components/radix/accordion.tsx:116` | `size-5 shrink-0` | `shrink-0 size-5` | 重排（分组顺序） |
| 197 | `components/animate-ui/components/radix/accordion.tsx:158` | `pb-4 pt-0 text-sm` | `pt-0 pb-4 text-sm` | 重排（分组顺序） |
| 198 | `components/animate-ui/components/radix/dialog.tsx:71` | `bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg sm:max-w-lg` | `grid fixed top-[50%] left-[50%] z-50 gap-4 p-6 w-full max-w-[calc(100%-2rem)] bg-background rounded-lg border shadow-lg translate-x-[-50%] translate-y-[-50%] sm:max-w-lg` | 重排（分组顺序） |
| 199 | `components/animate-ui/components/radix/dialog.tsx:78` | `ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `absolute top-4 right-4 rounded-xs ring-offset-background opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:pointer-events-none data-[state=open]:text-muted-foreground data-[state=open]:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 200 | `components/animate-ui/components/radix/dialog.tsx:129` | `text-muted-foreground text-sm` | `text-sm text-muted-foreground` | 重排（分组顺序） |
| 201 | `components/animate-ui/components/radix/dropdown-menu.tsx:61` | `bg-popover text-popover-foreground z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md` | `overflow-x-hidden overflow-y-auto z-50 p-1 min-w-[8rem] max-h-(--radix-dropdown-menu-content-available-height) text-popover-foreground bg-popover rounded-md border shadow-md origin-(--radix-dropdown-menu-content-transform-origin)` | 重排（分组顺序） |
| 202 | `components/animate-ui/components/radix/dropdown-menu.tsx:66` | `absolute inset-0 bg-accent z-0 rounded-sm` | `absolute inset-0 z-0 bg-accent rounded-sm` | 重排（分组顺序） |
| 203 | `components/animate-ui/components/radix/dropdown-menu.tsx:98` | `focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `flex relative gap-2 items-center px-2 py-1.5 text-sm rounded-sm outline-hidden cursor-default select-none focus:text-accent-foreground data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 204 | `components/animate-ui/components/radix/dropdown-menu.tsx:121` | `focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `flex relative gap-2 items-center py-1.5 pr-2 pl-8 text-sm rounded-sm outline-hidden cursor-default select-none focus:text-accent-foreground data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 205 | `components/animate-ui/components/radix/dropdown-menu.tsx:127` | `pointer-events-none absolute left-2 flex size-3.5 items-center justify-center` | `flex absolute left-2 justify-center items-center size-3.5 pointer-events-none` | 重排（分组顺序） |
| 206 | `components/animate-ui/components/radix/dropdown-menu.tsx:160` | `focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `flex relative gap-2 items-center py-1.5 pr-2 pl-8 text-sm rounded-sm outline-hidden cursor-default select-none focus:text-accent-foreground data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 207 | `components/animate-ui/components/radix/dropdown-menu.tsx:165` | `pointer-events-none absolute left-2 flex size-3.5 items-center justify-center` | `flex absolute left-2 justify-center items-center size-3.5 pointer-events-none` | 重排（分组顺序） |
| 208 | `components/animate-ui/components/radix/dropdown-menu.tsx:205` | `bg-border -mx-1 my-1 h-px` | `-mx-1 my-1 h-px bg-border` | 重排（分组顺序） |
| 209 | `components/animate-ui/components/radix/dropdown-menu.tsx:220` | `text-muted-foreground ml-auto text-xs tracking-widest` | `ml-auto text-xs tracking-widest text-muted-foreground` | 重排（分组顺序） |
| 210 | `components/animate-ui/components/radix/dropdown-menu.tsx:249` | `focus:text-accent-foreground data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8` | `flex items-center px-2 py-1.5 text-sm rounded-sm outline-hidden cursor-default select-none focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:text-accent-foreground` | 重排（分组顺序） |
| 211 | `components/animate-ui/components/radix/dropdown-menu.tsx:271` | `bg-popover text-popover-foreground z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg` | `overflow-hidden z-50 p-1 min-w-[8rem] text-popover-foreground bg-popover rounded-md border shadow-lg origin-(--radix-dropdown-menu-content-transform-origin)` | 重排（分组顺序） |
| 212 | `components/animate-ui/components/radix/files.tsx:65` | `flex items-center justify-between gap-2 p-2 pointer-events-none` | `flex gap-2 justify-between items-center p-2 pointer-events-none` | 重排（分组顺序） |
| 213 | `components/animate-ui/components/radix/files.tsx:68` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 214 | `components/animate-ui/components/radix/files.tsx:89` | `rounded-full size-2` | `size-2 rounded-full` | 重排（分组顺序） |
| 215 | `components/animate-ui/components/radix/files.tsx:107` | `relative ml-6 before:absolute before:-left-2 before:inset-y-0 before:w-px before:h-full before:bg-border` | `relative ml-6 before:absolute before:inset-y-0 before:-left-2 before:w-px before:h-full before:bg-border` | 重排（分组顺序） |
| 216 | `components/animate-ui/components/radix/files.tsx:131` | `flex items-center justify-between gap-2 p-2` | `flex gap-2 justify-between items-center p-2` | 重排（分组顺序） |
| 217 | `components/animate-ui/components/radix/files.tsx:139` | `flex items-center gap-2 pointer-events-none` | `flex gap-2 items-center pointer-events-none` | 重排（分组顺序） |
| 218 | `components/animate-ui/components/radix/progress.tsx:23` | `relative h-2 w-full overflow-hidden rounded-full bg-secondary` | `overflow-hidden relative w-full h-2 bg-secondary rounded-full` | 重排（分组顺序） |
| 219 | `components/animate-ui/components/radix/progress.tsx:31` | `h-full w-full flex-1 bg-primary rounded-full` | `flex-1 w-full h-full bg-primary rounded-full` | 重排（分组顺序） |
| 220 | `components/animate-ui/components/radix/radio-group.tsx:40` | `flex items-center justify-center` | `flex justify-center items-center` | 重排（分组顺序） |
| 221 | `components/animate-ui/components/radix/radio-group.tsx:52` | `size-3 fill-current text-current` | `size-3 text-current fill-current` | 重排（分组顺序） |
| 222 | `components/animate-ui/components/radix/radio-group.tsx:75` | `aspect-square size-5 rounded-full flex items-center justify-center border border-input text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50` | `flex aspect-square justify-center items-center size-5 text-primary rounded-full border border-input ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed` | 重排（分组顺序） |
| 223 | `components/animate-ui/components/radix/sheet.tsx:97` | `fixed z-50 gap-4 bg-background p-6 shadow-lg` | `fixed z-50 gap-4 p-6 bg-background shadow-lg` | 重排（分组顺序） |
| 224 | `components/animate-ui/components/radix/sheet.tsx:102` | `inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm` | `inset-y-0 left-0 w-3/4 h-full border-r sm:max-w-sm` | 重排（分组顺序） |
| 225 | `components/animate-ui/components/radix/sheet.tsx:103` | `inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm` | `inset-y-0 right-0 w-3/4 h-full border-l sm:max-w-sm` | 重排（分组顺序） |
| 226 | `components/animate-ui/components/radix/sheet.tsx:175` | `absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary` | `absolute top-4 right-4 rounded-sm ring-offset-background opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:pointer-events-none data-[state=open]:bg-secondary` | 重排（分组顺序） |
| 227 | `components/animate-ui/components/radix/sheet.tsx:177` | `h-4 w-4` | `w-4 h-4` | 重排（分组顺序） |
| 228 | `components/animate-ui/components/radix/sidebar.tsx:147` | `group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full` | `group/sidebar-wrapper flex w-full min-h-svh has-data-[variant=inset]:bg-sidebar` | 重排（分组顺序） |
| 229 | `components/animate-ui/components/radix/sidebar.tsx:194` | `bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col` | `flex flex-col w-(--sidebar-width) h-full text-sidebar-foreground bg-sidebar` | 重排（分组顺序） |
| 230 | `components/animate-ui/components/radix/sidebar.tsx:212` | `bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden` | `p-0 w-(--sidebar-width) text-sidebar-foreground bg-sidebar [&>button]:hidden` | 重排（分组顺序） |
| 231 | `components/animate-ui/components/radix/sidebar.tsx:232` | `flex h-full w-full flex-col` | `flex flex-col w-full h-full` | 重排（分组顺序） |
| 232 | `components/animate-ui/components/radix/sidebar.tsx:241` | `group peer text-sidebar-foreground hidden md:block` | `group peer hidden text-sidebar-foreground md:block` | 重排（分组顺序） |
| 233 | `components/animate-ui/components/radix/sidebar.tsx:263` | `fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-400 ease-[cubic-bezier(0.75,0,0.25,1)] md:flex` | `hidden fixed inset-y-0 z-10 w-(--sidebar-width) h-svh transition-[left,right,width] duration-400 ease-[cubic-bezier(0.75,0,0.25,1)] md:flex` | 重排（分组顺序） |
| 234 | `components/animate-ui/components/radix/sidebar.tsx:287` | `bg-sidebar group-data-[variant=floating]:border-sidebar-border flex size-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm` | `flex flex-col size-full bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm` | 重排（分组顺序） |
| 235 | `components/animate-ui/components/radix/sidebar.tsx:335` | `hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex` | `hidden absolute inset-y-0 z-20 w-4 transition-all ease-linear -translate-x-1/2 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex` | 重排（分组顺序） |
| 236 | `components/animate-ui/components/radix/sidebar.tsx:355` | `bg-background relative flex w-full flex-1 flex-col` | `flex relative flex-col flex-1 w-full bg-background` | 重排（分组顺序） |
| 237 | `components/animate-ui/components/radix/sidebar.tsx:371` | `bg-background h-8 w-full shadow-none` | `w-full h-8 bg-background shadow-none` | 重排（分组顺序） |
| 238 | `components/animate-ui/components/radix/sidebar.tsx:410` | `bg-sidebar-border mx-2 w-auto` | `mx-2 w-auto bg-sidebar-border` | 重排（分组顺序） |
| 239 | `components/animate-ui/components/radix/sidebar.tsx:424` | `flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden` | `flex overflow-auto flex-col flex-1 gap-2 min-h-0 group-data-[collapsible=icon]:overflow-hidden` | 重排（分组顺序） |
| 240 | `components/animate-ui/components/radix/sidebar.tsx:439` | `relative flex w-full min-w-0 flex-col p-2` | `flex relative flex-col p-2 w-full min-w-0` | 重排（分组顺序） |
| 241 | `components/animate-ui/components/radix/sidebar.tsx:453` | `text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-300 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0` | `flex shrink-0 items-center px-2 h-8 text-xs font-medium text-sidebar-foreground/70 rounded-md outline-hidden ring-sidebar-ring transition-[margin,opacity] duration-300 ease-linear focus-visible:ring-2 [&>svg]:shrink-0 [&>svg]:size-4` | 重排（分组顺序） |
| 242 | `components/animate-ui/components/radix/sidebar.tsx:470` | `text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0` | `flex absolute top-3.5 right-3 aspect-square justify-center items-center p-0 w-5 text-sidebar-foreground rounded-md outline-hidden ring-sidebar-ring transition-transform hover:text-sidebar-accent-foreground hover:bg-sidebar-accent focus-visible:ring-2 [&>svg]:shrink-0 [&>svg]:size-4` | 重排（分组顺序） |
| 243 | `components/animate-ui/components/radix/sidebar.tsx:504` | `flex w-full min-w-0 flex-col gap-1` | `flex flex-col gap-1 w-full min-w-0` | 重排（分组顺序） |
| 244 | `components/animate-ui/components/radix/sidebar.tsx:524` | `bg-sidebar-accent text-sidebar-accent-foreground rounded-md` | `text-sidebar-accent-foreground bg-sidebar-accent rounded-md` | 重排（分组顺序） |
| 245 | `components/animate-ui/components/radix/sidebar.tsx:528` | `bg-sidebar-accent text-sidebar-accent-foreground` | `text-sidebar-accent-foreground bg-sidebar-accent` | 重排（分组顺序） |
| 246 | `components/animate-ui/components/radix/sidebar.tsx:530` | `bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]` | `text-sidebar-accent-foreground bg-sidebar-accent shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]` | 重排（分组顺序） |
| 247 | `components/animate-ui/components/radix/sidebar.tsx:540` | `peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] [&:not([data-highlight])]:hover:bg-sidebar-accent [&:not([data-highlight])]:hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground [&:not([data-highlight])]:data-[state=open]:hover:bg-sidebar-accent [&:not([data-highlight])]:data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0` | `peer/menu-button flex overflow-hidden gap-2 items-center p-2 w-full text-sm text-left rounded-md outline-hidden ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 active:text-sidebar-accent-foreground active:bg-sidebar-accent disabled:opacity-50 disabled:pointer-events-none group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:size-8! group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:opacity-50 aria-disabled:pointer-events-none data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent [&>span:last-child]:truncate [&>svg]:shrink-0 [&>svg]:size-4 [&:not([data-highlight])]:hover:text-sidebar-accent-foreground [&:not([data-highlight])]:hover:bg-sidebar-accent [&:not([data-highlight])]:data-[state=open]:hover:text-sidebar-accent-foreground [&:not([data-highlight])]:data-[state=open]:hover:bg-sidebar-accent` | 重排（分组顺序） |
| 248 | `components/animate-ui/components/radix/sidebar.tsx:545` | `[&:not([data-highlight])]:hover:bg-sidebar-accent [&:not([data-highlight])]:hover:text-sidebar-accent-foreground` | `[&:not([data-highlight])]:hover:text-sidebar-accent-foreground [&:not([data-highlight])]:hover:bg-sidebar-accent` | 重排（分组顺序） |
| 249 | `components/animate-ui/components/radix/sidebar.tsx:547` | `bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] [&:not([data-highlight])]:hover:bg-sidebar-accent [&:not([data-highlight])]:hover:text-sidebar-accent-foreground [&:not([data-highlight])]:hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]` | `bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] [&:not([data-highlight])]:hover:text-sidebar-accent-foreground [&:not([data-highlight])]:hover:bg-sidebar-accent [&:not([data-highlight])]:hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]` | 重排（分组顺序） |
| 250 | `components/animate-ui/components/radix/sidebar.tsx:630` | `z-[1] text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0` | `flex absolute top-1.5 right-1 z-[1] aspect-square justify-center items-center p-0 w-5 text-sidebar-foreground rounded-md outline-hidden ring-sidebar-ring transition-transform hover:text-sidebar-accent-foreground hover:bg-sidebar-accent focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:shrink-0 [&>svg]:size-4` | 重排（分组顺序） |
| 251 | `components/animate-ui/components/radix/sidebar.tsx:637` | `peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0` | `group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground data-[state=open]:opacity-100 md:opacity-0` | 重排（分组顺序） |
| 252 | `components/animate-ui/components/radix/sidebar.tsx:653` | `text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none` | `flex absolute right-1 justify-center items-center px-1 min-w-5 h-5 text-xs font-medium tabular-nums text-sidebar-foreground rounded-md pointer-events-none select-none` | 重排（分组顺序） |
| 253 | `components/animate-ui/components/radix/sidebar.tsx:654` | `peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground` | `peer-data-[active=true]/menu-button:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground` | 重排（分组顺序） |
| 254 | `components/animate-ui/components/radix/sidebar.tsx:684` | `flex h-8 items-center gap-2 rounded-md px-2` | `flex gap-2 items-center px-2 h-8 rounded-md` | 重排（分组顺序） |
| 255 | `components/animate-ui/components/radix/sidebar.tsx:694` | `h-4 max-w-(--skeleton-width) flex-1` | `flex-1 max-w-(--skeleton-width) h-4` | 重排（分组顺序） |
| 256 | `components/animate-ui/components/radix/sidebar.tsx:714` | `border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5` | `flex flex-col gap-1 px-2.5 py-0.5 mx-3.5 min-w-0 border-l border-sidebar-border translate-x-px` | 重排（分组顺序） |
| 257 | `components/animate-ui/components/radix/sidebar.tsx:748` | `bg-sidebar-accent text-sidebar-accent-foreground rounded-md` | `text-sidebar-accent-foreground bg-sidebar-accent rounded-md` | 重排（分组顺序） |
| 258 | `components/animate-ui/components/radix/sidebar.tsx:755` | `text-sidebar-foreground ring-sidebar-ring [&:not([data-highlight])]:hover:bg-sidebar-accent [&:not([data-highlight])]:hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0` | `flex overflow-hidden gap-2 items-center px-2 min-w-0 h-7 text-sidebar-foreground rounded-md outline-hidden ring-sidebar-ring -translate-x-px focus-visible:ring-2 active:text-sidebar-accent-foreground active:bg-sidebar-accent disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none [&>span:last-child]:truncate [&>svg]:shrink-0 [&>svg]:size-4 [&>svg]:text-sidebar-accent-foreground [&:not([data-highlight])]:hover:text-sidebar-accent-foreground [&:not([data-highlight])]:hover:bg-sidebar-accent` | 重排（分组顺序） |
| 259 | `components/animate-ui/components/radix/sidebar.tsx:756` | `data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground` | `data-[active=true]:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent` | 重排（分组顺序） |
| 260 | `components/animate-ui/components/radix/switch.tsx:49` | `relative flex p-[3px] h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input data-[state=checked]:justify-end data-[state=unchecked]:justify-start` | `flex relative shrink-0 items-center p-[3px] w-10 h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed data-[state=checked]:justify-end data-[state=checked]:bg-primary data-[state=unchecked]:justify-start data-[state=unchecked]:bg-input` | 重排（分组顺序） |
| 261 | `components/animate-ui/components/radix/switch.tsx:65` | `absolute [&_svg]:size-3 left-1 top-1/2 -translate-y-1/2 dark:text-neutral-500 text-neutral-400` | `absolute top-1/2 left-1 text-neutral-400 -translate-y-1/2 dark:text-neutral-500 [&_svg]:size-3` | 重排（分组顺序） |
| 262 | `components/animate-ui/components/radix/switch.tsx:78` | `absolute [&_svg]:size-3 right-1 top-1/2 -translate-y-1/2 dark:text-neutral-400 text-neutral-500` | `absolute top-1/2 right-1 text-neutral-500 -translate-y-1/2 dark:text-neutral-400 [&_svg]:size-3` | 重排（分组顺序） |
| 263 | `components/animate-ui/components/radix/switch.tsx:91` | `relative z-[1] [&_svg]:size-3 flex items-center justify-center rounded-full bg-background shadow-lg ring-0 dark:text-neutral-400 text-neutral-500` | `flex relative z-[1] justify-center items-center text-neutral-500 bg-background rounded-full ring-0 shadow-lg dark:text-neutral-400 [&_svg]:size-3` | 重排（分组顺序） |
| 264 | `components/animate-ui/components/radix/tooltip.tsx:120` | `relative bg-primary text-primary-foreground shadow-md w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-sm text-balance` | `relative px-3 py-1.5 w-fit text-sm text-balance text-primary-foreground bg-primary rounded-md shadow-md origin-(--radix-tooltip-content-transform-origin)` | 重排（分组顺序） |
| 265 | `components/animate-ui/components/radix/tooltip.tsx:129` | `bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]` | `z-50 size-2.5 bg-primary rounded-[2px] translate-y-[calc(-50%-2px)] rotate-45 fill-primary` | 重排（分组顺序） |
| 266 | `components/animate-ui/effects/motion-highlight.tsx:261` | `absolute bg-muted z-0` | `absolute z-0 bg-muted` | 重排（分组顺序） |
| 267 | `components/animate-ui/effects/motion-highlight.tsx:504` | `absolute inset-0 bg-muted z-0` | `absolute inset-0 z-0 bg-muted` | 重排（分组顺序） |
| 268 | `components/animate-ui/effects/motion-highlight.tsx:563` | `absolute inset-0 bg-muted z-0` | `absolute inset-0 z-0 bg-muted` | 重排（分组顺序） |
| 269 | `components/animate-ui/text/sliding-number.tsx:43` | `relative inline-block w-[1ch] overflow-x-visible overflow-y-clip leading-none tabular-nums` | `inline-block overflow-x-visible overflow-y-clip relative w-[1ch] tabular-nums leading-none` | 重排（分组顺序） |
| 270 | `components/animate-ui/text/sliding-number.tsx:82` | `invisible absolute` | `absolute invisible` | 重排（分组顺序） |
| 271 | `components/animate-ui/text/sliding-number.tsx:89` | `absolute inset-0 flex items-center justify-center` | `flex absolute inset-0 justify-center items-center` | 重排（分组顺序） |
| 272 | `components/auth/brand-mark.tsx:11` | `mb-1 flex items-center justify-center gap-2` | `flex gap-2 justify-center items-center mb-1` | 重排（分组顺序） |
| 273 | `components/auth/brand-mark.tsx:13` | `flex size-7 items-center justify-center` | `flex justify-center items-center size-7` | 重排（分组顺序） |
| 274 | `components/auth/OauthButton.tsx:63` | `mt-4 grid grid-cols-2 gap-2` | `grid grid-cols-2 gap-2 mt-4` | 重排（分组顺序） |
| 275 | `components/auth/OauthButton.tsx:66` | `w-full gap-1.5 px-2 text-xs` | `gap-1.5 px-2 w-full text-xs` | 重排（分组顺序） |
| 276 | `components/auth/OauthButton.tsx:86` | `w-full gap-1.5 px-2 text-xs` | `gap-1.5 px-2 w-full text-xs` | 重排（分组顺序） |
| 277 | `components/auth/OauthButton.tsx:111` | `w-full gap-1.5 px-2 text-xs` | `gap-1.5 px-2 w-full text-xs` | 重排（分组顺序） |
| 278 | `components/auth/OauthButton.tsx:129` | `w-full gap-1.5 px-2 text-xs` | `gap-1.5 px-2 w-full text-xs` | 重排（分组顺序） |
| 279 | `components/auth/OauthButton.tsx:140` | `w-full gap-1.5 px-2 text-xs` | `gap-1.5 px-2 w-full text-xs` | 重排（分组顺序） |
| 280 | `components/auth/OauthButton.tsx:150` | `w-full gap-1.5 px-2 text-xs` | `gap-1.5 px-2 w-full text-xs` | 重排（分组顺序） |
| 281 | `components/bbcode.tsx:103` | `wrap-break-word [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5` | `wrap-break-word [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_p]:my-2 [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:list-disc` | 重排（分组顺序） |
| 282 | `components/cmments/comment-markdown.tsx:10` | `text-base font-semibold mt-2 mb-1` | `mt-2 mb-1 text-base font-semibold` | 重排（分组顺序） |
| 283 | `components/cmments/comment-markdown.tsx:16` | `text-sm font-semibold mt-2 mb-1` | `mt-2 mb-1 text-sm font-semibold` | 重排（分组顺序） |
| 284 | `components/cmments/comment-markdown.tsx:22` | `text-sm font-semibold mt-2 mb-1` | `mt-2 mb-1 text-sm font-semibold` | 重排（分组顺序） |
| 285 | `components/cmments/comment-markdown.tsx:28` | `text-sm font-medium mt-1.5 mb-0.5` | `mt-1.5 mb-0.5 text-sm font-medium` | 重排（分组顺序） |
| 286 | `components/cmments/comment-markdown.tsx:34` | `text-sm font-medium mt-1.5 mb-0.5` | `mt-1.5 mb-0.5 text-sm font-medium` | 重排（分组顺序） |
| 287 | `components/cmments/comment-markdown.tsx:40` | `text-sm font-medium mt-1.5 mb-0.5` | `mt-1.5 mb-0.5 text-sm font-medium` | 重排（分组顺序） |
| 288 | `components/cmments/comment-markdown.tsx:48` | `my-0.5 list-disc pl-4` | `pl-4 my-0.5 list-disc` | 重排（分组顺序） |
| 289 | `components/cmments/comment-markdown.tsx:51` | `my-0.5 list-decimal pl-4` | `pl-4 my-0.5 list-decimal` | 重排（分组顺序） |
| 290 | `components/cmments/comment-markdown.tsx:59` | `my-1 border-l-2 border-border/60 pl-3 text-muted-foreground` | `pl-3 my-1 text-muted-foreground border-l-2 border-border/60` | 重排（分组顺序） |
| 291 | `components/cmments/comment-markdown.tsx:68` | `bg-muted px-1 py-0.5 rounded text-xs font-mono` | `px-1 py-0.5 font-mono text-xs bg-muted rounded` | 重排（分组顺序） |
| 292 | `components/cmments/comment-markdown.tsx:77` | `bg-muted p-2 rounded text-xs font-mono overflow-x-auto my-1` | `overflow-x-auto p-2 my-1 font-mono text-xs bg-muted rounded` | 重排（分组顺序） |
| 293 | `components/cmments/comment-markdown.tsx:102` | `rounded max-w-full my-1` | `my-1 max-w-full rounded` | 重排（分组顺序） |
| 294 | `components/cmments/comment-markdown.tsx:118` | `border border-border px-2 py-1 bg-muted font-medium text-left` | `px-2 py-1 font-medium text-left bg-muted border border-border` | 重排（分组顺序） |
| 295 | `components/cmments/comment-markdown.tsx:126` | `border border-border px-2 py-1` | `px-2 py-1 border border-border` | 重排（分组顺序） |
| 296 | `components/cmments/comment-markdown.tsx:138` | `text-sm text-foreground/80 break-words` | `text-sm break-words text-foreground/80` | 重排（分组顺序） |
| 297 | `components/cmments/comment-skeleton.tsx:10` | `h-20 w-full rounded-xl` | `w-full h-20 rounded-xl` | 重排（分组顺序） |
| 298 | `components/cmments/comment-skeleton.tsx:15` | `flex gap-2.5 border-b border-border/60 pb-2 last:border-0` | `flex gap-2.5 pb-2 border-b border-border/60 last:border-0` | 重排（分组顺序） |
| 299 | `components/cmments/comment-skeleton.tsx:17` | `size-7 shrink-0 rounded-full` | `shrink-0 size-7 rounded-full` | 重排（分组顺序） |
| 300 | `components/cmments/comment-skeleton.tsx:19` | `h-3 w-24` | `w-24 h-3` | 重排（分组顺序） |
| 301 | `components/cmments/comment-skeleton.tsx:20` | `h-3.5 w-full` | `w-full h-3.5` | 重排（分组顺序） |
| 302 | `components/cmments/comment-skeleton.tsx:21` | `h-3.5 w-2/3` | `w-2/3 h-3.5` | 重排（分组顺序） |
| 303 | `components/cmments/comment-skeleton.tsx:22` | `h-3 w-16` | `w-16 h-3` | 重排（分组顺序） |
| 304 | `components/cmments/index.tsx:31` | `bg-info/10 text-info` | `text-info bg-info/10` | 重排（分组顺序） |
| 305 | `components/cmments/index.tsx:36` | `bg-primary/10 text-primary` | `text-primary bg-primary/10` | 重排（分组顺序） |
| 306 | `components/cmments/index.tsx:41` | `bg-warning/10 text-warning` | `text-warning bg-warning/10` | 重排（分组顺序） |
| 307 | `components/cmments/index.tsx:94` | `mt-1 border-l border-border/60 pl-2.5` | `pl-2.5 mt-1 border-l border-border/60` | 重排（分组顺序） |
| 308 | `components/cmments/index.tsx:100` | `bg-muted text-[10px] text-muted-foreground` | `text-[10px] text-muted-foreground bg-muted` | 重排（分组顺序） |
| 309 | `components/cmments/index.tsx:104` | `min-w-0 flex-1` | `flex-1 min-w-0` | 重排（分组顺序） |
| 310 | `components/cmments/index.tsx:105` | `flex flex-wrap items-center gap-x-2 gap-y-0.5` | `flex flex-wrap gap-x-2 gap-y-0.5 items-center` | 重排（分组顺序） |
| 311 | `components/cmments/index.tsx:114` | `text-xs text-muted-foreground tabular-nums` | `text-xs tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 312 | `components/cmments/index.tsx:119` | `text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 313 | `components/cmments/index.tsx:209` | `bg-muted text-[10px] text-muted-foreground` | `text-[10px] text-muted-foreground bg-muted` | 重排（分组顺序） |
| 314 | `components/cmments/index.tsx:213` | `min-w-0 flex-1` | `flex-1 min-w-0` | 重排（分组顺序） |
| 315 | `components/cmments/index.tsx:214` | `flex flex-wrap items-center gap-x-2 gap-y-0.5` | `flex flex-wrap gap-x-2 gap-y-0.5 items-center` | 重排（分组顺序） |
| 316 | `components/cmments/index.tsx:229` | `ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground` | `flex shrink-0 gap-2 items-center ml-auto text-xs text-muted-foreground` | 重排（分组顺序） |
| 317 | `components/cmments/index.tsx:236` | `transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 318 | `components/cmments/reply-edit-input.tsx:149` | `h-24 w-full rounded-xl` | `w-full h-24 rounded-xl` | 重排（分组顺序） |
| 319 | `components/cmments/reply-edit-input.tsx:153` | `flex flex-col items-center justify-center gap-3 rounded-2xl bg-card/60 px-6 py-8 text-center ring-1 ring-border/60` | `flex flex-col gap-3 justify-center items-center px-6 py-8 text-center bg-card/60 rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 320 | `components/cmments/reply-edit-input.tsx:162` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 321 | `components/cmments/reply-edit-input.tsx:213` | `max-h-100 min-h-12` | `min-h-12 max-h-100` | 重排（分组顺序） |
| 322 | `components/cmments/reply-edit-input.tsx:213` | `max-h-80 min-h-10` | `min-h-10 max-h-80` | 重排（分组顺序） |
| 323 | `components/cmments/reply-edit-input.tsx:301` | `data-[state=on]:bg-primary data-[state=on]:text-primary-foreground text-xs` | `text-xs data-[state=on]:text-primary-foreground data-[state=on]:bg-primary` | 重排（分组顺序） |
| 324 | `components/code-block.tsx:60` | `space-y-2 flex justify-center` | `flex justify-center space-y-2` | 重排（分组顺序） |
| 325 | `components/code-block.tsx:64` | `mt-2 block max-h-60 overflow-auto rounded-lg align-bottom whitespace-pre p-3 text-sm bg-muted` | `block overflow-auto p-3 mt-2 max-h-60 text-sm whitespace-pre align-bottom bg-muted rounded-lg` | 重排（分组顺序） |
| 326 | `components/contact-page.tsx:16` | `mx-auto w-full max-w-xl py-6` | `py-6 mx-auto w-full max-w-xl` | 重排（分组顺序） |
| 327 | `components/editor/MarkdownEditor.tsx:187` | `py-8 text-center text-sm text-muted-foreground` | `py-8 text-sm text-center text-muted-foreground` | 重排（分组顺序） |
| 328 | `components/editor/MarkdownEditor.tsx:197` | `w-full rounded-md border border-input overflow-hidden` | `overflow-hidden w-full rounded-md border border-input` | 重排（分组顺序） |
| 329 | `components/editor/MarkdownEditor.tsx:202` | `flex items-center gap-0.5 px-1 py-1 border-b border-input bg-muted/30 overflow-x-auto flex-nowrap` | `flex overflow-x-auto flex-nowrap gap-0.5 items-center p-1 bg-muted/30 border-b border-input` | 合并 px-1 py-1 -> p-1 |
| 330 | `components/editor/MarkdownEditor.tsx:252` | `min-h-62.5 resize-y rounded-none border-0 focus-visible:ring-0` | `min-h-62.5 rounded-none border-0 resize-y focus-visible:ring-0` | 重排（分组顺序） |
| 331 | `components/editor/MarkdownEditor.tsx:267` | `grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border` | `grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0` | 重排（分组顺序） |
| 332 | `components/editor/MarkdownEditor.tsx:277` | `h-full min-h-62.5 resize-none rounded-none border-0 focus-visible:ring-0` | `h-full min-h-62.5 rounded-none border-0 resize-none focus-visible:ring-0` | 重排（分组顺序） |
| 333 | `components/editor/RichTextEditor.tsx:264` | `w-full rounded-md border border-input overflow-hidden bg-background` | `overflow-hidden w-full bg-background rounded-md border border-input` | 重排（分组顺序） |
| 334 | `components/editor/RichTextEditor.tsx:290` | `min-h-full flex-1` | `flex-1 min-h-full` | 重排（分组顺序） |
| 335 | `components/editor/RichTextEditor.tsx:306` | `flex items-center gap-2 border-t border-input px-4 py-1.5` | `flex gap-2 items-center px-4 py-1.5 border-t border-input` | 重排（分组顺序） |
| 336 | `components/editor/RichTextEditor.tsx:307` | `size-3.5 shrink-0 animate-spin text-muted-foreground` | `shrink-0 size-3.5 text-muted-foreground animate-spin` | 重排（分组顺序） |
| 337 | `components/editor/RichTextEditor.tsx:308` | `h-1.5 flex-1` | `flex-1 h-1.5` | 重排（分组顺序） |
| 338 | `components/editor/RichTextEditor.tsx:342` | `galzy-prose prose prose-sm sm:prose-base dark:prose-invert focus:outline-none max-w-none w-full` | `galzy-prose w-full max-w-none prose prose-sm focus:outline-none dark:prose-invert sm:prose-base` | 重排（分组顺序） |
| 339 | `components/editor/RichTextEditor.tsx:353` | `mt-auto flex items-center gap-2 border-t border-input px-4 py-1.5 text-xs text-muted-foreground` | `flex gap-2 items-center px-4 py-1.5 mt-auto text-xs text-muted-foreground border-t border-input` | 重排（分组顺序） |
| 340 | `components/editor/RichTextEditor.tsx:354` | `size-3.5 shrink-0 animate-spin` | `shrink-0 size-3.5 animate-spin` | 重排（分组顺序） |
| 341 | `components/editor/RichTextEditor.tsx:367` | `flex items-center gap-0.5 flex-wrap px-1 py-1 border-b border-input bg-muted/30` | `flex flex-wrap gap-0.5 items-center p-1 bg-muted/30 border-b border-input` | 合并 px-1 py-1 -> p-1 |
| 342 | `components/EditorDraftBanner.tsx:26` | `size-4 shrink-0 text-primary` | `shrink-0 size-4 text-primary` | 重排（分组顺序） |
| 343 | `components/EditorDraftBanner.tsx:32` | `flex items-center gap-1.5` | `flex gap-1.5 items-center` | 重排（分组顺序） |
| 344 | `components/EmojiPicker/emoji-picker-in-form.tsx:29` | `flex items-start gap-2` | `flex gap-2 items-start` | 重排（分组顺序） |
| 345 | `components/EmojiPicker/emoji-picker-in-form.tsx:44` | `h-10 w-10 shrink-0` | `shrink-0 w-10 h-10` | 重排（分组顺序） |
| 346 | `components/EmojiPicker/emoji-picker-in-form.tsx:46` | `h-4 w-4` | `w-4 h-4` | 重排（分组顺序） |
| 347 | `components/EmojiPicker/emoji-picker-in-form.tsx:55` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 348 | `components/EmojiPicker/emoji-picker-in-form.tsx:71` | `h-10 w-10` | `w-10 h-10` | 重排（分组顺序） |
| 349 | `components/EmojiPicker/emoji-picker-in-form.tsx:73` | `h-4 w-4` | `w-4 h-4` | 重排（分组顺序） |
| 350 | `components/EmojiPicker/emoji-picker.tsx:941` | `h-8 w-8 bg-transparent p-0` | `p-0 w-8 h-8 bg-transparent` | 重排（分组顺序） |
| 351 | `components/EmojiPicker/emoji-picker.tsx:948` | `h-4 w-4` | `w-4 h-4` | 重排（分组顺序） |
| 352 | `components/EmojiPicker/emoji-picker.tsx:954` | `w-96 p-0` | `p-0 w-96` | 重排（分组顺序） |
| 353 | `components/EmojiPicker/emoji-picker.tsx:959` | `space-y-2 border-b p-3` | `p-3 space-y-2 border-b` | 重排（分组顺序） |
| 354 | `components/EmojiPicker/emoji-picker.tsx:961` | `absolute top-2.5 left-2 h-4 w-4 text-muted-foreground` | `absolute top-2.5 left-2 w-4 h-4 text-muted-foreground` | 重排（分组顺序） |
| 355 | `components/EmojiPicker/emoji-picker.tsx:974` | `flex items-center justify-between text-xs text-muted-foreground` | `flex justify-between items-center text-xs text-muted-foreground` | 重排（分组顺序） |
| 356 | `components/EmojiPicker/emoji-picker.tsx:998` | `flex h-32 flex-col items-center justify-center text-muted-foreground` | `flex flex-col justify-center items-center h-32 text-muted-foreground` | 重排（分组顺序） |
| 357 | `components/EmojiPicker/emoji-picker.tsx:999` | `mb-2 h-8 w-8` | `mb-2 w-8 h-8` | 重排（分组顺序） |
| 358 | `components/EmojiPicker/emoji-picker.tsx:1012` | `grid h-auto w-full p-1` | `grid p-1 w-full h-auto` | 重排（分组顺序） |
| 359 | `components/EmojiPicker/emoji-picker.tsx:1024` | `flex items-center gap-1 px-2 py-1 text-xs` | `flex gap-1 items-center px-2 py-1 text-xs` | 重排（分组顺序） |
| 360 | `components/EmojiPicker/emoji-picker.tsx:1026` | `h-3 w-3` | `w-3 h-3` | 重排（分组顺序） |
| 361 | `components/EmojiPicker/emoji-picker.tsx:1045` | `flex items-center gap-1 px-2 py-1 text-xs` | `flex gap-1 items-center px-2 py-1 text-xs` | 重排（分组顺序） |
| 362 | `components/EmojiPicker/emoji-picker.tsx:1047` | `h-3 w-3` | `w-3 h-3` | 重排（分组顺序） |
| 363 | `components/EmojiPicker/emoji-picker.tsx:1065` | `mb-2 flex items-center gap-2 px-1` | `flex gap-2 items-center px-1 mb-2` | 重排（分组顺序） |
| 364 | `components/EmojiPicker/emoji-picker.tsx:1066` | `h-4 w-4 text-muted-foreground` | `w-4 h-4 text-muted-foreground` | 重排（分组顺序） |
| 365 | `components/EmojiPicker/emoji-picker.tsx:1077` | `h-auto min-h-9 px-2 py-1.5 text-xs whitespace-nowrap transition-colors hover:bg-accent` | `px-2 py-1.5 h-auto min-h-9 text-xs whitespace-nowrap transition-colors hover:bg-accent` | 重排（分组顺序） |
| 366 | `components/EmojiPicker/emoji-picker.tsx:1104` | `mb-2 flex items-center gap-2 px-1` | `flex gap-2 items-center px-1 mb-2` | 重排（分组顺序） |
| 367 | `components/EmojiPicker/emoji-picker.tsx:1109` | `h-4 w-4 text-muted-foreground` | `w-4 h-4 text-muted-foreground` | 重排（分组顺序） |
| 368 | `components/EmojiPicker/emoji-picker.tsx:1126` | `flex h-32 items-center justify-center text-muted-foreground` | `flex justify-center items-center h-32 text-muted-foreground` | 重排（分组顺序） |
| 369 | `components/error.tsx:28` | `mx-auto w-full max-w-3xl py-10` | `py-10 mx-auto w-full max-w-3xl` | 重排（分组顺序） |
| 370 | `components/error.tsx:33` | `flex flex-col items-center gap-2` | `flex flex-col gap-2 items-center` | 重排（分组顺序） |
| 371 | `components/error.tsx:34` | `text-6xl font-semibold tracking-tight text-foreground/80 tabular-nums` | `text-6xl font-semibold tabular-nums tracking-tight text-foreground/80` | 重排（分组顺序） |
| 372 | `components/error.tsx:44` | `flex flex-wrap items-center justify-center gap-2` | `flex flex-wrap gap-2 justify-center items-center` | 重排（分组顺序） |
| 373 | `components/error.tsx:71` | `mx-auto mt-8 w-full max-w-2xl rounded-2xl bg-card/60 ring-1 ring-border/60` | `mx-auto mt-8 w-full max-w-2xl bg-card/60 rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 374 | `components/error.tsx:72` | `cursor-pointer list-none px-4 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground` | `px-4 py-3 text-xs list-none text-muted-foreground transition-colors cursor-pointer hover:text-foreground` | 重排（分组顺序） |
| 375 | `components/error.tsx:75` | `border-t border-border/60 px-2 pb-2` | `px-2 pb-2 border-t border-border/60` | 重排（分组顺序） |
| 376 | `components/Footer.tsx:8` | `inline-flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors duration-200 hover:text-foreground` | `inline-flex gap-1 items-center text-sm text-muted-foreground no-underline transition-colors duration-200 hover:text-foreground` | 重排（分组顺序） |
| 377 | `components/Footer.tsx:28` | `mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between` | `flex flex-col gap-6 px-4 py-10 mx-auto w-full max-w-7xl sm:px-6 md:flex-row md:justify-between md:items-center` | 重排（分组顺序） |
| 378 | `components/Footer.tsx:30` | `flex items-center gap-2.5` | `flex gap-2.5 items-center` | 重排（分组顺序） |
| 379 | `components/Footer.tsx:31` | `flex size-8 items-center justify-center overflow-hidden rounded-xl ring-1 ring-border/60` | `flex overflow-hidden justify-center items-center size-8 rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 380 | `components/Footer.tsx:41` | `rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground` | `px-2 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted/60 rounded-full` | 重排（分组顺序） |
| 381 | `components/Footer.tsx:45` | `flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground` | `flex flex-wrap gap-x-2 gap-y-1 items-center text-xs text-muted-foreground` | 重排（分组顺序） |
| 382 | `components/Footer.tsx:56` | `flex flex-wrap items-center gap-x-6 gap-y-2` | `flex flex-wrap gap-x-6 gap-y-2 items-center` | 重排（分组顺序） |
| 383 | `components/friend-links-page.tsx:87` | `size-10 shrink-0 rounded-xl` | `shrink-0 size-10 rounded-xl` | 重排（分组顺序） |
| 384 | `components/friend-links-page.tsx:89` | `rounded-xl bg-muted text-xs` | `text-xs bg-muted rounded-xl` | 重排（分组顺序） |
| 385 | `components/friend-links-page.tsx:93` | `flex min-w-0 flex-1 flex-col gap-1` | `flex flex-col flex-1 gap-1 min-w-0` | 重排（分组顺序） |
| 386 | `components/friend-links-page.tsx:96` | `line-clamp-2 text-xs leading-relaxed text-muted-foreground` | `text-xs leading-relaxed line-clamp-2 text-muted-foreground` | 重排（分组顺序） |
| 387 | `components/game/game-detail-pending.tsx:82` | `h-4 w-24` | `w-24 h-4` | 重排（分组顺序） |
| 388 | `components/game/game-detail-pending.tsx:91` | `wrap-break-word py-0 ring-border/60` | `py-0 wrap-break-word ring-border/60` | 重排（分组顺序） |
| 389 | `components/game/game-detail-pending.tsx:92` | `grid gap-5 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-7 sm:px-6 sm:py-5` | `grid gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-7 sm:px-6 sm:py-5` | 合并 px-4 py-4 -> p-4 |
| 390 | `components/game/game-detail-pending.tsx:137` | `relative inline-block` | `inline-block relative` | 重排（分组顺序） |
| 391 | `components/game/game-detail-pending.tsx:138` | `relative w-48 overflow-hidden rounded-xl text-left ring-1 ring-border/60` | `overflow-hidden relative w-48 text-left rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 392 | `components/game/game-detail-pending.tsx:142` | `w-full overflow-hidden rounded-lg` | `overflow-hidden w-full rounded-lg` | 重排（分组顺序） |
| 393 | `components/game/game-detail-pending.tsx:146` | `absolute inset-0 h-full w-full rounded-lg` | `absolute inset-0 w-full h-full rounded-lg` | 重排（分组顺序） |
| 394 | `components/game/game-detail-pending.tsx:164` | `relative inline-block max-w-full` | `inline-block relative max-w-full` | 重排（分组顺序） |
| 395 | `components/game/game-detail-pending.tsx:180` | `rounded-lg w-full h-full object-cover` | `object-cover w-full h-full rounded-lg` | 重排（分组顺序） |
| 396 | `components/game/game-detail-pending.tsx:199` | `h-8 w-2/3 max-w-80` | `w-2/3 max-w-80 h-8` | 重排（分组顺序） |
| 397 | `components/game/game-detail-pending.tsx:243` | `mt-4 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm` | `grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-baseline mt-4 text-sm` | 重排（分组顺序） |
| 398 | `components/game/game-detail-pending.tsx:246` | `w-8 shrink-0 pt-0.5 text-xs text-muted-foreground` | `shrink-0 pt-0.5 w-8 text-xs text-muted-foreground` | 重排（分组顺序） |
| 399 | `components/game/game-detail-pending.tsx:250` | `h-3.5 w-24` | `w-24 h-3.5` | 重排（分组顺序） |
| 400 | `components/game/game-detail-pending.tsx:268` | `mt-4 mb-5 flex flex-wrap gap-1.5` | `flex flex-wrap gap-1.5 mt-4 mb-5` | 重排（分组顺序） |
| 401 | `components/game/game-layout-page.tsx:54` | `wrap-break-word py-0 ring-border/60` | `py-0 wrap-break-word ring-border/60` | 重排（分组顺序） |
| 402 | `components/game/game-layout-page.tsx:55` | `grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 sm:px-5` | `grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 sm:px-5` | 合并 px-4 py-4 -> p-4 |
| 403 | `components/game/game-tab-skeleton.tsx:46` | `h-8 w-24 rounded-lg` | `w-24 h-8 rounded-lg` | 重排（分组顺序） |
| 404 | `components/game/game-tab-skeleton.tsx:50` | `flex items-center gap-2 py-2.5` | `flex gap-2 items-center py-2.5` | 重排（分组顺序） |
| 405 | `components/game/game-tab-skeleton.tsx:51` | `size-4 shrink-0 rounded-sm` | `shrink-0 size-4 rounded-sm` | 重排（分组顺序） |
| 406 | `components/game/game-tab-skeleton.tsx:65` | `h-52 w-full rounded-xl` | `w-full h-52 rounded-xl` | 重排（分组顺序） |
| 407 | `components/game/game-tab-skeleton.tsx:81` | `absolute top-2 left-2 h-5 w-12 rounded-lg` | `absolute top-2 left-2 w-12 h-5 rounded-lg` | 重排（分组顺序） |
| 408 | `components/game/game-tab-skeleton.tsx:105` | `h-9 w-full rounded-lg` | `w-full h-9 rounded-lg` | 重排（分组顺序） |
| 409 | `components/header/desktop-nav.tsx:21` | `h-8 gap-1.5 rounded-lg px-3 text-sm font-medium` | `gap-1.5 px-3 h-8 text-sm font-medium rounded-lg` | 重排（分组顺序） |
| 410 | `components/header/desktop-nav.tsx:25` | `hover:bg-[var(--header-hover)] hover:text-[color:var(--header-hover-fg)]` | `hover:text-[color:var(--header-hover-fg)] hover:bg-[var(--header-hover)]` | 重排（分组顺序） |
| 411 | `components/header/desktop-nav.tsx:26` | `focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 412 | `components/header/desktop-nav.tsx:32` | `data-[status=active]:bg-[var(--header-hover)] data-[status=active]:text-[color:var(--header-fg)]` | `data-[status=active]:text-[color:var(--header-fg)] data-[status=active]:bg-[var(--header-hover)]` | 重排（分组顺序） |
| 413 | `components/header/desktop-nav.tsx:37` | `data-popup-open:bg-[var(--header-hover)] data-popup-open:text-[color:var(--header-fg)]` | `data-popup-open:text-[color:var(--header-fg)] data-popup-open:bg-[var(--header-hover)]` | 重排（分组顺序） |
| 414 | `components/header/desktop-nav.tsx:57` | `group/row h-auto w-full items-start gap-3 rounded-xl p-2.5 hover:bg-muted/70` | `group/row gap-3 items-start p-2.5 w-full h-auto rounded-xl hover:bg-muted/70` | 重排（分组顺序） |
| 415 | `components/header/desktop-nav.tsx:60` | `flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground transition-colors group-hover/row:bg-background group-hover/row:text-foreground` | `flex shrink-0 justify-center items-center size-8 text-muted-foreground bg-muted/70 rounded-lg transition-colors group-hover/row:text-foreground group-hover/row:bg-background` | 重排（分组顺序） |
| 416 | `components/header/desktop-nav.tsx:63` | `flex min-w-0 flex-col items-start gap-0.5` | `flex flex-col gap-0.5 items-start min-w-0` | 重排（分组顺序） |
| 417 | `components/header/desktop-nav.tsx:126` | `bg-[var(--header-hover)] text-[color:var(--header-fg)]` | `text-[color:var(--header-fg)] bg-[var(--header-hover)]` | 重排（分组顺序） |
| 418 | `components/header/header-actions.tsx:31` | `flex shrink-0 items-center gap-0.5` | `flex shrink-0 gap-0.5 items-center` | 重排（分组顺序） |
| 419 | `components/header/header-actions.tsx:41` | `h-8 gap-1 rounded-lg px-2` | `gap-1 px-2 h-8 rounded-lg` | 重排（分组顺序） |
| 420 | `components/header/header-actions.tsx:49` | `size-4 shrink-0` | `shrink-0 size-4` | 重排（分组顺序） |
| 421 | `components/header/header-actions.tsx:51` | `size-4 shrink-0` | `shrink-0 size-4` | 重排（分组顺序） |
| 422 | `components/header/header-actions.tsx:65` | `text-[color:var(--header-muted)] hover:bg-[var(--header-hover)] hover:text-[color:var(--header-fg)]` | `text-[color:var(--header-muted)] hover:text-[color:var(--header-fg)] hover:bg-[var(--header-hover)]` | 重排（分组顺序） |
| 423 | `components/header/header-actions.tsx:71` | `mx-1 hidden h-4 w-px bg-[color:var(--header-muted)]/30 sm:block` | `hidden mx-1 w-px h-4 bg-[color:var(--header-muted)]/30 sm:block` | 重排（分组顺序） |
| 424 | `components/header/header-actions.tsx:77` | `size-8 rounded-full bg-[color:var(--header-muted)]/25` | `size-8 bg-[color:var(--header-muted)]/25 rounded-full` | 重排（分组顺序） |
| 425 | `components/header/header-actions.tsx:83` | `size-8 rounded-full bg-[color:var(--header-muted)]/25` | `size-8 bg-[color:var(--header-muted)]/25 rounded-full` | 重排（分组顺序） |
| 426 | `components/header/mobile-menu.tsx:16` | `galzy-mobile-item group/row flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2` | `group/row galzy-mobile-item flex gap-2.5 items-center px-2.5 py-2 min-h-11 rounded-xl` | 重排（分组顺序） |
| 427 | `components/header/mobile-menu.tsx:55` | `flex size-8 shrink-0 items-center justify-center rounded-lg` | `flex shrink-0 justify-center items-center size-8 rounded-lg` | 重排（分组顺序） |
| 428 | `components/header/mobile-menu.tsx:56` | `bg-muted/70 text-muted-foreground transition-colors duration-200` | `text-muted-foreground bg-muted/70 transition-colors duration-200` | 重排（分组顺序） |
| 429 | `components/header/mobile-menu.tsx:57` | `group-hover/row:bg-background group-hover/row:text-foreground` | `group-hover/row:text-foreground group-hover/row:bg-background` | 重排（分组顺序） |
| 430 | `components/header/mobile-menu.tsx:62` | `flex min-w-0 flex-1 flex-col` | `flex flex-col flex-1 min-w-0` | 重排（分组顺序） |
| 431 | `components/header/mobile-menu.tsx:63` | `truncate text-sm leading-tight font-medium` | `text-sm leading-tight font-medium truncate` | 重排（分组顺序） |
| 432 | `components/header/mobile-menu.tsx:67` | `mt-0.5 truncate text-xs font-normal text-muted-foreground` | `mt-0.5 text-xs font-normal text-muted-foreground truncate` | 重排（分组顺序） |
| 433 | `components/header/mobile-menu.tsx:74` | `size-4 shrink-0 text-muted-foreground/60` | `shrink-0 size-4 text-muted-foreground/60` | 重排（分组顺序） |
| 434 | `components/header/mobile-menu.tsx:242` | `pointer-events-none opacity-0` | `opacity-0 pointer-events-none` | 重排（分组顺序） |
| 435 | `components/header/mobile-menu.tsx:257` | `mx-auto flex w-full max-w-md flex-col gap-0.5 px-4` | `flex flex-col gap-0.5 px-4 mx-auto w-full max-w-md` | 重排（分组顺序） |
| 436 | `components/header/mobile-menu.tsx:296` | `mt-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground` | `flex gap-2 justify-center items-center mt-2 text-[11px] text-muted-foreground` | 重排（分组顺序） |
| 437 | `components/header/mobile-menu.tsx:301` | `inline-flex min-h-8 items-center gap-1 rounded-lg px-2 transition-colors duration-200 hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `inline-flex gap-1 items-center px-2 min-h-8 rounded-lg transition-colors duration-200 hover:text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 438 | `components/header/mobile-trigger.tsx:28` | `rounded-lg text-[color:var(--header-muted)] hover:bg-[var(--header-hover)] hover:text-[color:var(--header-fg)] md:hidden` | `text-[color:var(--header-muted)] rounded-lg hover:text-[color:var(--header-fg)] hover:bg-[var(--header-hover)] md:hidden` | 重排（分组顺序） |
| 439 | `components/header/mobile-trigger.tsx:38` | `relative flex size-4 items-center justify-center` | `flex relative justify-center items-center size-4` | 重排（分组顺序） |
| 440 | `components/header/mobile-trigger.tsx:42` | `absolute h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]` | `absolute w-4 h-[1.5px] bg-current rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]` | 重排（分组顺序） |
| 441 | `components/header/mobile-trigger.tsx:48` | `absolute h-[1.5px] w-4 rounded-full bg-current transition-opacity duration-200` | `absolute w-4 h-[1.5px] bg-current rounded-full transition-opacity duration-200` | 重排（分组顺序） |
| 442 | `components/header/mobile-trigger.tsx:49` | `scale-x-0 opacity-0` | `opacity-0 scale-x-0` | 重排（分组顺序） |
| 443 | `components/header/mobile-trigger.tsx:54` | `absolute h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]` | `absolute w-4 h-[1.5px] bg-current rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]` | 重排（分组顺序） |
| 444 | `components/Header.tsx:107` | `max-w-7xl px-4 sm:px-6` | `px-4 max-w-7xl sm:px-6` | 重排（分组顺序） |
| 445 | `components/Header.tsx:107` | `max-w-4xl px-3 pt-2` | `px-3 pt-2 max-w-4xl` | 重排（分组顺序） |
| 446 | `components/Header.tsx:113` | `flex items-center justify-between gap-3` | `flex gap-3 justify-between items-center` | 重排（分组顺序） |
| 447 | `components/Header.tsx:117` | `h-11 rounded-2xl pl-2 pr-1.5 ring-1 ring-border/60 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]` | `pr-1.5 pl-2 h-11 rounded-2xl ring-1 ring-border/60 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]` | 重排（分组顺序） |
| 448 | `components/Header.tsx:126` | `flex min-w-0 items-center gap-0.5` | `flex gap-0.5 items-center min-w-0` | 重排（分组顺序） |
| 449 | `components/Header.tsx:136` | `group/brand flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | `group/brand flex gap-2 items-center px-1 py-0.5 min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 450 | `components/Header.tsx:143` | `flex size-8 shrink-0 items-center justify-center transition-transform duration-300 group-hover/brand:scale-105` | `flex shrink-0 justify-center items-center size-8 transition-transform duration-300 group-hover/brand:scale-105` | 重排（分组顺序） |
| 451 | `components/Header.tsx:153` | `hidden truncate text-[15px] leading-none font-semibold tracking-tight text-[color:var(--header-fg)] sm:block` | `hidden text-[15px] leading-none font-semibold tracking-tight text-[color:var(--header-fg)] truncate sm:block` | 重排（分组顺序） |
| 452 | `components/Header.tsx:157` | `ml-1 hidden items-center md:flex` | `hidden items-center ml-1 md:flex` | 重排（分组顺序） |
| 453 | `components/home/card.tsx:328` | `h-50 w-67.5 w-min-[270px]` | `w-67.5 w-min-[270px] h-50` | 重排（分组顺序） |
| 454 | `components/home/card.tsx:330` | `h-10 max-w-50` | `max-w-50 h-10` | 重排（分组顺序） |
| 455 | `components/home/card.tsx:331` | `h-4 max-w-50` | `max-w-50 h-4` | 重排（分组顺序） |
| 456 | `components/home/card.tsx:333` | `h-4 w-full` | `w-full h-4` | 重排（分组顺序） |
| 457 | `components/home/card.tsx:340` | `h-7 w-12.5` | `w-12.5 h-7` | 重排（分组顺序） |
| 458 | `components/home/card.tsx:344` | `h-4 w-3/5` | `w-3/5 h-4` | 重排（分组顺序） |
| 459 | `components/home/card.tsx:353` | `space-y-2 aspect-[9/13] p-0` | `aspect-[9/13] p-0 space-y-2` | 重排（分组顺序） |
| 460 | `components/home/card.tsx:354` | `h-full w-full inset-0 rounded-lg border bg-muted shadow` | `inset-0 w-full h-full bg-muted rounded-lg border shadow` | 重排（分组顺序） |
| 461 | `components/home/card.tsx:381` | `w-full overflow-hidden rounded-lg border bg-muted shadow` | `overflow-hidden w-full bg-muted rounded-lg border shadow` | 重排（分组顺序） |
| 462 | `components/home/card.tsx:395` | `text-white/70 text-xs mt-1` | `mt-1 text-xs text-white/70` | 重排（分组顺序） |
| 463 | `components/home/card.tsx:400` | `absolute bottom-2 right-2` | `absolute right-2 bottom-2` | 重排（分组顺序） |
| 464 | `components/home/card.tsx:444` | `w-full overflow-hidden rounded-lg` | `overflow-hidden w-full rounded-lg` | 重排（分组顺序） |
| 465 | `components/home/card.tsx:457` | `text-white/70 text-xs mt-1` | `mt-1 text-xs text-white/70` | 重排（分组顺序） |
| 466 | `components/home/card.tsx:462` | `absolute bottom-2 right-2` | `absolute right-2 bottom-2` | 重排（分组顺序） |
| 467 | `components/home/card.tsx:520` | ` hover:scale-105 transition duration-500 ease-out` | ` transition duration-500 ease-out hover:scale-105` | 重排（分组顺序） |
| 468 | `components/home/card.tsx:588` | `block relative overflow-hidden rounded-xl` | `block overflow-hidden relative rounded-xl` | 重排（分组顺序） |
| 469 | `components/home/card.tsx:613` | `text-white/70 text-xs mt-1` | `mt-1 text-xs text-white/70` | 重排（分组顺序） |
| 470 | `components/home/card.tsx:618` | `absolute bottom-2 right-2` | `absolute right-2 bottom-2` | 重排（分组顺序） |
| 471 | `components/home/card.tsx:633` | `mx-auto w-fit max-w-full truncate px-2 pt-2 text-center text-xs text-foreground/85 transition-colors duration-200 group-hover/game-card:text-primary sm:text-sm` | `px-2 pt-2 mx-auto w-fit max-w-full text-xs text-center text-foreground/85 truncate transition-colors duration-200 group-hover/game-card:text-primary sm:text-sm` | 重排（分组顺序） |
| 472 | `components/home/collection-card.tsx:39` | `aspect-[4/5] flex items-center justify-center rounded-xl bg-muted/50` | `flex aspect-[4/5] justify-center items-center bg-muted/50 rounded-xl` | 重排（分组顺序） |
| 473 | `components/home/collection-card.tsx:58` | `relative aspect-[4/5] w-full rounded-xl bg-muted/30` | `relative aspect-[4/5] w-full bg-muted/30 rounded-xl` | 重排（分组顺序） |
| 474 | `components/home/collection-card.tsx:74` | `w-[68%] aspect-[2/3] overflow-hidden rounded-lg border-[3px] border-background` | `overflow-hidden aspect-[2/3] w-[68%] rounded-lg border-[3px] border-background` | 重排（分组顺序） |
| 475 | `components/home/collection-card.tsx:85` | `w-full h-full object-cover` | `object-cover w-full h-full` | 重排（分组顺序） |
| 476 | `components/home/collection-card.tsx:93` | `absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium text-foreground/80 tabular-nums shadow-sm ring-1 ring-border/60 backdrop-blur-sm transition-colors duration-200 group-hover:text-primary` | `flex absolute right-2 bottom-2 gap-1 items-center px-2 py-0.5 text-xs font-medium tabular-nums text-foreground/80 bg-background/85 rounded-full ring-1 ring-border/60 shadow-sm backdrop-blur-sm transition-colors duration-200 group-hover:text-primary` | 重排（分组顺序） |
| 477 | `components/home/collection-card.tsx:123` | `mx-auto mt-2 w-fit max-w-full truncate px-2 text-center text-xs text-foreground/85 transition-colors duration-200 group-hover:text-primary sm:text-sm` | `px-2 mx-auto mt-2 w-fit max-w-full text-xs text-center text-foreground/85 truncate transition-colors duration-200 group-hover:text-primary sm:text-sm` | 重排（分组顺序） |
| 478 | `components/home/collection-card.tsx:133` | `rounded-xl bg-muted animate-pulse aspect-[4/5]` | `aspect-[4/5] bg-muted rounded-xl animate-pulse` | 重排（分组顺序） |
| 479 | `components/home/collection-card.tsx:134` | `mt-2 h-4 w-2/3 mx-auto rounded bg-muted animate-pulse` | `mx-auto mt-2 w-2/3 h-4 bg-muted rounded animate-pulse` | 重排（分组顺序） |
| 480 | `components/home/collections-section.tsx:64` | `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4` | `grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6` | 重排（分组顺序） |
| 481 | `components/home/collections-section.tsx:78` | `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4` | `grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6` | 重排（分组顺序） |
| 482 | `components/home/Count.tsx:12` | `my-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm` | `flex flex-wrap gap-x-3 gap-y-1 justify-center items-center my-4 text-xs text-muted-foreground sm:text-sm` | 重排（分组顺序） |
| 483 | `components/home/Count.tsx:13` | `inline-flex items-center gap-1.5 tabular-nums` | `inline-flex gap-1.5 items-center tabular-nums` | 重排（分组顺序） |
| 484 | `components/home/Count.tsx:16` | `hidden h-3 w-px bg-border sm:block` | `hidden w-px h-3 bg-border sm:block` | 重排（分组顺序） |
| 485 | `components/home/Count.tsx:18` | `inline-flex items-center gap-1 font-medium text-primary no-underline transition-colors hover:text-primary/80` | `inline-flex gap-1 items-center font-medium text-primary no-underline transition-colors hover:text-primary/80` | 重排（分组顺序） |
| 486 | `components/home/Count.tsx:44` | `mx-0.5 inline-block h-4 w-10 align-middle` | `inline-block mx-0.5 w-10 h-4 align-middle` | 重排（分组顺序） |
| 487 | `components/home/game/download-options.tsx:63` | `relative inline-flex items-center` | `inline-flex relative items-center` | 重排（分组顺序） |
| 488 | `components/home/game/download-options.tsx:64` | `rounded-lg bg-muted/50 px-2 py-0.5 pr-8 font-medium ring-1 ring-border/60` | `px-2 pr-8 py-0.5 font-medium bg-muted/50 rounded-lg ring-1 ring-border/60` | 重排（分组顺序） |
| 489 | `components/home/game/download-options.tsx:80` | `mb-3 flex items-center gap-2 bg-muted/30 px-3 py-2 text-left text-sm` | `flex gap-2 items-center px-3 py-2 mb-3 text-sm text-left bg-muted/30` | 重排（分组顺序） |
| 490 | `components/home/game/download-options.tsx:83` | `size-4 shrink-0 text-muted-foreground` | `shrink-0 size-4 text-muted-foreground` | 重排（分组顺序） |
| 491 | `components/home/game/download-options.tsx:85` | `flex flex-wrap items-center gap-x-1.5 gap-y-1 text-left text-sm text-muted-foreground` | `flex flex-wrap gap-x-1.5 gap-y-1 items-center text-sm text-left text-muted-foreground` | 重排（分组顺序） |
| 492 | `components/home/game/download-options.tsx:283` | `max-h-[85%] overflow-y-auto` | `overflow-y-auto max-h-[85%]` | 重排（分组顺序） |
| 493 | `components/home/game/download-options.tsx:294` | `flex w-full flex-col gap-1.5` | `flex flex-col gap-1.5 w-full` | 重排（分组顺序） |
| 494 | `components/home/game/download-options.tsx:299` | `gap-2 rounded-xl py-2 transition-colors duration-200 hover:bg-muted/40` | `gap-2 py-2 rounded-xl transition-colors duration-200 hover:bg-muted/40` | 重排（分组顺序） |
| 495 | `components/home/game/download-options.tsx:304` | `size-8 rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border/60` | `size-8 text-muted-foreground bg-muted/60 rounded-lg ring-1 ring-border/60` | 重排（分组顺序） |
| 496 | `components/home/game/download-options.tsx:309` | `line-clamp-2 w-full text-xs leading-snug break-all` | `w-full text-xs leading-snug line-clamp-2 break-all` | 重排（分组顺序） |
| 497 | `components/home/game/download-options.tsx:357` | `flex items-center gap-1` | `flex gap-1 items-center` | 重排（分组顺序） |
| 498 | `components/home/game/download-options.tsx:379` | `flex items-center gap-1` | `flex gap-1 items-center` | 重排（分组顺序） |
| 499 | `components/home/game/download-options.tsx:390` | `mt-2 text-center text-xs` | `mt-2 text-xs text-center` | 重排（分组顺序） |
| 500 | `components/home/game/download-options.tsx:394` | `mt-2 flex items-center justify-center gap-1.5` | `flex gap-1.5 justify-center items-center mt-2` | 重排（分组顺序） |
| 501 | `components/home/game/download-options.tsx:405` | `text-center text-sm font-medium wrap-break-word` | `text-sm font-medium text-center wrap-break-word` | 重排（分组顺序） |
| 502 | `components/home/game/download-options.tsx:413` | `mt-2 flex items-center justify-center gap-1.5` | `flex gap-1.5 justify-center items-center mt-2` | 重排（分组顺序） |
| 503 | `components/home/game/download-options.tsx:418` | `flex-row justify-center gap-2 sm:justify-center` | `flex-row gap-2 justify-center sm:justify-center` | 重排（分组顺序） |
| 504 | `components/home/game/download-options.tsx:458` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 505 | `components/home/game/download-options.tsx:459` | `animate-spin h-4 w-4` | `w-4 h-4 animate-spin` | 重排（分组顺序） |
| 506 | `components/home/game/download-options.tsx:477` | `flex items-center gap-1` | `flex gap-1 items-center` | 重排（分组顺序） |
| 507 | `components/home/game/download-options.tsx:491` | `max-h-96 overflow-y-auto rounded-xl bg-muted/20 p-3 wrap-break-word ring-1 ring-border/60` | `overflow-y-auto p-3 max-h-96 wrap-break-word bg-muted/20 rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 508 | `components/home/game/GameHeader.tsx:123` | `absolute inset-0 h-full w-full rounded-xl` | `absolute inset-0 w-full h-full rounded-xl` | 重排（分组顺序） |
| 509 | `components/home/game/GameHeader.tsx:130` | `h-full w-full rounded-xl object-cover` | `object-cover w-full h-full rounded-xl` | 重排（分组顺序） |
| 510 | `components/home/game/GameHeader.tsx:148` | `h-full w-full rounded-xl object-cover` | `object-cover w-full h-full rounded-xl` | 重排（分组顺序） |
| 511 | `components/home/game/GameHeader.tsx:161` | `relative inline-block max-w-full` | `inline-block relative max-w-full` | 重排（分组顺序） |
| 512 | `components/home/game/GameHeader.tsx:168` | `absolute inset-0 z-10 cursor-zoom-in rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background` | `absolute inset-0 z-10 rounded-xl outline-none cursor-zoom-in focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-ring/60` | 重排（分组顺序） |
| 513 | `components/home/game/GameHeader.tsx:200` | `mt-1 line-clamp-1 max-w-3xl text-xs leading-relaxed text-muted-foreground` | `mt-1 max-w-3xl text-xs leading-relaxed line-clamp-1 text-muted-foreground` | 重排（分组顺序） |
| 514 | `components/home/game/GameInfo.tsx:23` | `w-8 shrink-0 pt-0.5 text-xs text-muted-foreground` | `shrink-0 pt-0.5 w-8 text-xs text-muted-foreground` | 重排（分组顺序） |
| 515 | `components/home/game/GameInfo.tsx:100` | `mt-3 grid max-w-4xl grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-sm` | `grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-baseline mt-3 max-w-4xl text-sm` | 重排（分组顺序） |
| 516 | `components/home/game/GameInfo.tsx:111` | `group inline-flex items-center gap-1 text-foreground/85 transition-colors duration-200 hover:text-primary` | `group inline-flex gap-1 items-center text-foreground/85 transition-colors duration-200 hover:text-primary` | 重排（分组顺序） |
| 517 | `components/home/game/GameInfo.tsx:154` | `mt-0.5 h-6 px-0 text-xs text-primary` | `px-0 mt-0.5 h-6 text-xs text-primary` | 重排（分组顺序） |
| 518 | `components/home/game/GameInfo.tsx:162` | `max-h-[85vh] overflow-hidden sm:max-w-2xl` | `overflow-hidden max-h-[85vh] sm:max-w-2xl` | 重排（分组顺序） |
| 519 | `components/home/game/GameInfo.tsx:166` | `max-h-[70vh] min-h-0 min-w-0 overflow-x-hidden overflow-y-auto text-sm leading-relaxed text-foreground/85` | `overflow-x-hidden overflow-y-auto min-w-0 min-h-0 max-h-[70vh] text-sm leading-relaxed text-foreground/85` | 重排（分组顺序） |
| 520 | `components/home/game/GameTabs.tsx:23` | `h-9 max-w-full justify-start gap-0.5 overflow-x-auto overflow-y-hidden rounded-xl bg-muted/40 p-0.5 ring-1 ring-border/60` | `overflow-x-auto overflow-y-hidden gap-0.5 justify-start p-0.5 max-w-full h-9 bg-muted/40 rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 521 | `components/home/game/GameTabs.tsx:29` | `h-8 flex-none gap-1.5 rounded-lg px-2.5 text-sm font-medium sm:px-3` | `flex-none gap-1.5 px-2.5 h-8 text-sm font-medium rounded-lg sm:px-3` | 重排（分组顺序） |
| 522 | `components/home/game/GameTabs.tsx:31` | `hover:bg-muted/60 hover:text-foreground` | `hover:text-foreground hover:bg-muted/60` | 重排（分组顺序） |
| 523 | `components/home/game/GameTabs.tsx:32` | `data-active:bg-muted/60 data-active:text-foreground data-active:shadow-none` | `data-active:text-foreground data-active:bg-muted/60 data-active:shadow-none` | 重排（分组顺序） |
| 524 | `components/home/game/GameTabs.tsx:33` | `focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 525 | `components/home/game/relations/relations-page.tsx:69` | `mb-3 text-center text-xs text-muted-foreground` | `mb-3 text-xs text-center text-muted-foreground` | 重排（分组顺序） |
| 526 | `components/home/game/relations/relations-page.tsx:97` | `pointer-events-none absolute top-2 left-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-lg bg-background/95 px-2 py-1 text-xs font-semibold text-foreground shadow-sm ring-1 ring-border/70 backdrop-blur-sm` | `absolute top-2 left-2 z-10 px-2 py-1 max-w-[calc(100%-1rem)] text-xs font-semibold text-foreground truncate bg-background/95 rounded-lg ring-1 ring-border/70 shadow-sm backdrop-blur-sm pointer-events-none` | 重排（分组顺序） |
| 527 | `components/home/game/tags.tsx:41` | `mt-3 mb-3` | `my-3` | 合并 mt-3 mb-3 -> my-3 |
| 528 | `components/home/game/tips.tsx:41` | `inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-base leading-none text-muted-foreground` | `inline-flex shrink-0 justify-center items-center size-4 text-base leading-none text-muted-foreground bg-muted rounded-full` | 重排（分组顺序） |
| 529 | `components/home/game/tips.tsx:53` | `mt-4 flex flex-col gap-2 px-0` | `flex flex-col gap-2 px-0 mt-4` | 重排（分组顺序） |
| 530 | `components/home/game/tips.tsx:54` | `gap-2 border-0 bg-transparent px-0 py-1 text-xs text-muted-foreground opacity-80` | `gap-2 px-0 py-1 text-xs text-muted-foreground bg-transparent border-0 opacity-80` | 重排（分组顺序） |
| 531 | `components/home/game/tips.tsx:57` | `size-3.5 shrink-0 translate-y-0.5` | `shrink-0 size-3.5 translate-y-0.5` | 重排（分组顺序） |
| 532 | `components/home/game/tips.tsx:75` | `gap-0 overflow-hidden py-0 transition-colors duration-200 group-hover:bg-muted/40 group-hover:ring-border` | `overflow-hidden gap-0 py-0 transition-colors duration-200 group-hover:bg-muted/40 group-hover:ring-border` | 重排（分组顺序） |
| 533 | `components/home/game/tips.tsx:76` | `flex items-center gap-2 border-b border-border/60 px-4 py-2` | `flex gap-2 items-center px-4 py-2 border-b border-border/60` | 重排（分组顺序） |
| 534 | `components/home/game/tips.tsx:90` | `w-full object-cover opacity-[0.65] transition-opacity duration-200 group-hover:opacity-100` | `object-cover w-full opacity-[0.65] transition-opacity duration-200 group-hover:opacity-100` | 重排（分组顺序） |
| 535 | `components/home/game/tips.tsx:100` | `flex items-center gap-2 text-sm font-medium` | `flex gap-2 items-center text-sm font-medium` | 重排（分组顺序） |
| 536 | `components/home/game/tips.tsx:106` | `grid list-disc gap-1.5 pl-4 text-sm text-muted-foreground` | `grid gap-1.5 pl-4 text-sm list-disc text-muted-foreground` | 重排（分组顺序） |
| 537 | `components/home/game/tips.tsx:147` | `flex list-inside list-disc flex-col gap-1.5 text-sm text-muted-foreground` | `flex flex-col gap-1.5 text-sm list-disc list-inside text-muted-foreground` | 重排（分组顺序） |
| 538 | `components/home/game/translate/chart-area-linear.tsx:40` | `max-h-52 w-full` | `w-full max-h-52` | 重排（分组顺序） |
| 539 | `components/home/home-hero.tsx:14` | `mt-6 flex flex-col items-center gap-3 text-center sm:mt-10` | `flex flex-col gap-3 items-center mt-6 text-center sm:mt-10` | 重排（分组顺序） |
| 540 | `components/home/home-hero.tsx:15` | `flex items-center gap-3` | `flex gap-3 items-center` | 重排（分组顺序） |
| 541 | `components/home/home-hero.tsx:16` | `flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/5 ring-1 ring-border/60` | `flex overflow-hidden shrink-0 justify-center items-center size-11 bg-primary/5 rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 542 | `components/home/home-hero.tsx:35` | `h-6 bg-background/60 px-3` | `px-3 h-6 bg-background/60` | 重排（分组顺序） |
| 543 | `components/home/home-page-pending.tsx:24` | `mx-auto mt-6 mb-8 w-full max-w-2xl px-1` | `px-1 mx-auto mt-6 mb-8 w-full max-w-2xl` | 重排（分组顺序） |
| 544 | `components/home/hot-games-section.tsx:83` | `grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3` | `grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6` | 重排（分组顺序） |
| 545 | `components/home/hot-games-section.tsx:103` | `absolute top-1.5 left-1.5 z-20 flex size-5 items-center justify-center rounded-full bg-background/85 text-xs font-semibold text-foreground ring-1 ring-border/60 backdrop-blur-sm pointer-events-none` | `flex absolute top-1.5 left-1.5 z-20 justify-center items-center size-5 text-xs font-semibold text-foreground bg-background/85 rounded-full ring-1 ring-border/60 backdrop-blur-sm pointer-events-none` | 重排（分组顺序） |
| 546 | `components/home/hot-games-section.tsx:118` | `grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3` | `grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6` | 重排（分组顺序） |
| 547 | `components/home/hot-tags-section.tsx:69` | `flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums` | `flex shrink-0 justify-center items-center size-4 text-[10px] font-semibold tabular-nums rounded-full` | 重排（分组顺序） |
| 548 | `components/home/hot-tags-section.tsx:138` | `h-6 w-16 rounded-full lg:h-8 lg:w-24` | `w-16 h-6 rounded-full lg:w-24 lg:h-8` | 重排（分组顺序） |
| 549 | `components/home/hot-tags-section.tsx:139` | `h-6 w-24 rounded-full lg:h-8 lg:w-32` | `w-24 h-6 rounded-full lg:w-32 lg:h-8` | 重排（分组顺序） |
| 550 | `components/home/hot-tags-section.tsx:140` | `h-6 w-14 rounded-full lg:h-8 lg:w-20` | `w-14 h-6 rounded-full lg:w-20 lg:h-8` | 重排（分组顺序） |
| 551 | `components/home/hot-tags-section.tsx:141` | `h-6 w-20 rounded-full lg:h-8 lg:w-28` | `w-20 h-6 rounded-full lg:w-28 lg:h-8` | 重排（分组顺序） |
| 552 | `components/home/search/Search.tsx:242` | `bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary` | `text-primary bg-primary/10 hover:text-primary hover:bg-primary/15` | 重排（分组顺序） |
| 553 | `components/home/search/Search.tsx:268` | `flex items-center gap-2 mt-2` | `flex gap-2 items-center mt-2` | 重排（分组顺序） |
| 554 | `components/home/search/Search.tsx:269` | `m-0 gap-1` | `gap-1 m-0` | 重排（分组顺序） |
| 555 | `components/home/search/Search.tsx:275` | `ml-0.5 hover:text-foreground cursor-pointer` | `ml-0.5 cursor-pointer hover:text-foreground` | 重排（分组顺序） |
| 556 | `components/home/search/Search.tsx:285` | `w-auto rounded-xl p-3` | `p-3 w-auto rounded-xl` | 重排（分组顺序） |
| 557 | `components/home/search/Search.tsx:309` | `flex justify-end mt-2 pt-2 border-t border-border` | `flex justify-end pt-2 mt-2 border-t border-border` | 重排（分组顺序） |
| 558 | `components/home/tag/tagGameList.tsx:106` | `mt-6 flex justify-center` | `flex justify-center mt-6` | 重排（分组顺序） |
| 559 | `components/introduction/article-page.tsx:97` | `flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground` | `flex flex-wrap gap-x-2 gap-y-1 items-center text-xs text-muted-foreground` | 重排（分组顺序） |
| 560 | `components/introduction/article-page.tsx:98` | `inline-flex items-center gap-1` | `inline-flex gap-1 items-center` | 重排（分组顺序） |
| 561 | `components/introduction/article-page.tsx:163` | `mt-8 border-t border-border/60 pt-4 text-xs text-muted-foreground` | `pt-4 mt-8 text-xs text-muted-foreground border-t border-border/60` | 重排（分组顺序） |
| 562 | `components/introduction/introduction-page.tsx:49` | `flex min-w-0 flex-1 items-center gap-2 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset` | `flex flex-1 gap-2 items-center py-2.5 min-w-0 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60` | 重排（分组顺序） |
| 563 | `components/introduction/introduction-page.tsx:53` | `size-4 shrink-0 text-muted-foreground` | `shrink-0 size-4 text-muted-foreground` | 重排（分组顺序） |
| 564 | `components/introduction/introduction-page.tsx:65` | `ml-2 shrink-0 text-warning` | `shrink-0 ml-2 text-warning` | 重排（分组顺序） |
| 565 | `components/introduction/introduction-page.tsx:70` | `ml-2 shrink-0` | `shrink-0 ml-2` | 重排（分组顺序） |
| 566 | `components/introduction/introduction-page.tsx:191` | `group/row -mx-2 flex items-center justify-between gap-2 rounded-xl px-2` | `group/row flex gap-2 justify-between items-center px-2 -mx-2 rounded-xl` | 重排（分组顺序） |
| 567 | `components/introduction/introduction-page.tsx:199` | `flex shrink-0 items-center gap-1 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-focus-within/row:opacity-100 sm:group-hover/row:opacity-100` | `flex shrink-0 gap-1 items-center opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-focus-within/row:opacity-100 sm:group-hover/row:opacity-100` | 重排（分组顺序） |
| 568 | `components/markdown-components.tsx:9` | `scroll-m-20 text-2xl font-semibold tracking-tight` | `text-2xl font-semibold tracking-tight scroll-m-20` | 重排（分组顺序） |
| 569 | `components/markdown-components.tsx:18` | `scroll-m-20 border-b border-border/70 pb-2 text-xl font-semibold tracking-tight first:mt-0` | `pb-2 text-xl font-semibold tracking-tight border-b border-border/70 scroll-m-20 first:mt-0` | 重排（分组顺序） |
| 570 | `components/markdown-components.tsx:27` | `scroll-m-20 text-lg font-semibold tracking-tight` | `text-lg font-semibold tracking-tight scroll-m-20` | 重排（分组顺序） |
| 571 | `components/markdown-components.tsx:36` | `scroll-m-20 text-base font-semibold tracking-tight` | `text-base font-semibold tracking-tight scroll-m-20` | 重排（分组顺序） |
| 572 | `components/markdown-components.tsx:45` | `scroll-m-20 text-sm font-semibold tracking-tight` | `text-sm font-semibold tracking-tight scroll-m-20` | 重排（分组顺序） |
| 573 | `components/markdown-components.tsx:54` | `scroll-m-20 text-sm font-semibold tracking-tight` | `text-sm font-semibold tracking-tight scroll-m-20` | 重排（分组顺序） |
| 574 | `components/markdown-components.tsx:80` | `mt-6 border-l-2 border-border pl-6 text-muted-foreground italic` | `pl-6 mt-6 italic text-muted-foreground border-l-2 border-border` | 重排（分组顺序） |
| 575 | `components/markdown-components.tsx:95` | `my-6 w-full overflow-x-auto` | `overflow-x-auto my-6 w-full` | 重排（分组顺序） |
| 576 | `components/markdown-components.tsx:101` | `m-0 border-t p-0 even:bg-muted` | `p-0 m-0 border-t even:bg-muted` | 重排（分组顺序） |
| 577 | `components/markdown-components.tsx:108` | `border border-border/70 px-4 py-2 text-left font-medium [[align=center]]:text-center [[align=right]]:text-right` | `px-4 py-2 font-medium text-left border border-border/70 [[align=center]]:text-center [[align=right]]:text-right` | 重排（分组顺序） |
| 578 | `components/markdown-components.tsx:117` | `border px-4 py-2 text-left [[align=center]]:text-center [[align=right]]:text-right` | `px-4 py-2 text-left border [[align=center]]:text-center [[align=right]]:text-right` | 重排（分组顺序） |
| 579 | `components/markdown-components.tsx:126` | `mt-6 mb-4 overflow-x-auto rounded-xl border border-border/70 bg-muted px-4 py-4` | `overflow-x-auto p-4 mt-6 mb-4 bg-muted rounded-xl border border-border/70` | 合并 px-4 py-4 -> p-4 |
| 580 | `components/markdown-components.tsx:135` | `relative rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-medium` | `relative px-[0.3rem] py-[0.2rem] font-mono text-sm font-medium bg-muted rounded-md` | 重排（分组顺序） |
| 581 | `components/markdown-components.tsx:167` | `scroll-m-20 mt-6 mb-2 text-xl font-semibold tracking-tight first:mt-0` | `mt-6 mb-2 text-xl font-semibold tracking-tight scroll-m-20 first:mt-0` | 重排（分组顺序） |
| 582 | `components/markdown-components.tsx:176` | `scroll-m-20 mt-6 mb-2 text-lg font-semibold tracking-tight first:mt-0` | `mt-6 mb-2 text-lg font-semibold tracking-tight scroll-m-20 first:mt-0` | 重排（分组顺序） |
| 583 | `components/markdown-components.tsx:185` | `scroll-m-20 mt-5 mb-1.5 text-base font-semibold tracking-tight first:mt-0` | `mt-5 mb-1.5 text-base font-semibold tracking-tight scroll-m-20 first:mt-0` | 重排（分组顺序） |
| 584 | `components/markdown-components.tsx:194` | `scroll-m-20 mt-4 mb-1 text-sm font-semibold tracking-tight first:mt-0` | `mt-4 mb-1 text-sm font-semibold tracking-tight scroll-m-20 first:mt-0` | 重排（分组顺序） |
| 585 | `components/markdown-components.tsx:203` | `scroll-m-20 mt-4 mb-1 text-sm font-semibold first:mt-0` | `mt-4 mb-1 text-sm font-semibold scroll-m-20 first:mt-0` | 重排（分组顺序） |
| 586 | `components/markdown-components.tsx:212` | `scroll-m-20 mt-4 mb-1 text-sm font-semibold first:mt-0` | `mt-4 mb-1 text-sm font-semibold scroll-m-20 first:mt-0` | 重排（分组顺序） |
| 587 | `components/openapi-page.tsx:9` | `mx-auto w-full max-w-4xl py-6` | `py-6 mx-auto w-full max-w-4xl` | 重排（分组顺序） |
| 588 | `components/openapi-page.tsx:16` | `space-y-6 px-4 py-2 sm:px-6` | `px-4 py-2 space-y-6 sm:px-6` | 重排（分组顺序） |
| 589 | `components/producer/producer-detail-page.tsx:55` | `rounded-sm text-primary transition-colors duration-200 hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `text-primary rounded-sm transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 590 | `components/producer/producer-detail-page.tsx:70` | `text-2xl items-center` | `items-center text-2xl` | 重排（分组顺序） |
| 591 | `components/producer/producers-page.tsx:145` | `group rounded-2xl no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | `group no-underline rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 592 | `components/producer/producers-page.tsx:152` | `line-clamp-2 pt-0 text-sm text-muted-foreground` | `pt-0 text-sm line-clamp-2 text-muted-foreground` | 重排（分组顺序） |
| 593 | `components/RichContent.tsx:22` | `prose prose-sm sm:prose-base dark:prose-invert max-w-none break-words` | `max-w-none break-words prose prose-sm dark:prose-invert sm:prose-base` | 重排（分组顺序） |
| 594 | `components/shadcn-io/copy-button/index.tsx:10` | `inline-flex items-center justify-center cursor-pointer rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive` | `inline-flex shrink-0 justify-center items-center rounded-md outline-none transition-colors cursor-pointer focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 595 | `components/shadcn-io/copy-button/index.tsx:15` | `bg-primary text-primary-foreground shadow-xs hover:bg-primary/90` | `text-primary-foreground bg-primary shadow-xs hover:bg-primary/90` | 重排（分组顺序） |
| 596 | `components/shadcn-io/copy-button/index.tsx:16` | `bg-muted text-muted-foreground` | `text-muted-foreground bg-muted` | 重排（分组顺序） |
| 597 | `components/shadcn-io/copy-button/index.tsx:18` | `bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60` | `text-white bg-destructive shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40` | 重排（分组顺序） |
| 598 | `components/shadcn-io/copy-button/index.tsx:20` | `border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50` | `bg-background border shadow-xs hover:text-accent-foreground hover:bg-accent dark:bg-input/30 dark:border-input dark:hover:bg-input/50` | 重排（分组顺序） |
| 599 | `components/shadcn-io/copy-button/index.tsx:22` | `bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80` | `text-secondary-foreground bg-secondary shadow-xs hover:bg-secondary/80` | 重排（分组顺序） |
| 600 | `components/shadcn-io/copy-button/index.tsx:24` | `hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50` | `hover:text-accent-foreground hover:bg-accent dark:hover:bg-accent/50` | 重排（分组顺序） |
| 601 | `components/shared/empty-state.tsx:32` | `flex flex-col items-center justify-center px-6 text-center` | `flex flex-col justify-center items-center px-6 text-center` | 重排（分组顺序） |
| 602 | `components/shared/empty-state.tsx:34` | `rounded-2xl bg-card/60 ring-1 ring-border/60` | `bg-card/60 rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 603 | `components/shared/icon-tile.tsx:50` | `flex shrink-0 items-center justify-center` | `flex shrink-0 justify-center items-center` | 重排（分组顺序） |
| 604 | `components/shared/page-header.tsx:38` | `mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between` | `flex flex-col gap-4 mb-6 sm:flex-row sm:justify-between sm:items-start` | 重排（分组顺序） |
| 605 | `components/shared/page-header.tsx:45` | `flex min-w-0 flex-col gap-1.5` | `flex flex-col gap-1.5 min-w-0` | 重排（分组顺序） |
| 606 | `components/shared/page-header.tsx:56` | `flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1` | `flex flex-wrap gap-x-3 gap-y-1 items-center min-w-0` | 重排（分组顺序） |
| 607 | `components/shared/page-header.tsx:65` | `text-sm text-muted-foreground tabular-nums` | `text-sm tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 608 | `components/shared/page-header.tsx:77` | `flex shrink-0 flex-wrap items-center gap-2` | `flex flex-wrap shrink-0 gap-2 items-center` | 重排（分组顺序） |
| 609 | `components/shared/pagination.tsx:70` | `h-8 gap-1` | `gap-1 h-8` | 重排（分组顺序） |
| 610 | `components/shared/pagination.tsx:82` | `h-8 gap-1` | `gap-1 h-8` | 重排（分组顺序） |
| 611 | `components/shared/pagination.tsx:95` | `flex items-center justify-center gap-2 pt-8` | `flex gap-2 justify-center items-center pt-8` | 重排（分组顺序） |
| 612 | `components/shared/pagination.tsx:101` | `hidden text-sm text-muted-foreground tabular-nums sm:block` | `hidden text-sm tabular-nums text-muted-foreground sm:block` | 重排（分组顺序） |
| 613 | `components/shared/pagination.tsx:105` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 614 | `components/shared/pagination.tsx:109` | `px-1 text-sm text-muted-foreground tabular-nums` | `px-1 text-sm tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 615 | `components/shared/pagination.tsx:114` | `hidden items-center gap-1 sm:flex` | `hidden gap-1 items-center sm:flex` | 重排（分组顺序） |
| 616 | `components/shared/pagination.tsx:134` | `px-1 text-sm text-muted-foreground tabular-nums sm:hidden` | `px-1 text-sm tabular-nums text-muted-foreground sm:hidden` | 重排（分组顺序） |
| 617 | `components/shared/pagination.tsx:163` | `h-8 min-w-9 px-2 tabular-nums` | `px-2 min-w-9 h-8 tabular-nums` | 重排（分组顺序） |
| 618 | `components/shared/route-skeletons.tsx:19` | `flex items-center gap-2 mb-4` | `flex gap-2 items-center mb-4` | 重排（分组顺序） |
| 619 | `components/shared/route-skeletons.tsx:20` | `h-4 w-8` | `w-8 h-4` | 重排（分组顺序） |
| 620 | `components/shared/route-skeletons.tsx:21` | `h-4 w-2` | `w-2 h-4` | 重排（分组顺序） |
| 621 | `components/shared/route-skeletons.tsx:22` | `h-4 w-16` | `w-16 h-4` | 重排（分组顺序） |
| 622 | `components/shared/route-skeletons.tsx:23` | `h-4 w-2` | `w-2 h-4` | 重排（分组顺序） |
| 623 | `components/shared/route-skeletons.tsx:24` | `h-4 w-24` | `w-24 h-4` | 重排（分组顺序） |
| 624 | `components/shared/route-skeletons.tsx:36` | `h-8 w-24 rounded-full` | `w-24 h-8 rounded-full` | 重排（分组顺序） |
| 625 | `components/shared/route-skeletons.tsx:37` | `h-8 w-24 rounded-full` | `w-24 h-8 rounded-full` | 重排（分组顺序） |
| 626 | `components/shared/route-skeletons.tsx:38` | `h-8 w-24 rounded-full` | `w-24 h-8 rounded-full` | 重排（分组顺序） |
| 627 | `components/shared/route-skeletons.tsx:50` | `h-7 w-32 mb-1` | `mb-1 w-32 h-7` | 重排（分组顺序） |
| 628 | `components/shared/route-skeletons.tsx:51` | `h-4 w-56 mb-6` | `mb-6 w-56 h-4` | 重排（分组顺序） |
| 629 | `components/shared/route-skeletons.tsx:52` | `h-10 w-full max-w-lg rounded-lg mb-6` | `mb-6 w-full max-w-lg h-10 rounded-lg` | 重排（分组顺序） |
| 630 | `components/shared/route-skeletons.tsx:54` | `h-8 w-20 rounded-md` | `w-20 h-8 rounded-md` | 重排（分组顺序） |
| 631 | `components/shared/route-skeletons.tsx:55` | `h-8 w-20 rounded-md` | `w-20 h-8 rounded-md` | 重排（分组顺序） |
| 632 | `components/shared/route-skeletons.tsx:56` | `h-8 w-20 rounded-md` | `w-20 h-8 rounded-md` | 重排（分组顺序） |
| 633 | `components/shared/route-skeletons.tsx:57` | `h-8 w-20 rounded-md ml-auto` | `ml-auto w-20 h-8 rounded-md` | 重排（分组顺序） |
| 634 | `components/shared/route-skeletons.tsx:68` | `h-7 w-24` | `w-24 h-7` | 重排（分组顺序） |
| 635 | `components/shared/route-skeletons.tsx:69` | `h-10 w-full max-w-lg rounded-lg` | `w-full max-w-lg h-10 rounded-lg` | 重排（分组顺序） |
| 636 | `components/shared/route-skeletons.tsx:72` | `h-16 w-full rounded-lg` | `w-full h-16 rounded-lg` | 重排（分组顺序） |
| 637 | `components/shared/route-skeletons.tsx:85` | `h-7 w-48 mb-2` | `mb-2 w-48 h-7` | 重排（分组顺序） |
| 638 | `components/shared/route-skeletons.tsx:95` | `h-4 w-72 mb-6` | `mb-6 w-72 h-4` | 重排（分组顺序） |
| 639 | `components/shared/route-skeletons.tsx:105` | `flex items-center justify-between` | `flex justify-between items-center` | 重排（分组顺序） |
| 640 | `components/shared/route-skeletons.tsx:106` | `h-7 w-20` | `w-20 h-7` | 重排（分组顺序） |
| 641 | `components/shared/route-skeletons.tsx:107` | `h-9 w-24 rounded-md` | `w-24 h-9 rounded-md` | 重排（分组顺序） |
| 642 | `components/shared/route-skeletons.tsx:110` | `h-24 w-full rounded-lg` | `w-full h-24 rounded-lg` | 重排（分组顺序） |
| 643 | `components/shared/route-skeletons.tsx:120` | `rounded-xl border p-6 space-y-4` | `p-6 space-y-4 rounded-xl border` | 重排（分组顺序） |
| 644 | `components/shared/route-skeletons.tsx:121` | `h-7 w-3/4` | `w-3/4 h-7` | 重排（分组顺序） |
| 645 | `components/shared/route-skeletons.tsx:122` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 646 | `components/shared/route-skeletons.tsx:124` | `h-4 w-20` | `w-20 h-4` | 重排（分组顺序） |
| 647 | `components/shared/route-skeletons.tsx:125` | `h-3 w-16` | `w-16 h-3` | 重排（分组顺序） |
| 648 | `components/shared/route-skeletons.tsx:128` | `h-4 w-full` | `w-full h-4` | 重排（分组顺序） |
| 649 | `components/shared/route-skeletons.tsx:129` | `h-4 w-full` | `w-full h-4` | 重排（分组顺序） |
| 650 | `components/shared/route-skeletons.tsx:130` | `h-4 w-2/3` | `w-2/3 h-4` | 重排（分组顺序） |
| 651 | `components/shared/search-field.tsx:53` | `pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground` | `absolute top-1/2 left-3 size-4 text-muted-foreground -translate-y-1/2 pointer-events-none` | 重排（分组顺序） |
| 652 | `components/shared/search-field.tsx:65` | `h-9 rounded-xl bg-background/60 pr-9 pl-9` | `px-9 h-9 bg-background/60 rounded-xl` | 合并 pr-9 pl-9 -> px-9 |
| 653 | `components/shared/search-field.tsx:74` | `absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `flex absolute top-1/2 right-2 justify-center items-center size-6 text-muted-foreground rounded-md transition-colors -translate-y-1/2 hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 654 | `components/shared/section-header.tsx:8` | `inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground sm:text-sm` | `inline-flex gap-1 items-center text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground sm:text-sm` | 重排（分组顺序） |
| 655 | `components/shared/section-header.tsx:31` | `mb-4 flex items-center justify-between gap-3` | `flex gap-3 justify-between items-center mb-4` | 重排（分组顺序） |
| 656 | `components/shared/section-header.tsx:35` | `flex min-w-0 items-center gap-2.5` | `flex gap-2.5 items-center min-w-0` | 重排（分组顺序） |
| 657 | `components/shared/section-header.tsx:37` | `min-w-0 truncate text-lg font-semibold tracking-tight` | `min-w-0 text-lg font-semibold tracking-tight truncate` | 重排（分组顺序） |
| 658 | `components/shared/section-header.tsx:41` | `shrink-0 text-sm text-muted-foreground tabular-nums` | `shrink-0 text-sm tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 659 | `components/SmartMarkdown.tsx:20` | `whitespace-pre-wrap break-words` | `break-words whitespace-pre-wrap` | 重排（分组顺序） |
| 660 | `components/tags/collapsible-tag-list.tsx:141` | `size-3 rotate-180 transition-transform` | `size-3 transition-transform rotate-180` | 重排（分组顺序） |
| 661 | `components/tags/collapsible-tag-list.tsx:154` | `pointer-events-none invisible` | `invisible pointer-events-none` | 重排（分组顺序） |
| 662 | `components/tags/collapsible-tag-list.tsx:166` | `mb-2 flex items-baseline gap-1.5` | `flex gap-1.5 items-baseline mb-2` | 重排（分组顺序） |
| 663 | `components/tags/collapsible-tag-list.tsx:178` | `max-h-6 overflow-hidden` | `overflow-hidden max-h-6` | 重排（分组顺序） |
| 664 | `components/tags/tag-category-page.tsx:195` | `mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-muted/40 px-3 py-2 ring-1 ring-border/60` | `flex flex-wrap gap-2 items-center px-3 py-2 mb-4 bg-muted/40 rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 665 | `components/tags/tag-category-page.tsx:216` | `mt-2 grid grid-cols-2 gap-x-7 transition-opacity duration-200 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]` | `grid grid-cols-2 gap-x-7 mt-2 transition-opacity duration-200 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]` | 重排（分组顺序） |
| 666 | `components/tags/tag-category-page.tsx:218` | `pointer-events-none opacity-40` | `opacity-40 pointer-events-none` | 重排（分组顺序） |
| 667 | `components/tags/tag-category-page.tsx:224` | `pointer-events-none absolute inset-x-0 top-16 flex justify-center` | `flex absolute inset-x-0 top-16 justify-center pointer-events-none` | 重排（分组顺序） |
| 668 | `components/tags/tag-category-page.tsx:225` | `size-6 animate-spin text-muted-foreground` | `size-6 text-muted-foreground animate-spin` | 重排（分组顺序） |
| 669 | `components/tags/tag-category-page.tsx:253` | `-mx-1.5 flex items-baseline gap-3 rounded-sm border-b border-border/70 px-1.5 py-[5px] text-xs leading-[18px] no-underline transition-colors duration-200 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `flex gap-3 items-baseline px-1.5 py-[5px] -mx-1.5 text-xs leading-[18px] no-underline rounded-sm border-b border-border/70 transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 670 | `components/tags/tag-category-page.tsx:255` | `min-w-0 flex-1 truncate` | `flex-1 min-w-0 truncate` | 重排（分组顺序） |
| 671 | `components/tags/tag-category-page.tsx:297` | `inline-block h-4 w-12 rounded bg-muted` | `inline-block w-12 h-4 bg-muted rounded` | 重排（分组顺序） |
| 672 | `components/tags/tag-category-page.tsx:302` | `mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-muted/40 px-3 py-2 ring-1 ring-border/60` | `flex flex-wrap gap-2 items-center px-3 py-2 mb-4 bg-muted/40 rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 673 | `components/tags/tag-category-page.tsx:313` | `mt-2 grid grid-cols-2 gap-x-7 gap-y-[9px] sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]` | `grid grid-cols-2 gap-x-7 gap-y-[9px] mt-2 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]` | 重排（分组顺序） |
| 674 | `components/tags/tag-category-page.tsx:316` | `h-4 w-full` | `w-full h-4` | 重排（分组顺序） |
| 675 | `components/tags/tag-detail-page.tsx:36` | `text-2xl text-center items-center` | `items-center text-2xl text-center` | 重排（分组顺序） |
| 676 | `components/tags/tag-detail-page.tsx:40` | `text-sm text-muted-foreground leading-relaxed` | `text-sm leading-relaxed text-muted-foreground` | 重排（分组顺序） |
| 677 | `components/tags/tag-detail-page.tsx:61` | `text-muted-foreground text-xs tabular-nums` | `text-xs tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 678 | `components/tags/tag-detail-page.tsx:86` | `mt-6 mb-3 text-center text-xs text-muted-foreground` | `mt-6 mb-3 text-xs text-center text-muted-foreground` | 重排（分组顺序） |
| 679 | `components/tags/tag-detail-pending.tsx:80` | `h-4 w-20` | `w-20 h-4` | 重排（分组顺序） |
| 680 | `components/tags/tag-detail-pending.tsx:91` | `text-2xl text-center items-center` | `items-center text-2xl text-center` | 重排（分组顺序） |
| 681 | `components/tags/tag-detail-pending.tsx:92` | `mx-auto h-8 w-48` | `mx-auto w-48 h-8` | 重排（分组顺序） |
| 682 | `components/tags/tag-detail-pending.tsx:127` | `mt-6 mb-3 text-center text-xs text-muted-foreground` | `mt-6 mb-3 text-xs text-center text-muted-foreground` | 重排（分组顺序） |
| 683 | `components/tags/tag-detail-pending.tsx:141` | `flex flex-wrap gap-1.5 max-h-6 overflow-hidden` | `flex overflow-hidden flex-wrap gap-1.5 max-h-6` | 重排（分组顺序） |
| 684 | `components/tags/tag-detail-pending.tsx:156` | `relative mt-2 h-64 w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20` | `overflow-hidden relative mt-2 w-full h-64 bg-muted/20 rounded-2xl border border-border/60` | 重排（分组顺序） |
| 685 | `components/tags/tag-detail-pending.tsx:159` | `absolute top-2 left-2 h-5 w-40 rounded-full` | `absolute top-2 left-2 w-40 h-5 rounded-full` | 重排（分组顺序） |
| 686 | `components/tags/tag-detail-pending.tsx:160` | `absolute inset-0 flex items-center justify-center gap-3` | `flex absolute inset-0 gap-3 justify-center items-center` | 重排（分组顺序） |
| 687 | `components/tags/tag-detail-pending.tsx:161` | `h-7 w-24 rounded-lg` | `w-24 h-7 rounded-lg` | 重排（分组顺序） |
| 688 | `components/tags/tag-detail-pending.tsx:162` | `h-7 w-24 rounded-lg` | `w-24 h-7 rounded-lg` | 重排（分组顺序） |
| 689 | `components/tags/tag-detail-pending.tsx:163` | `h-7 w-24 rounded-lg` | `w-24 h-7 rounded-lg` | 重排（分组顺序） |
| 690 | `components/tags/tag-hierarchy.tsx:641` | `flex items-center justify-center rounded-lg border px-2.5 text-xs leading-none transition-all duration-150` | `flex justify-center items-center px-2.5 text-xs leading-none rounded-lg border transition-all duration-150` | 重排（分组顺序） |
| 691 | `components/tags/tag-hierarchy.tsx:646` | `border-primary/40 bg-primary font-medium text-primary-foreground shadow-md ring-[3px] ring-primary/20` | `font-medium text-primary-foreground bg-primary border-primary/40 ring-[3px] ring-primary/20 shadow-md` | 重排（分组顺序） |
| 692 | `components/tags/tag-hierarchy.tsx:648` | `border-border/80 bg-card text-foreground hover:-translate-y-px hover:border-primary/50 hover:bg-muted hover:shadow-sm` | `text-foreground bg-card border-border/80 hover:bg-muted hover:border-primary/50 hover:shadow-sm hover:-translate-y-px` | 重排（分组顺序） |
| 693 | `components/tags/tag-hierarchy.tsx:650` | `border-border/70 border-dashed bg-muted/30 text-muted-foreground` | `text-muted-foreground bg-muted/30 border-dashed border-border/70` | 重排（分组顺序） |
| 694 | `components/tags/tag-hierarchy.tsx:1097` | `animate-in fade-in-0 zoom-in-95 duration-200` | `duration-200 animate-in fade-in-0 zoom-in-95` | 重排（分组顺序） |
| 695 | `components/tags/tag-hierarchy.tsx:1121` | `relative mx-auto overflow-hidden rounded-2xl border select-none outline-none` | `overflow-hidden relative mx-auto rounded-2xl border outline-none select-none` | 重排（分组顺序） |
| 696 | `components/tags/tag-hierarchy.tsx:1126` | `cursor-grab border-2 border-primary shadow-lg ring-[3px] ring-primary/20` | `border-2 border-primary ring-[3px] ring-primary/20 shadow-lg cursor-grab` | 重排（分组顺序） |
| 697 | `components/tags/tag-hierarchy.tsx:1127` | `cursor-pointer border` | `border cursor-pointer` | 重排（分组顺序） |
| 698 | `components/tags/tag-hierarchy.tsx:1151` | `pointer-events-none absolute top-2 left-2 z-10 rounded-full border border-border/60 bg-popover/85 px-2.5 py-1 text-[11px] text-muted-foreground tabular-nums shadow-sm backdrop-blur` | `absolute top-2 left-2 z-10 px-2.5 py-1 text-[11px] tabular-nums text-muted-foreground bg-popover/85 rounded-full border border-border/60 shadow-sm backdrop-blur pointer-events-none` | 重排（分组顺序） |
| 699 | `components/tags/tag-hierarchy.tsx:1165` | `absolute inset-0 overflow-visible` | `overflow-visible absolute inset-0` | 重排（分组顺序） |
| 700 | `components/tags/tag-hierarchy.tsx:1216` | `pointer-events-none absolute flex items-center justify-center text-[10px] text-muted-foreground leading-none` | `flex absolute justify-center items-center text-[10px] leading-none text-muted-foreground pointer-events-none` | 重排（分组顺序） |
| 701 | `components/tags/tag-hierarchy.tsx:1233` | `absolute overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-sm` | `overflow-hidden absolute bg-card/95 rounded-xl border border-border/70 shadow-sm` | 重排（分组顺序） |
| 702 | `components/tags/tag-hierarchy.tsx:1265` | `flex items-center justify-center rounded-md border border-border/70 bg-muted/40 px-1.5 text-[11px] text-foreground leading-none transition-colors hover:border-primary/50 hover:bg-muted` | `flex justify-center items-center px-1.5 text-[11px] leading-none text-foreground bg-muted/40 rounded-md border border-border/70 transition-colors hover:bg-muted hover:border-primary/50` | 重排（分组顺序） |
| 703 | `components/tags/tag-hierarchy.tsx:1285` | `absolute inset-x-2 bottom-2 flex items-end justify-between gap-2` | `flex absolute inset-x-2 bottom-2 gap-2 justify-between items-end` | 重排（分组顺序） |
| 704 | `components/tags/tag-hierarchy.tsx:1288` | `flex items-center gap-1 rounded-full border border-border/60 bg-popover/85 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur select-none` | `flex gap-1 items-center px-2.5 py-1 text-[11px] text-muted-foreground bg-popover/85 rounded-full border border-border/60 shadow-sm backdrop-blur select-none` | 重排（分组顺序） |
| 705 | `components/tags/tag-hierarchy.tsx:1303` | `ml-auto flex items-center gap-0.5 rounded-full border border-border/60 bg-popover/85 p-0.5 shadow-sm backdrop-blur` | `flex gap-0.5 items-center p-0.5 ml-auto bg-popover/85 rounded-full border border-border/60 shadow-sm backdrop-blur` | 重排（分组顺序） |
| 706 | `components/tags/tag-hierarchy.tsx:1325` | `mx-0.5 h-4 w-px bg-border` | `mx-0.5 w-px h-4 bg-border` | 重排（分组顺序） |
| 707 | `components/tags/tag-hierarchy.tsx:1345` | `w-9 text-center text-[11px] text-muted-foreground tabular-nums` | `w-9 text-[11px] tabular-nums text-center text-muted-foreground` | 重排（分组顺序） |
| 708 | `components/tags/tag-hierarchy.tsx:1365` | `mx-0.5 h-4 w-px bg-border` | `mx-0.5 w-px h-4 bg-border` | 重排（分组顺序） |
| 709 | `components/tags/tag-sort-bar.tsx:136` | `flex flex-wrap items-center gap-2` | `flex flex-wrap gap-2 items-center` | 重排（分组顺序） |
| 710 | `components/tags/tag-sort-bar.tsx:137` | `flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground` | `flex shrink-0 gap-1.5 items-center text-sm text-muted-foreground` | 重排（分组顺序） |
| 711 | `components/tags/tag-sort-bar.tsx:153` | `h-8 w-28 rounded-lg border-0 bg-transparent px-2 font-medium text-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50` | `px-2 w-28 h-8 font-medium text-foreground bg-transparent rounded-lg border-0 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50` | 重排（分组顺序） |
| 712 | `components/tags/tag-sort-bar.tsx:178` | `h-8 w-20 rounded-lg border-0 bg-transparent px-2 font-medium text-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50` | `px-2 w-20 h-8 font-medium text-foreground bg-transparent rounded-lg border-0 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50` | 重排（分组顺序） |
| 713 | `components/tags/tags-page.tsx:36` | `-mx-1.5 flex items-baseline gap-3 rounded-sm border-b border-border/70 px-1.5 py-[5px] text-xs leading-[18px] no-underline transition-colors duration-200 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `flex gap-3 items-baseline px-1.5 py-[5px] -mx-1.5 text-xs leading-[18px] no-underline rounded-sm border-b border-border/70 transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 714 | `components/tags/tags-page.tsx:170` | `min-w-0 py-[5px]` | `py-[5px] min-w-0` | 重排（分组顺序） |
| 715 | `components/tags/tags-page.tsx:171` | `h-4 w-full` | `w-full h-4` | 重排（分组顺序） |
| 716 | `components/tags/tags-page.tsx:200` | `pointer-events-none opacity-60` | `opacity-60 pointer-events-none` | 重排（分组顺序） |
| 717 | `components/tags/tags-page.tsx:203` | `mb-3 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums` | `flex gap-1.5 items-center mb-3 text-xs tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 718 | `components/tags/tags-page.tsx:243` | `min-w-0 max-w-[70%] shrink-0 truncate font-medium` | `shrink-0 min-w-0 max-w-[70%] font-medium truncate` | 重排（分组顺序） |
| 719 | `components/tags/tags-page.tsx:247` | `min-w-0 flex-1 truncate text-right text-muted-foreground/80` | `flex-1 min-w-0 text-right text-muted-foreground/80 truncate` | 重排（分组顺序） |
| 720 | `components/tags/tags-page.tsx:308` | `flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-muted/40 px-3 py-2 ring-1 ring-border/60` | `flex flex-wrap gap-x-4 gap-y-2 justify-between items-center px-3 py-2 bg-muted/40 rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 721 | `components/tags/tags-page.tsx:309` | `text-sm text-muted-foreground tabular-nums` | `text-sm tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 722 | `components/tags/tags-page.tsx:330` | `pointer-events-none opacity-40` | `opacity-40 pointer-events-none` | 重排（分组顺序） |
| 723 | `components/tags/tags-page.tsx:343` | `pointer-events-none absolute inset-x-0 top-16 flex justify-center` | `flex absolute inset-x-0 top-16 justify-center pointer-events-none` | 重排（分组顺序） |
| 724 | `components/tags/tags-page.tsx:344` | `size-6 animate-spin text-muted-foreground` | `size-6 text-muted-foreground animate-spin` | 重排（分组顺序） |
| 725 | `components/tags/tags-page.tsx:393` | `rounded-sm transition-colors duration-200 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `rounded-sm transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 726 | `components/tags/tags-page.tsx:424` | `mt-4 grid grid-cols-2 gap-x-7 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]` | `grid grid-cols-2 gap-x-7 mt-4 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]` | 重排（分组顺序） |
| 727 | `components/tags/tags-page.tsx:441` | `min-w-0 flex-1 truncate` | `flex-1 min-w-0 truncate` | 重排（分组顺序） |
| 728 | `components/tags/tags-page.tsx:468` | `h-6 w-40` | `w-40 h-6` | 重排（分组顺序） |
| 729 | `components/tags/tags-page.tsx:469` | `h-3 w-56` | `w-56 h-3` | 重排（分组顺序） |
| 730 | `components/tags/tags-page.tsx:473` | `h-4 w-full` | `w-full h-4` | 重排（分组顺序） |
| 731 | `components/tags/tags-page.tsx:486` | `flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2 ring-1 ring-border/60` | `flex flex-wrap gap-3 justify-between items-center px-3 py-2 bg-muted/40 rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 732 | `components/tags/tags-page.tsx:487` | `h-4 w-24` | `w-24 h-4` | 重排（分组顺序） |
| 733 | `components/tags/tags-page.tsx:488` | `h-8 w-48` | `w-48 h-8` | 重排（分组顺序） |
| 734 | `components/tags/tags-page.tsx:505` | `h-9 w-full rounded-xl` | `w-full h-9 rounded-xl` | 重排（分组顺序） |
| 735 | `components/theme-menu.tsx:55` | `flex items-center gap-2 cursor-pointer` | `flex gap-2 items-center cursor-pointer` | 重排（分组顺序） |
| 736 | `components/theme-menu.tsx:60` | `size-4 ml-auto` | `ml-auto size-4` | 重排（分组顺序） |
| 737 | `components/theme-menu.tsx:64` | `flex items-center gap-2 cursor-pointer` | `flex gap-2 items-center cursor-pointer` | 重排（分组顺序） |
| 738 | `components/theme-menu.tsx:69` | `size-4 ml-auto` | `ml-auto size-4` | 重排（分组顺序） |
| 739 | `components/theme-menu.tsx:73` | `flex items-center gap-2 cursor-pointer` | `flex gap-2 items-center cursor-pointer` | 重排（分组顺序） |
| 740 | `components/theme-menu.tsx:78` | `size-4 ml-auto` | `ml-auto size-4` | 重排（分组顺序） |
| 741 | `components/tools/plate-page.tsx:101` | `mx-auto w-full max-w-2xl py-6` | `py-6 mx-auto w-full max-w-2xl` | 重排（分组顺序） |
| 742 | `components/tools/plate-page.tsx:112` | `pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground` | `absolute top-1/2 left-4 size-5 text-muted-foreground -translate-y-1/2 pointer-events-none` | 重排（分组顺序） |
| 743 | `components/tools/plate-page.tsx:119` | `h-12 rounded-2xl pl-12 text-lg` | `pl-12 h-12 text-lg rounded-2xl` | 重排（分组顺序） |
| 744 | `components/tools/plate-page.tsx:139` | `flex flex-wrap items-center gap-x-3 gap-y-2` | `flex flex-wrap gap-x-3 gap-y-2 items-center` | 重排（分组顺序） |
| 745 | `components/tools/plate-page.tsx:140` | `flex items-center gap-2.5 text-base font-medium` | `flex gap-2.5 items-center text-base font-medium` | 重排（分组顺序） |
| 746 | `components/tools/plate-page.tsx:141` | `flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary` | `flex shrink-0 justify-center items-center size-8 text-xs font-semibold text-primary bg-primary/10 rounded-lg` | 重排（分组顺序） |
| 747 | `components/tools/plate-page.tsx:155` | `flex flex-row items-center gap-4` | `flex flex-row gap-4 items-center` | 重排（分组顺序） |
| 748 | `components/tools/plate-page.tsx:161` | `flex cursor-pointer items-center gap-2 text-sm` | `flex gap-2 items-center text-sm cursor-pointer` | 重排（分组顺序） |
| 749 | `components/tools/plate-page.tsx:177` | `mb-2 truncate text-xs text-muted-foreground` | `mb-2 text-xs text-muted-foreground truncate` | 重排（分组顺序） |
| 750 | `components/tools/tools-page.tsx:23` | `mx-auto w-full max-w-3xl py-6` | `py-6 mx-auto w-full max-w-3xl` | 重排（分组顺序） |
| 751 | `components/tools/tools-page.tsx:40` | `flex items-center gap-3 text-base font-medium` | `flex gap-3 items-center text-base font-medium` | 重排（分组顺序） |
| 752 | `components/tools/tools-page.tsx:41` | `flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15` | `flex justify-center items-center size-9 text-primary bg-primary/10 rounded-xl transition-colors group-hover:bg-primary/15` | 重排（分组顺序） |
| 753 | `components/topics/topic-card.tsx:68` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 754 | `components/topics/topic-card.tsx:77` | `bg-muted text-xs text-muted-foreground` | `text-xs text-muted-foreground bg-muted` | 重排（分组顺序） |
| 755 | `components/topics/topic-card.tsx:82` | `inline-block truncate text-xs font-medium text-foreground/80` | `inline-block text-xs font-medium text-foreground/80 truncate` | 重排（分组顺序） |
| 756 | `components/topics/topic-card.tsx:87` | `ml-auto shrink-0 text-xs text-muted-foreground tabular-nums` | `shrink-0 ml-auto text-xs tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 757 | `components/topics/topic-card.tsx:99` | `line-clamp-2 text-sm leading-relaxed text-muted-foreground wrap-break-word` | `text-sm leading-relaxed line-clamp-2 wrap-break-word text-muted-foreground` | 重排（分组顺序） |
| 758 | `components/topics/topic-card.tsx:102` | `mt-2 flex items-center gap-3 text-xs text-muted-foreground tabular-nums` | `flex gap-3 items-center mt-2 text-xs tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 759 | `components/topics/topic-card.tsx:103` | `flex items-center gap-1` | `flex gap-1 items-center` | 重排（分组顺序） |
| 760 | `components/topics/topic-card.tsx:107` | `flex items-center gap-1` | `flex gap-1 items-center` | 重排（分组顺序） |
| 761 | `components/topics/topic-form.tsx:182` | `flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-end` | `flex flex-col gap-3 pt-5 border-t border-border/60 sm:flex-row sm:justify-end sm:items-center` | 重排（分组顺序） |
| 762 | `components/ui/accordion.tsx:10` | `flex w-full flex-col` | `flex flex-col w-full` | 重排（分组顺序） |
| 763 | `components/ui/accordion.tsx:36` | `group/accordion-trigger relative flex flex-1 items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-[color,background-color,border-color,box-shadow,text-decoration-color] outline-none hover:underline focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground` | `group/accordion-trigger flex relative flex-1 justify-between items-start py-2.5 text-sm font-medium text-left rounded-lg border border-transparent outline-none transition-[color,background-color,border-color,box-shadow,text-decoration-color] **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground hover:underline focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:opacity-50 aria-disabled:pointer-events-none` | 重排（分组顺序） |
| 764 | `components/ui/accordion.tsx:44` | `pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden` | `shrink-0 pointer-events-none group-aria-expanded/accordion-trigger:hidden` | 重排（分组顺序） |
| 765 | `components/ui/accordion.tsx:48` | `pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline` | `hidden shrink-0 pointer-events-none group-aria-expanded/accordion-trigger:inline` | 重排（分组顺序） |
| 766 | `components/ui/accordion.tsx:63` | `overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up` | `overflow-hidden text-sm data-closed:animate-accordion-up data-open:animate-accordion-down` | 重排（分组顺序） |
| 767 | `components/ui/accordion.tsx:68` | `h-(--accordion-panel-height) pt-0 pb-2.5 data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4` | `pt-0 pb-2.5 h-(--accordion-panel-height) data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4 [&_a]:hover:text-foreground` | 重排（分组顺序） |
| 768 | `components/ui/alert-dialog.tsx:33` | `fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0` | `isolate fixed inset-0 z-50 bg-black/10 duration-100 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 supports-backdrop-filter:backdrop-blur-xs` | 重排（分组顺序） |
| 769 | `components/ui/alert-dialog.tsx:55` | `group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95` | `group/alert-dialog-content grid fixed top-1/2 left-1/2 z-50 gap-4 p-4 w-full text-popover-foreground bg-popover rounded-xl outline-none ring-1 ring-foreground/10 duration-100 -translate-x-1/2 -translate-y-1/2 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[size=default]:sm:max-w-sm` | 重排（分组顺序） |
| 770 | `components/ui/alert-dialog.tsx:72` | `grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]` | `grid grid-rows-[auto_1fr] gap-1.5 place-items-center text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]` | 重排（分组顺序） |
| 771 | `components/ui/alert-dialog.tsx:88` | `-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end` | `flex flex-col-reverse gap-2 p-4 -mx-4 -mb-4 bg-muted/50 rounded-b-xl border-t group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end` | 重排（分组顺序） |
| 772 | `components/ui/alert-dialog.tsx:104` | `mb-2 inline-flex size-10 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6` | `inline-flex justify-center items-center mb-2 size-10 bg-muted rounded-md *:[svg:not([class*='size-'])]:size-6 sm:group-data-[size=default]/alert-dialog-content:row-span-2` | 重排（分组顺序） |
| 773 | `components/ui/alert-dialog.tsx:120` | `font-heading text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2` | `text-base font-medium font-heading sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2` | 重排（分组顺序） |
| 774 | `components/ui/alert-dialog.tsx:136` | `text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground` | `text-sm text-balance text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground md:text-pretty` | 重排（分组顺序） |
| 775 | `components/ui/alert.tsx:7` | `group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4` | `group/alert grid relative gap-0.5 px-2.5 py-2 w-full text-sm text-left rounded-lg border *:[svg:not([class*='size-'])]:size-4 *:[svg]:row-span-2 *:[svg]:text-current *:[svg]:translate-y-0.5 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18` | 重排（分组顺序） |
| 776 | `components/ui/alert.tsx:11` | `bg-card text-card-foreground` | `text-card-foreground bg-card` | 重排（分组顺序） |
| 777 | `components/ui/alert.tsx:13` | `bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current` | `text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current` | 重排（分组顺序） |
| 778 | `components/ui/alert.tsx:58` | `text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4` | `text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4 [&_a]:hover:text-foreground` | 重排（分组顺序） |
| 779 | `components/ui/avatar.tsx:20` | `group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten` | `group/avatar flex relative shrink-0 size-8 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten` | 重排（分组顺序） |
| 780 | `components/ui/avatar.tsx:33` | `aspect-square size-full rounded-full object-cover` | `object-cover aspect-square size-full rounded-full` | 重排（分组顺序） |
| 781 | `components/ui/avatar.tsx:49` | `flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs` | `flex justify-center items-center size-full text-sm text-muted-foreground bg-muted rounded-full group-data-[size=sm]/avatar:text-xs` | 重排（分组顺序） |
| 782 | `components/ui/avatar.tsx:62` | `absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none` | `inline-flex absolute right-0 bottom-0 z-10 justify-center items-center text-primary-foreground bg-blend-color bg-primary rounded-full ring-2 ring-background select-none` | 重排（分组顺序） |
| 783 | `components/ui/avatar.tsx:94` | `relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3` | `flex relative shrink-0 justify-center items-center size-8 text-sm text-muted-foreground bg-muted rounded-full ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3 [&>svg]:size-4` | 重排（分组顺序） |
| 784 | `components/ui/badge.tsx:8` | `group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!` | `group/badge inline-flex overflow-hidden shrink-0 gap-1 justify-center items-center px-2 py-0.5 w-fit h-5 text-xs font-medium whitespace-nowrap rounded-4xl border border-transparent transition-[color,background-color,border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:size-3! [&>svg]:pointer-events-none` | 重排（分组顺序） |
| 785 | `components/ui/badge.tsx:12` | `bg-primary text-primary-foreground [a]:hover:bg-primary/80` | `text-primary-foreground bg-primary [a]:hover:bg-primary/80` | 重排（分组顺序） |
| 786 | `components/ui/badge.tsx:14` | `bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80` | `text-secondary-foreground bg-secondary [a]:hover:bg-secondary/80` | 重排（分组顺序） |
| 787 | `components/ui/badge.tsx:16` | `bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20` | `text-destructive bg-destructive/10 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20` | 重排（分组顺序） |
| 788 | `components/ui/badge.tsx:18` | `border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground` | `text-foreground border-border [a]:hover:text-muted-foreground [a]:hover:bg-muted` | 重排（分组顺序） |
| 789 | `components/ui/badge.tsx:20` | `hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50` | `hover:text-muted-foreground hover:bg-muted dark:hover:bg-muted/50` | 重排（分组顺序） |
| 790 | `components/ui/breadcrumb.tsx:24` | `flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground wrap-break-word` | `flex flex-wrap gap-1.5 items-center text-xs wrap-break-word text-muted-foreground` | 重排（分组顺序） |
| 791 | `components/ui/breadcrumb.tsx:36` | `inline-flex items-center gap-1` | `inline-flex gap-1 items-center` | 重排（分组顺序） |
| 792 | `components/ui/breadcrumb.tsx:105` | `flex size-5 items-center justify-center [&>svg]:size-4` | `flex justify-center items-center size-5 [&>svg]:size-4` | 重排（分组顺序） |
| 793 | `components/ui/button.tsx:7` | `group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `group/button inline-flex shrink-0 justify-center items-center text-sm font-medium whitespace-nowrap bg-clip-padding rounded-lg border border-transparent outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-200 select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:opacity-50 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 794 | `components/ui/button.tsx:11` | `bg-primary text-primary-foreground hover:bg-primary/80` | `text-primary-foreground bg-primary hover:bg-primary/80` | 重排（分组顺序） |
| 795 | `components/ui/button.tsx:13` | `border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50` | `bg-background border-border hover:text-foreground hover:bg-muted aria-expanded:text-foreground aria-expanded:bg-muted dark:bg-input/30 dark:border-input dark:hover:bg-input/50` | 重排（分组顺序） |
| 796 | `components/ui/button.tsx:15` | `bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground` | `text-secondary-foreground bg-secondary hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:text-secondary-foreground aria-expanded:bg-secondary` | 重排（分组顺序） |
| 797 | `components/ui/button.tsx:17` | `hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50` | `hover:text-foreground hover:bg-muted aria-expanded:text-foreground aria-expanded:bg-muted dark:hover:bg-muted/50` | 重排（分组顺序） |
| 798 | `components/ui/button.tsx:19` | `bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40` | `text-destructive bg-destructive/10 hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40` | 重排（分组顺序） |
| 799 | `components/ui/button.tsx:24` | `h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2` | `gap-1.5 px-3 h-9 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2` | 重排（分组顺序） |
| 800 | `components/ui/button.tsx:25` | `h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3` | `gap-1 px-2 h-6 text-xs rounded-[min(var(--radius-md),10px)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3` | 重排（分组顺序） |
| 801 | `components/ui/button.tsx:26` | `h-8 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5` | `gap-1 px-2.5 h-8 text-[0.8rem] rounded-[min(var(--radius-md),12px)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5` | 重排（分组顺序） |
| 802 | `components/ui/button.tsx:27` | `h-10 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2` | `gap-1.5 px-3 h-10 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2` | 重排（分组顺序） |
| 803 | `components/ui/calendar.tsx:35` | `group/calendar bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent` | `group/calendar p-2 bg-background [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent` | 重排（分组顺序） |
| 804 | `components/ui/calendar.tsx:50` | `relative flex flex-col gap-4 md:flex-row` | `flex relative flex-col gap-4 md:flex-row` | 重排（分组顺序） |
| 805 | `components/ui/calendar.tsx:53` | `flex w-full flex-col gap-4` | `flex flex-col gap-4 w-full` | 重排（分组顺序） |
| 806 | `components/ui/calendar.tsx:55` | `absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1` | `flex absolute inset-x-0 top-0 gap-1 justify-between items-center w-full` | 重排（分组顺序） |
| 807 | `components/ui/calendar.tsx:60` | `size-(--cell-size) p-0 select-none aria-disabled:opacity-50` | `p-0 size-(--cell-size) select-none aria-disabled:opacity-50` | 重排（分组顺序） |
| 808 | `components/ui/calendar.tsx:65` | `size-(--cell-size) p-0 select-none aria-disabled:opacity-50` | `p-0 size-(--cell-size) select-none aria-disabled:opacity-50` | 重排（分组顺序） |
| 809 | `components/ui/calendar.tsx:69` | `flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)` | `flex justify-center items-center px-(--cell-size) w-full h-(--cell-size)` | 重排（分组顺序） |
| 810 | `components/ui/calendar.tsx:73` | `flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium` | `flex gap-1.5 justify-center items-center w-full h-(--cell-size) text-sm font-medium` | 重排（分组顺序） |
| 811 | `components/ui/calendar.tsx:88` | `flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground` | `flex gap-1 items-center text-sm rounded-(--cell-radius) [&>svg]:size-3.5 [&>svg]:text-muted-foreground` | 重排（分组顺序） |
| 812 | `components/ui/calendar.tsx:93` | `flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none` | `flex-1 text-[0.8rem] font-normal text-muted-foreground rounded-(--cell-radius) select-none` | 重排（分组顺序） |
| 813 | `components/ui/calendar.tsx:96` | `mt-2 flex w-full` | `flex mt-2 w-full` | 重排（分组顺序） |
| 814 | `components/ui/calendar.tsx:106` | `group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)` | `group/day relative aspect-square p-0 w-full h-full text-center rounded-(--cell-radius) select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)` | 重排（分组顺序） |
| 815 | `components/ui/calendar.tsx:113` | `relative isolate z-0 rounded-l-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted` | `isolate relative z-0 bg-muted rounded-l-(--cell-radius) after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted` | 重排（分组顺序） |
| 816 | `components/ui/calendar.tsx:118` | `relative isolate z-0 rounded-r-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted` | `isolate relative z-0 bg-muted rounded-r-(--cell-radius) after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted` | 重排（分组顺序） |
| 817 | `components/ui/calendar.tsx:122` | `rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none` | `text-foreground bg-muted rounded-(--cell-radius) data-[selected=true]:rounded-none` | 重排（分组顺序） |
| 818 | `components/ui/calendar.tsx:173` | `flex size-(--cell-size) items-center justify-center text-center` | `flex justify-center items-center size-(--cell-size) text-center` | 重排（分组顺序） |
| 819 | `components/ui/calendar.tsx:216` | `relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70` | `flex isolate relative z-10 aspect-square flex-col gap-1 size-auto w-full min-w-(--cell-size) font-normal leading-none border-0 group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-middle=true]:text-foreground data-[range-middle=true]:bg-muted data-[range-middle=true]:rounded-none data-[range-start=true]:text-primary-foreground data-[range-start=true]:bg-primary data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[selected-single=true]:text-primary-foreground data-[selected-single=true]:bg-primary dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70` | 重排（分组顺序） |
| 820 | `components/ui/card.tsx:15` | `group/card flex flex-col gap-4 overflow-hidden rounded-2xl bg-card py-4 text-sm text-card-foreground ring-1 ring-border/60 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-2xl *:[img:last-child]:rounded-b-2xl` | `group/card flex overflow-hidden flex-col gap-4 py-4 text-sm text-card-foreground bg-card rounded-2xl ring-1 ring-border/60 *:[img:first-child]:rounded-t-2xl *:[img:last-child]:rounded-b-2xl has-[>img:first-child]:pt-0 has-data-[slot=card-footer]:pb-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0` | 重排（分组顺序） |
| 821 | `components/ui/card.tsx:28` | `group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-2xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3` | `group/card-header grid @container/card-header auto-rows-min gap-1 items-start px-4 rounded-t-2xl group-data-[size=sm]/card:px-3 group-data-[size=sm]/card:[.border-b]:pb-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4` | 重排（分组顺序） |
| 822 | `components/ui/card.tsx:64` | `col-start-2 row-span-2 row-start-1 self-start justify-self-end` | `col-start-2 row-span-2 row-start-1 justify-self-end self-start` | 重排（分组顺序） |
| 823 | `components/ui/card.tsx:87` | `flex items-center rounded-b-2xl border-t border-border/70 bg-muted/40 p-4 group-data-[size=sm]/card:p-3` | `flex items-center p-4 bg-muted/40 rounded-b-2xl border-t border-border/70 group-data-[size=sm]/card:p-3` | 重排（分组顺序） |
| 824 | `components/ui/chart.tsx:66` | `flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden` | `flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden` | 重排（分组顺序） |
| 825 | `components/ui/chart.tsx:192` | `grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl` | `grid gap-1.5 items-start px-2.5 py-1.5 min-w-32 text-xs bg-background rounded-lg border border-border/50 shadow-xl` | 重排（分组顺序） |
| 826 | `components/ui/chart.tsx:209` | `flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground` | `flex flex-wrap gap-2 items-stretch w-full [&>svg]:w-2.5 [&>svg]:h-2.5 [&>svg]:text-muted-foreground` | 重排（分组顺序） |
| 827 | `components/ui/chart.tsx:223` | `shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)` | `shrink-0 bg-(--color-bg) rounded-[2px] border-(--color-border)` | 重排（分组顺序） |
| 828 | `components/ui/chart.tsx:225` | `h-2.5 w-2.5` | `w-2.5 h-2.5` | 重排（分组顺序） |
| 829 | `components/ui/chart.tsx:227` | `w-0 border-[1.5px] border-dashed bg-transparent` | `w-0 bg-transparent border-[1.5px] border-dashed` | 重排（分组顺序） |
| 830 | `components/ui/chart.tsx:254` | `font-mono font-medium text-foreground tabular-nums` | `font-mono font-medium tabular-nums text-foreground` | 重排（分组顺序） |
| 831 | `components/ui/chart.tsx:292` | `flex items-center justify-center gap-4` | `flex gap-4 justify-center items-center` | 重排（分组顺序） |
| 832 | `components/ui/chart.tsx:307` | `flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground` | `flex gap-1.5 items-center [&>svg]:w-3 [&>svg]:h-3 [&>svg]:text-muted-foreground` | 重排（分组顺序） |
| 833 | `components/ui/chart.tsx:314` | `h-2 w-2 shrink-0 rounded-[2px]` | `shrink-0 w-2 h-2 rounded-[2px]` | 重排（分组顺序） |
| 834 | `components/ui/dialog.tsx:32` | `fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0` | `isolate fixed inset-0 z-50 bg-black/10 duration-100 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 supports-backdrop-filter:backdrop-blur-xs` | 重排（分组顺序） |
| 835 | `components/ui/dialog.tsx:54` | `fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95` | `grid fixed top-1/2 left-1/2 z-50 gap-4 p-4 w-full max-w-[calc(100%-2rem)] text-sm text-popover-foreground bg-popover rounded-xl outline-none ring-1 ring-foreground/10 duration-100 -translate-x-1/2 -translate-y-1/2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 sm:max-w-sm` | 重排（分组顺序） |
| 836 | `components/ui/dialog.tsx:102` | `-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end` | `flex flex-col-reverse gap-2 p-4 -mx-4 -mb-4 bg-muted/50 rounded-b-xl border-t sm:flex-row sm:justify-end` | 重排（分组顺序） |
| 837 | `components/ui/dialog.tsx:122` | `font-heading text-base leading-none font-medium` | `text-base leading-none font-medium font-heading` | 重排（分组顺序） |
| 838 | `components/ui/drawer.tsx:21` | `[--backdrop-opacity:0.4] fixed inset-0 z-50 bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs` | `fixed inset-0 z-50 bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-150 [--backdrop-opacity:0.4] data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs` | 重排（分组顺序） |
| 839 | `components/ui/drawer.tsx:37` | `fixed inset-0 z-50 flex items-end justify-center` | `flex fixed inset-0 z-50 justify-center items-end` | 重排（分组顺序） |
| 840 | `components/ui/drawer.tsx:62` | `relative flex galzy-max-h-85dvh w-full flex-col overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-popover text-sm text-popover-foreground shadow-lg outline-none touch-auto [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-200 ease-in-out data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] sm:max-w-lg sm:rounded-2xl sm:border` | `galzy-max-h-85dvh flex overflow-y-auto overscroll-contain relative flex-col w-full text-sm text-popover-foreground bg-popover rounded-t-2xl border-t outline-none shadow-lg transition-transform duration-200 ease-in-out touch-auto [transform:translateY(var(--drawer-swipe-movement-y))] data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] sm:max-w-lg sm:rounded-2xl sm:border` | 重排（分组顺序） |
| 841 | `components/ui/drawer.tsx:71` | `mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted` | `shrink-0 mx-auto mt-3 w-10 h-1.5 bg-muted rounded-full` | 重排（分组顺序） |
| 842 | `components/ui/drawer.tsx:78` | `absolute top-3 right-3 rounded-xs p-1.5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring` | `absolute top-3 right-3 p-1.5 text-muted-foreground rounded-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring` | 重排（分组顺序） |
| 843 | `components/ui/drawer.tsx:104` | `mt-auto flex flex-col gap-2 p-4` | `flex flex-col gap-2 p-4 mt-auto` | 重排（分组顺序） |
| 844 | `components/ui/drawer.tsx:115` | `font-heading text-base font-medium text-foreground` | `text-base font-medium text-foreground font-heading` | 重排（分组顺序） |
| 845 | `components/ui/dropdown-menu.tsx:43` | `z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-border/60 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95` | `overflow-x-hidden overflow-y-auto z-50 p-1 w-(--anchor-width) min-w-32 max-h-(--available-height) text-popover-foreground bg-popover rounded-xl outline-none ring-1 ring-border/60 shadow-md duration-100 origin-(--transform-origin) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:overflow-hidden data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` | 重排（分组顺序） |
| 846 | `components/ui/dropdown-menu.tsx:92` | `group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive` | `group/dropdown-menu-item flex relative gap-1.5 items-center px-1.5 py-1 text-sm rounded-md outline-hidden cursor-default select-none focus:text-accent-foreground focus:bg-accent not-data-[variant=destructive]:focus:**:text-accent-foreground data-[variant=destructive]:text-destructive data-disabled:opacity-50 data-disabled:pointer-events-none data-inset:pl-7 data-[variant=destructive]:*:[svg]:text-destructive data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 847 | `components/ui/dropdown-menu.tsx:117` | `flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-popup-open:bg-accent data-popup-open:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `flex gap-1.5 items-center px-1.5 py-1 text-sm rounded-md outline-hidden cursor-default select-none focus:text-accent-foreground focus:bg-accent not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-open:text-accent-foreground data-open:bg-accent data-popup-open:text-accent-foreground data-popup-open:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 848 | `components/ui/dropdown-menu.tsx:140` | `w-auto min-w-[96px] rounded-xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-border/60 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95` | `p-1 w-auto min-w-[96px] text-popover-foreground bg-popover rounded-xl ring-1 ring-border/60 shadow-lg duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` | 重排（分组顺序） |
| 849 | `components/ui/dropdown-menu.tsx:166` | `relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `flex relative gap-1.5 items-center py-1 pr-8 pl-1.5 text-sm rounded-md outline-hidden cursor-default select-none focus:text-accent-foreground focus:bg-accent focus:**:text-accent-foreground data-disabled:opacity-50 data-disabled:pointer-events-none data-inset:pl-7 [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 850 | `components/ui/dropdown-menu.tsx:173` | `pointer-events-none absolute right-2 flex items-center justify-center` | `flex absolute right-2 justify-center items-center pointer-events-none` | 重排（分组顺序） |
| 851 | `components/ui/dropdown-menu.tsx:207` | `relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `flex relative gap-1.5 items-center py-1 pr-8 pl-1.5 text-sm rounded-md outline-hidden cursor-default select-none focus:text-accent-foreground focus:bg-accent focus:**:text-accent-foreground data-disabled:opacity-50 data-disabled:pointer-events-none data-inset:pl-7 [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 852 | `components/ui/dropdown-menu.tsx:213` | `pointer-events-none absolute right-2 flex items-center justify-center` | `flex absolute right-2 justify-center items-center pointer-events-none` | 重排（分组顺序） |
| 853 | `components/ui/field.tsx:44` | `group/field-group @container/field-group flex w-full flex-col gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4` | `group/field-group flex @container/field-group flex-col gap-5 w-full *:data-[slot=field-group]:gap-4 data-[slot=checkbox-group]:gap-3` | 重排（分组顺序） |
| 854 | `components/ui/field.tsx:53` | `group/field flex w-full gap-2 data-[invalid=true]:text-destructive` | `group/field flex gap-2 w-full data-[invalid=true]:text-destructive` | 重排（分组顺序） |
| 855 | `components/ui/field.tsx:59` | `flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px` | `flex-row items-center *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px` | 重排（分组顺序） |
| 856 | `components/ui/field.tsx:61` | `flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px` | `flex-col *:w-full [&>.sr-only]:w-auto @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:*:data-[slot=field-label]:flex-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px` | 重排（分组顺序） |
| 857 | `components/ui/field.tsx:91` | `group/field-content flex flex-1 flex-col gap-0.5 leading-snug` | `group/field-content flex flex-col flex-1 gap-0.5 leading-snug` | 重排（分组顺序） |
| 858 | `components/ui/field.tsx:107` | `group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border *:data-[slot=field]:p-2.5 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10` | `group/field-label peer/field-label flex gap-2 w-fit leading-snug *:data-[slot=field]:p-2.5 group-data-[disabled=true]/field:opacity-50 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border has-data-checked:bg-primary/5 has-data-checked:border-primary/30 dark:has-data-checked:bg-primary/10 dark:has-data-checked:border-primary/20` | 重排（分组顺序） |
| 859 | `components/ui/field.tsx:108` | `has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col` | `has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:w-full` | 重排（分组顺序） |
| 860 | `components/ui/field.tsx:121` | `flex w-fit items-center gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50` | `flex gap-2 items-center w-fit text-sm font-medium group-data-[disabled=true]/field:opacity-50` | 重排（分组顺序） |
| 861 | `components/ui/field.tsx:134` | `text-left text-sm leading-normal font-normal text-muted-foreground group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5` | `text-sm leading-normal font-normal text-left text-muted-foreground group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5` | 重排（分组顺序） |
| 862 | `components/ui/field.tsx:136` | `[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary` | `[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4` | 重排（分组顺序） |
| 863 | `components/ui/field.tsx:164` | `relative mx-auto block w-fit bg-background px-2 text-muted-foreground` | `block relative px-2 mx-auto w-fit text-muted-foreground bg-background` | 重排（分组顺序） |
| 864 | `components/ui/field.tsx:200` | `ml-4 flex list-disc flex-col gap-1` | `flex flex-col gap-1 ml-4 list-disc` | 重排（分组顺序） |
| 865 | `components/ui/input-group.tsx:15` | `group/input-group relative flex h-9 w-full min-w-0 items-center rounded-xl border border-input bg-background/60 transition-colors duration-200 outline-none in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-disabled:bg-input/50 has-disabled:opacity-50 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-2 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto dark:bg-input/30 dark:has-disabled:bg-input/80 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5` | `group/input-group flex relative items-center w-full min-w-0 h-9 bg-background/60 rounded-xl border border-input outline-none transition-colors duration-200 has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>textarea]:h-auto has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-2 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-disabled:bg-input/50 has-disabled:opacity-50 has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5 in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 dark:bg-input/30 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 dark:has-disabled:bg-input/80` | 重排（分组顺序） |
| 866 | `components/ui/input-group.tsx:24` | `flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4` | `flex gap-2 justify-center items-center py-1.5 h-auto text-sm font-medium text-muted-foreground cursor-text select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4` | 重排（分组顺序） |
| 867 | `components/ui/input-group.tsx:33` | `order-first w-full justify-start px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2` | `order-first justify-start px-2.5 pt-2 w-full group-has-[>input]/input-group:pt-2 [.border-b]:pb-2` | 重排（分组顺序） |
| 868 | `components/ui/input-group.tsx:35` | `order-last w-full justify-start px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2` | `order-last justify-start px-2.5 pb-2 w-full group-has-[>input]/input-group:pb-2 [.border-t]:pt-2` | 重排（分组顺序） |
| 869 | `components/ui/input-group.tsx:67` | `flex items-center gap-2 text-sm shadow-none` | `flex gap-2 items-center text-sm shadow-none` | 重排（分组顺序） |
| 870 | `components/ui/input-group.tsx:71` | `h-6 gap-1 rounded-[calc(var(--radius)-3px)] px-1.5 [&>svg:not([class*='size-'])]:size-3.5` | `gap-1 px-1.5 h-6 rounded-[calc(var(--radius)-3px)] [&>svg:not([class*='size-'])]:size-3.5` | 重排（分组顺序） |
| 871 | `components/ui/input-group.tsx:74` | `size-6 rounded-[calc(var(--radius)-3px)] p-0 has-[>svg]:p-0` | `p-0 size-6 rounded-[calc(var(--radius)-3px)] has-[>svg]:p-0` | 重排（分组顺序） |
| 872 | `components/ui/input-group.tsx:75` | `size-8 p-0 has-[>svg]:p-0` | `p-0 size-8 has-[>svg]:p-0` | 重排（分组顺序） |
| 873 | `components/ui/input-group.tsx:107` | `flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4` | `flex gap-2 items-center text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 874 | `components/ui/input-group.tsx:123` | `flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent` | `flex-1 bg-transparent rounded-none border-0 ring-0 shadow-none focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent` | 重排（分组顺序） |
| 875 | `components/ui/input-group.tsx:139` | `flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent` | `flex-1 py-2 bg-transparent rounded-none border-0 ring-0 shadow-none resize-none focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent` | 重排（分组顺序） |
| 876 | `components/ui/input-otp.tsx:56` | `relative flex size-8 items-center justify-center border-y border-r border-input text-sm transition-[color,background-color,border-color,box-shadow] outline-none first:rounded-l-lg first:border-l last:rounded-r-lg aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-2 data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40` | `flex relative justify-center items-center size-8 text-sm border-y border-r border-input outline-none transition-[color,background-color,border-color,box-shadow] first:rounded-l-lg first:border-l last:rounded-r-lg aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-2 data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40` | 重排（分组顺序） |
| 877 | `components/ui/input-otp.tsx:63` | `pointer-events-none absolute inset-0 flex items-center justify-center` | `flex absolute inset-0 justify-center items-center pointer-events-none` | 重排（分组顺序） |
| 878 | `components/ui/input-otp.tsx:64` | `h-4 w-px animate-caret-blink bg-foreground duration-1000` | `w-px h-4 bg-foreground duration-1000 animate-caret-blink` | 重排（分组顺序） |
| 879 | `components/ui/input.tsx:11` | `h-9 w-full min-w-0 rounded-xl border border-input bg-background/60 px-3 py-1 text-base transition-colors duration-200 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40` | `px-3 py-1 w-full min-w-0 h-9 text-base bg-background/60 rounded-xl border border-input outline-none transition-colors duration-200 file:inline-flex file:h-6 file:text-sm file:font-medium file:text-foreground file:bg-transparent file:border-0 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:bg-input/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 md:text-sm` | 重排（分组顺序） |
| 880 | `components/ui/item.tsx:15` | `group/item-group flex w-full flex-col gap-4 has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2` | `group/item-group flex flex-col gap-4 w-full has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2` | 重排（分组顺序） |
| 881 | `components/ui/item.tsx:38` | `group/item flex w-full flex-wrap items-center rounded-lg border text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-muted` | `group/item flex flex-wrap items-center w-full text-sm rounded-lg border outline-none transition-colors duration-100 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-muted` | 重排（分组顺序） |
| 882 | `components/ui/item.tsx:44` | `border-transparent bg-muted/50` | `bg-muted/50 border-transparent` | 重排（分组顺序） |
| 883 | `components/ui/item.tsx:84` | `flex shrink-0 items-center justify-center gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start [&_svg]:pointer-events-none` | `flex shrink-0 gap-2 justify-center items-center group-has-data-[slot=item-description]/item:self-start group-has-data-[slot=item-description]/item:translate-y-0.5 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 884 | `components/ui/item.tsx:91` | `size-10 overflow-hidden rounded-sm group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover` | `overflow-hidden size-10 rounded-sm group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:object-cover [&_img]:size-full` | 重排（分组顺序） |
| 885 | `components/ui/item.tsx:120` | `flex flex-1 flex-col gap-1 group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none` | `flex flex-col flex-1 gap-1 group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none` | 重排（分组顺序） |
| 886 | `components/ui/item.tsx:133` | `line-clamp-1 flex w-fit items-center gap-2 text-sm leading-snug font-medium underline-offset-4` | `line-clamp-1 flex gap-2 items-center w-fit text-sm leading-snug font-medium underline-offset-4` | 重排（分组顺序） |
| 887 | `components/ui/item.tsx:146` | `line-clamp-2 text-left text-sm leading-normal font-normal text-muted-foreground group-data-[size=xs]/item:text-xs [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary` | `text-sm leading-normal font-normal line-clamp-2 text-left text-muted-foreground group-data-[size=xs]/item:text-xs [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4` | 重排（分组顺序） |
| 888 | `components/ui/item.tsx:158` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 889 | `components/ui/item.tsx:169` | `flex basis-full items-center justify-between gap-2` | `flex basis-full gap-2 justify-between items-center` | 重排（分组顺序） |
| 890 | `components/ui/item.tsx:182` | `flex basis-full items-center justify-between gap-2` | `flex basis-full gap-2 justify-between items-center` | 重排（分组顺序） |
| 891 | `components/ui/label.tsx:10` | `flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50` | `flex gap-2 items-center text-sm leading-none font-medium select-none group-data-[disabled=true]:opacity-50 group-data-[disabled=true]:pointer-events-none peer-disabled:opacity-50 peer-disabled:cursor-not-allowed` | 重排（分组顺序） |
| 892 | `components/ui/navigation-menu.tsx:18` | `group/navigation-menu relative flex max-w-max flex-1 items-center justify-center` | `group/navigation-menu flex relative flex-1 justify-center items-center max-w-max` | 重排（分组顺序） |
| 893 | `components/ui/navigation-menu.tsx:37` | `group flex flex-1 list-none items-center justify-center gap-0` | `group flex flex-1 gap-0 justify-center items-center list-none` | 重排（分组顺序） |
| 894 | `components/ui/navigation-menu.tsx:59` | `group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition-[color,background-color,border-color,box-shadow] outline-none hover:bg-muted focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-muted/50 data-popup-open:hover:bg-muted data-open:bg-muted/50 data-open:hover:bg-muted data-open:focus:bg-muted` | `group/navigation-menu-trigger inline-flex justify-center items-center px-2.5 py-1.5 w-max h-9 text-sm font-medium rounded-lg outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-muted focus:bg-muted focus-visible:outline-1 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:pointer-events-none data-open:bg-muted/50 data-popup-open:bg-muted/50 data-open:hover:bg-muted data-popup-open:hover:bg-muted data-open:focus:bg-muted` | 重排（分组顺序） |
| 895 | `components/ui/navigation-menu.tsx:75` | `relative top-px ml-1 size-3 transition duration-300 group-data-popup-open/navigation-menu-trigger:rotate-180 group-data-open/navigation-menu-trigger:rotate-180` | `relative top-px ml-1 size-3 transition duration-300 group-data-open/navigation-menu-trigger:rotate-180 group-data-popup-open/navigation-menu-trigger:rotate-180` | 重排（分组顺序） |
| 896 | `components/ui/navigation-menu.tsx:90` | `data-ending-style:data-activation-direction=left:translate-x-[50%] data-ending-style:data-activation-direction=right:translate-x-[-50%] data-starting-style:data-activation-direction=left:translate-x-[-50%] data-starting-style:data-activation-direction=right:translate-x-[50%] h-full w-auto p-1 transition-[opacity,transform,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[viewport=false]/navigation-menu:rounded-xl group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:shadow group-data-[viewport=false]/navigation-menu:ring-1 group-data-[viewport=false]/navigation-menu:ring-border/60 group-data-[viewport=false]/navigation-menu:duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 data-[motion^=from-]:animate-in data-[motion^=from-]:fade-in data-[motion^=to-]:animate-out data-[motion^=to-]:fade-out **:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none group-data-[viewport=false]/navigation-menu:data-open:animate-in group-data-[viewport=false]/navigation-menu:data-open:fade-in-0 group-data-[viewport=false]/navigation-menu:data-open:zoom-in-95 group-data-[viewport=false]/navigation-menu:data-closed:animate-out group-data-[viewport=false]/navigation-menu:data-closed:fade-out-0 group-data-[viewport=false]/navigation-menu:data-closed:zoom-out-95` | `p-1 w-auto h-full transition-[opacity,transform,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] **:data-[slot=navigation-menu-link]:focus:outline-none **:data-[slot=navigation-menu-link]:focus:ring-0 group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:rounded-xl group-data-[viewport=false]/navigation-menu:ring-1 group-data-[viewport=false]/navigation-menu:ring-border/60 group-data-[viewport=false]/navigation-menu:shadow group-data-[viewport=false]/navigation-menu:duration-300 group-data-[viewport=false]/navigation-menu:data-closed:animate-out group-data-[viewport=false]/navigation-menu:data-closed:fade-out-0 group-data-[viewport=false]/navigation-menu:data-closed:zoom-out-95 group-data-[viewport=false]/navigation-menu:data-open:animate-in group-data-[viewport=false]/navigation-menu:data-open:fade-in-0 group-data-[viewport=false]/navigation-menu:data-open:zoom-in-95 data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 data-[motion^=from-]:animate-in data-[motion^=from-]:fade-in data-[motion^=to-]:animate-out data-[motion^=to-]:fade-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:data-activation-direction=left:translate-x-[50%] data-ending-style:data-activation-direction=right:translate-x-[-50%] data-starting-style:data-activation-direction=left:translate-x-[-50%] data-starting-style:data-activation-direction=right:translate-x-[50%]` | 重排（分组顺序） |
| 897 | `components/ui/navigation-menu.tsx:114` | `isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0` | `isolate z-50 w-(--positioner-width) max-w-(--available-width) h-(--positioner-height) transition-[top,left,right,bottom] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0` | 重排（分组顺序） |
| 898 | `components/ui/navigation-menu.tsx:119` | `data-[ending-style]:easing-[ease] xs:w-(--popup-width) relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) rounded-xl bg-popover text-popover-foreground shadow ring-1 ring-foreground/10 transition-[opacity,transform,width,height,scale,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-90 data-starting-style:opacity-0` | `relative w-(--popup-width) h-(--popup-height) text-popover-foreground bg-popover rounded-xl outline-none ring-1 ring-foreground/10 shadow transition-[opacity,transform,width,height,scale,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] origin-(--transform-origin) data-[ending-style]:easing-[ease] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:scale-90 data-starting-style:opacity-0 data-starting-style:scale-90 xs:w-(--popup-width)` | 重排（分组顺序） |
| 899 | `components/ui/navigation-menu.tsx:120` | `relative size-full overflow-hidden` | `overflow-hidden relative size-full` | 重排（分组顺序） |
| 900 | `components/ui/navigation-menu.tsx:135` | `flex items-center gap-2 rounded-lg p-2 text-sm transition-[color,background-color,border-color,box-shadow] outline-none hover:bg-muted focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-1 in-data-[slot=navigation-menu-content]:rounded-md data-active:bg-muted/50 data-active:hover:bg-muted data-active:focus:bg-muted [&_svg:not([class*='size-'])]:size-4` | `flex gap-2 items-center p-2 text-sm rounded-lg outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-muted focus:bg-muted focus-visible:outline-1 focus-visible:ring-2 focus-visible:ring-ring/50 in-data-[slot=navigation-menu-content]:rounded-md data-active:bg-muted/50 data-active:hover:bg-muted data-active:focus:bg-muted [&_svg:not([class*='size-'])]:size-4` | 重排（分组顺序） |
| 901 | `components/ui/navigation-menu.tsx:151` | `top-full z-1 flex h-1.5 items-end justify-center overflow-hidden data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:animate-in data-[state=visible]:fade-in` | `flex overflow-hidden top-full z-1 justify-center items-end h-1.5 data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:animate-in data-[state=visible]:fade-in` | 重排（分组顺序） |
| 902 | `components/ui/navigation-menu.tsx:156` | `relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md` | `relative top-[60%] w-2 h-2 bg-border rounded-tl-sm shadow-md rotate-45` | 重排（分组顺序） |
| 903 | `components/ui/popover.tsx:40` | `z-50 flex w-72 origin-(--transform-origin) flex-col gap-2.5 rounded-xl bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-border/60 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95` | `flex z-50 flex-col gap-2.5 p-2.5 w-72 text-sm text-popover-foreground bg-popover rounded-xl outline-hidden ring-1 ring-border/60 shadow-md duration-100 origin-(--transform-origin) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` | 重排（分组顺序） |
| 904 | `components/ui/progress.tsx:13` | `relative h-2 w-full overflow-hidden rounded-full bg-muted` | `overflow-hidden relative w-full h-2 bg-muted rounded-full` | 重排（分组顺序） |
| 905 | `components/ui/progress.tsx:21` | `h-full w-full` | `w-full h-full` | 重排（分组顺序） |
| 906 | `components/ui/progress.tsx:25` | `h-full w-full flex-1 bg-primary transition-[width]` | `flex-1 w-full h-full bg-primary transition-[width]` | 重排（分组顺序） |
| 907 | `components/ui/scroll-area.tsx:20` | `size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-1` | `size-full rounded-[inherit] outline-none transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-2 focus-visible:ring-ring/50` | 重排（分组顺序） |
| 908 | `components/ui/scroll-area.tsx:41` | `flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent` | `flex p-px transition-colors touch-none select-none data-horizontal:flex-col data-horizontal:h-2.5 data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:w-2.5 data-vertical:h-full data-vertical:border-l data-vertical:border-l-transparent` | 重排（分组顺序） |
| 909 | `components/ui/scroll-area.tsx:48` | `relative flex-1 rounded-full bg-border` | `relative flex-1 bg-border rounded-full` | 重排（分组顺序） |
| 910 | `components/ui/select.tsx:13` | `scroll-my-1 p-1` | `p-1 scroll-my-1` | 重排（分组顺序） |
| 911 | `components/ui/select.tsx:42` | `flex w-fit items-center justify-between gap-1.5 rounded-xl border border-input bg-background/60 py-2 pr-2 pl-3 text-sm whitespace-nowrap transition-colors duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `flex gap-1.5 justify-between items-center py-2 pr-2 pl-3 w-fit text-sm whitespace-nowrap bg-background/60 rounded-xl border border-input outline-none transition-colors duration-200 select-none *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:gap-1.5 *:data-[slot=select-value]:items-center focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-[size=default]:h-9 data-[size=sm]:h-8 data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 912 | `components/ui/select.tsx:50` | `pointer-events-none size-4 text-muted-foreground` | `size-4 text-muted-foreground pointer-events-none` | 重排（分组顺序） |
| 913 | `components/ui/select.tsx:85` | `relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-border/60 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95` | `isolate overflow-x-hidden overflow-y-auto relative z-50 w-(--anchor-width) min-w-36 max-h-(--available-height) text-popover-foreground bg-popover rounded-xl ring-1 ring-border/60 shadow-lg duration-100 origin-(--transform-origin) data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` | 重排（分组顺序） |
| 914 | `components/ui/select.tsx:121` | `relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2` | `flex relative gap-1.5 items-center py-1 pr-8 pl-1.5 w-full text-sm rounded-md outline-hidden cursor-default select-none *:[span]:last:flex *:[span]:last:gap-2 *:[span]:last:items-center focus:text-accent-foreground focus:bg-accent not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:opacity-50 data-disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 915 | `components/ui/select.tsx:131` | `pointer-events-none absolute right-2 flex size-4 items-center justify-center` | `flex absolute right-2 justify-center items-center size-4 pointer-events-none` | 重排（分组顺序） |
| 916 | `components/ui/select.tsx:147` | `pointer-events-none -mx-1 my-1 h-px bg-border` | `-mx-1 my-1 h-px bg-border pointer-events-none` | 重排（分组顺序） |
| 917 | `components/ui/select.tsx:161` | `top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4` | `flex top-0 z-10 justify-center items-center py-1 w-full bg-popover cursor-default [&_svg:not([class*='size-'])]:size-4` | 重排（分组顺序） |
| 918 | `components/ui/select.tsx:179` | `bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4` | `flex bottom-0 z-10 justify-center items-center py-1 w-full bg-popover cursor-default [&_svg:not([class*='size-'])]:size-4` | 重排（分组顺序） |
| 919 | `components/ui/separator.tsx:15` | `shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch` | `shrink-0 bg-border data-horizontal:w-full data-horizontal:h-px data-vertical:self-stretch data-vertical:w-px` | 重排（分组顺序） |
| 920 | `components/ui/sheet.tsx:56` | `fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm` | `flex fixed z-50 flex-col gap-4 text-sm text-popover-foreground bg-clip-padding bg-popover shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:w-3/4 data-[side=left]:h-full data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:w-3/4 data-[side=right]:h-full data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm` | 重排（分组顺序） |
| 921 | `components/ui/sheet.tsx:96` | `mt-auto flex flex-col gap-2 p-4` | `flex flex-col gap-2 p-4 mt-auto` | 重排（分组顺序） |
| 922 | `components/ui/sheet.tsx:107` | `font-heading text-base font-medium text-foreground` | `text-base font-medium text-foreground font-heading` | 重排（分组顺序） |
| 923 | `components/ui/skeleton.tsx:32` | `rounded-md bg-muted/50` | `bg-muted/50 rounded-md` | 重排（分组顺序） |
| 924 | `components/ui/skeleton.tsx:33` | `animate-pulse rounded-md bg-muted` | `bg-muted rounded-md animate-pulse` | 重排（分组顺序） |
| 925 | `components/ui/sonner.tsx:17` | `toaster group` | `group toaster` | 重排（分组顺序） |
| 926 | `components/ui/tabs.tsx:27` | `group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none` | `group/tabs-list inline-flex justify-center items-center p-[3px] w-fit text-muted-foreground rounded-lg group-data-horizontal/tabs:h-8 group-data-vertical/tabs:flex-col group-data-vertical/tabs:h-fit data-[variant=line]:rounded-none` | 重排（分组顺序） |
| 927 | `components/ui/tabs.tsx:61` | `relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-[color,background-color,border-color,box-shadow] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `inline-flex relative flex-1 gap-1.5 justify-center items-center px-1.5 py-0.5 h-[calc(100%-1px)] text-sm font-medium text-foreground/60 whitespace-nowrap rounded-md border border-transparent transition-[color,background-color,border-color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:pointer-events-none group-data-vertical/tabs:justify-start group-data-vertical/tabs:w-full group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:opacity-50 aria-disabled:pointer-events-none dark:text-muted-foreground dark:hover:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 928 | `components/ui/tabs.tsx:62` | `group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent` | `group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent` | 重排（分组顺序） |
| 929 | `components/ui/tabs.tsx:63` | `data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground` | `data-active:text-foreground data-active:bg-background dark:data-active:text-foreground dark:data-active:bg-input/30 dark:data-active:border-input` | 重排（分组顺序） |
| 930 | `components/ui/textarea.tsx:10` | `flex field-sizing-content min-h-16 w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-base transition-colors duration-200 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40` | `flex px-3 py-2 w-full min-h-16 text-base bg-background/60 rounded-xl border border-input outline-none transition-colors duration-200 field-sizing-content placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:bg-input/50 disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 md:text-sm` | 重排（分组顺序） |
| 931 | `components/ui/toggle-group.tsx:43` | `group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch` | `group/toggle-group flex flex-row gap-[--spacing(var(--gap))] items-center w-fit rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch` | 重排（分组顺序） |
| 932 | `components/ui/toggle-group.tsx:73` | `shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t` | `shrink-0 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:px-2 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t` | 重排（分组顺序） |
| 933 | `components/ui/toggle.tsx:7` | `group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` | `group/toggle inline-flex gap-1 justify-center items-center text-sm font-medium whitespace-nowrap rounded-lg outline-none transition-[color,background-color,border-color,box-shadow] hover:text-foreground hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none` | 重排（分组顺序） |
| 934 | `components/ui/toggle.tsx:12` | `border border-input bg-transparent hover:bg-muted` | `bg-transparent border border-input hover:bg-muted` | 重排（分组顺序） |
| 935 | `components/ui/toggle.tsx:16` | `h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2` | `px-2.5 min-w-8 h-8 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2` | 重排（分组顺序） |
| 936 | `components/ui/toggle.tsx:17` | `h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5` | `px-2.5 min-w-7 h-7 text-[0.8rem] rounded-[min(var(--radius-md),12px)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5` | 重排（分组顺序） |
| 937 | `components/ui/toggle.tsx:18` | `h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2` | `px-2.5 min-w-9 h-9 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2` | 重排（分组顺序） |
| 938 | `components/ui/tooltip.tsx:55` | `z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95` | `inline-flex z-50 gap-1.5 items-center px-3 py-1.5 w-fit max-w-xs text-xs text-background bg-foreground rounded-md origin-(--transform-origin) **:data-[slot=kbd]:isolate **:data-[slot=kbd]:relative **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` | 重排（分组顺序） |
| 939 | `components/ui/tooltip.tsx:61` | `z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5` | `z-50 size-2.5 bg-foreground rounded-[2px] translate-y-[calc(-50%-2px)] rotate-45 fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5` | 重排（分组顺序） |
| 940 | `components/user/ProfileMenu/AvatarEditor.tsx:342` | `flex flex-col items-center gap-3` | `flex flex-col gap-3 items-center` | 重排（分组顺序） |
| 941 | `components/user/ProfileMenu/AvatarEditor.tsx:347` | `relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50` | `relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:opacity-50` | 重排（分组顺序） |
| 942 | `components/user/ProfileMenu/AvatarEditor.tsx:364` | `absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover/avatar:opacity-100` | `flex absolute inset-0 justify-center items-center bg-black/40 rounded-full opacity-0 transition-opacity group-hover/avatar:opacity-100` | 重排（分组顺序） |
| 943 | `components/user/ProfileMenu/AvatarEditor.tsx:369` | `absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary/70 shadow-xs ring-2 ring-background` | `flex absolute -right-0.5 -bottom-0.5 justify-center items-center size-5 bg-primary/70 rounded-full ring-2 ring-background shadow-xs` | 重排（分组顺序） |
| 944 | `components/user/ProfileMenu/AvatarEditor.tsx:375` | `absolute inset-0 flex items-center justify-center rounded-full bg-primary/60 ring-4 ring-primary/40 transition-opacity` | `flex absolute inset-0 justify-center items-center bg-primary/60 rounded-full ring-4 ring-primary/40 transition-opacity` | 重排（分组顺序） |
| 945 | `components/user/ProfileMenu/AvatarEditor.tsx:376` | `flex flex-col items-center gap-1` | `flex flex-col gap-1 items-center` | 重排（分组顺序） |
| 946 | `components/user/ProfileMenu/AvatarEditor.tsx:387` | `absolute inset-0 flex items-center justify-center rounded-full bg-black/40` | `flex absolute inset-0 justify-center items-center bg-black/40 rounded-full` | 重排（分组顺序） |
| 947 | `components/user/ProfileMenu/AvatarEditor.tsx:389` | `flex flex-col items-center gap-0.5` | `flex flex-col gap-0.5 items-center` | 重排（分组顺序） |
| 948 | `components/user/ProfileMenu/AvatarEditor.tsx:390` | `size-5 animate-spin text-white` | `size-5 text-white animate-spin` | 重排（分组顺序） |
| 949 | `components/user/ProfileMenu/AvatarEditor.tsx:396` | `size-6 animate-spin text-white` | `size-6 text-white animate-spin` | 重排（分组顺序） |
| 950 | `components/user/ProfileMenu/AvatarEditor.tsx:439` | `relative aspect-square max-h-96 w-full overflow-hidden rounded-md bg-black/5` | `overflow-hidden relative aspect-square w-full max-h-96 bg-black/5 rounded-md` | 重排（分组顺序） |
| 951 | `components/user/ProfileMenu/AvatarEditor.tsx:442` | `flex h-full items-center justify-center` | `flex justify-center items-center h-full` | 重排（分组顺序） |
| 952 | `components/user/ProfileMenu/AvatarEditor.tsx:463` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 953 | `components/user/ProfileMenu/AvatarEditor.tsx:519` | `h-2 w-full overflow-hidden rounded-full bg-muted` | `overflow-hidden w-full h-2 bg-muted rounded-full` | 重排（分组顺序） |
| 954 | `components/user/ProfileMenu/AvatarEditor.tsx:529` | `text-center text-xs text-muted-foreground` | `text-xs text-center text-muted-foreground` | 重排（分组顺序） |
| 955 | `components/user/ProfileMenu/AvatarEditor.tsx:538` | `flex items-center justify-between gap-2` | `flex gap-2 justify-between items-center` | 重排（分组顺序） |
| 956 | `components/user/ProfileMenu/AvatarEditor.tsx:550` | `flex items-center gap-2` | `flex gap-2 items-center` | 重排（分组顺序） |
| 957 | `components/user/ProfileMenu/ProfileTab.tsx:196` | `flex h-9 w-full min-w-0 items-center rounded-xl border border-input bg-input/30 px-3 text-sm text-muted-foreground break-all dark:bg-input/80` | `flex items-center px-3 w-full min-w-0 h-9 text-sm break-all text-muted-foreground bg-input/30 rounded-xl border border-input dark:bg-input/80` | 重排（分组顺序） |
| 958 | `components/user/ProfileMenu/ProfileTab.tsx:213` | `text-xs text-muted-foreground mt-1` | `mt-1 text-xs text-muted-foreground` | 重排（分组顺序） |
| 959 | `components/user/ProfileMenu/ProfileTab.tsx:230` | `flex items-center justify-between rounded-xl bg-card/60 p-3 ring-1 ring-border/60` | `flex justify-between items-center p-3 bg-card/60 rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 960 | `components/user/ProfileMenu/ProfileTab.tsx:232` | `flex items-center gap-3` | `flex gap-3 items-center` | 重排（分组顺序） |
| 961 | `components/user/ProfileMenu/ProfileTab.tsx:247` | `mt-1 h-3 w-10` | `mt-1 w-10 h-3` | 重排（分组顺序） |
| 962 | `components/user/ProfileMenu/ProfileTab.tsx:249` | `text-xs text-muted-foreground flex items-center gap-1` | `flex gap-1 items-center text-xs text-muted-foreground` | 重排（分组顺序） |
| 963 | `components/user/ProfileMenu/ProfileTab.tsx:259` | `h-3 w-12` | `w-12 h-3` | 重排（分组顺序） |
| 964 | `components/user/ProfileMenu/ProfileTab.tsx:309` | `text-xs text-muted-foreground mt-1` | `mt-1 text-xs text-muted-foreground` | 重排（分组顺序） |
| 965 | `components/user/ProfileMenu/SecurityTab.tsx:60` | `space-y-3 rounded-xl bg-card/60 p-4 ring-1 ring-border/60` | `p-4 space-y-3 bg-card/60 rounded-xl ring-1 ring-border/60` | 重排（分组顺序） |
| 966 | `components/user/ProfileMenu/SecurityTab.tsx:63` | `text-xs text-muted-foreground mt-1` | `mt-1 text-xs text-muted-foreground` | 重排（分组顺序） |
| 967 | `components/user/ProfileMenu/UserHeader.tsx:24` | `flex items-center gap-3` | `flex gap-3 items-center` | 重排（分组顺序） |
| 968 | `components/user/UserMenu.tsx:32` | `size-8 rounded-full bg-muted animate-pulse` | `size-8 bg-muted rounded-full animate-pulse` | 重排（分组顺序） |
| 969 | `components/user/UserMenu.tsx:41` | `h-8 rounded-lg px-3` | `px-3 h-8 rounded-lg` | 重排（分组顺序） |
| 970 | `components/user/UserMenu.tsx:56` | `rounded-full ring-offset-2 ring-offset-background outline-none transition-shadow hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-ring` | `rounded-full outline-none ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-ring` | 重排（分组顺序） |
| 971 | `routes/admin/_authL/index.tsx:115` | `flex items-center gap-4 p-5` | `flex gap-4 items-center p-5` | 重排（分组顺序） |
| 972 | `routes/admin/_authL/index.tsx:117` | `flex min-w-0 flex-col` | `flex flex-col min-w-0` | 重排（分组顺序） |
| 973 | `routes/admin/_authL/index.tsx:122` | `mt-1.5 h-7 w-16` | `mt-1.5 w-16 h-7` | 重排（分组顺序） |
| 974 | `routes/admin/_authL/index.tsx:143` | `flex items-center gap-2.5 text-base` | `flex gap-2.5 items-center text-base` | 重排（分组顺序） |
| 975 | `routes/admin/_authL/index.tsx:154` | `group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `group flex gap-3 items-center px-3 py-2.5 rounded-xl transition-colors duration-200 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 976 | `routes/admin/_authL/index.tsx:160` | `transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary` | `transition-colors duration-200 group-hover:text-primary group-hover:bg-primary/10` | 重排（分组顺序） |
| 977 | `routes/admin/_authL/index.tsx:162` | `flex min-w-0 flex-1 flex-col` | `flex flex-col flex-1 min-w-0` | 重排（分组顺序） |
| 978 | `routes/admin/_authL/index.tsx:164` | `truncate text-xs text-muted-foreground` | `text-xs text-muted-foreground truncate` | 重排（分组顺序） |
| 979 | `routes/admin/_authL/index.tsx:168` | `size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground` | `shrink-0 size-4 text-muted-foreground/50 transition-transform group-hover:text-foreground group-hover:translate-x-0.5` | 重排（分组顺序） |
| 980 | `routes/admin/_authL/index.tsx:194` | `flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-muted/60` | `flex gap-3 justify-between items-center px-3 py-2.5 rounded-xl transition-colors duration-200 hover:bg-muted/60` | 重排（分组顺序） |
| 981 | `routes/admin/_authL/index.tsx:195` | `flex min-w-0 items-center gap-3` | `flex gap-3 items-center min-w-0` | 重排（分组顺序） |
| 982 | `routes/admin/_authL/index.tsx:197` | `flex min-w-0 flex-col` | `flex flex-col min-w-0` | 重排（分组顺序） |
| 983 | `routes/admin/_authL/index.tsx:199` | `truncate text-xs text-muted-foreground` | `text-xs text-muted-foreground truncate` | 重排（分组顺序） |
| 984 | `routes/admin/_authL/index.tsx:213` | `flex items-center gap-2.5 text-base` | `flex gap-2.5 items-center text-base` | 重排（分组顺序） |
| 985 | `routes/admin/_authL/index.tsx:231` | `rounded-md px-1.5 py-0.5 text-xs font-medium text-primary transition-colors duration-200 hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `px-1.5 py-0.5 text-xs font-medium text-primary rounded-md transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 986 | `routes/admin/_authL/index.tsx:244` | `rounded-md px-1.5 py-0.5 text-xs font-medium text-primary transition-colors duration-200 hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `px-1.5 py-0.5 text-xs font-medium text-primary rounded-md transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 987 | `routes/admin/_authL/meilisearch.tsx:73` | `-mb-[5px] max-w-full overflow-x-auto pb-[5px]` | `overflow-x-auto pb-[5px] -mb-[5px] max-w-full` | 重排（分组顺序） |
| 988 | `routes/auth/login.tsx:126` | `mx-auto w-full max-w-md py-6` | `py-6 mx-auto w-full max-w-md` | 重排（分组顺序） |
| 989 | `routes/auth/login.tsx:128` | `items-center gap-2 text-center` | `gap-2 items-center text-center` | 重排（分组顺序） |
| 990 | `routes/auth/login.tsx:148` | `flex items-center gap-1.5` | `flex gap-1.5 items-center` | 重排（分组顺序） |
| 991 | `routes/auth/login.tsx:182` | `flex items-center gap-1.5` | `flex gap-1.5 items-center` | 重排（分组顺序） |
| 992 | `routes/auth/login.tsx:248` | `mt-5 text-center text-xs text-muted-foreground` | `mt-5 text-xs text-center text-muted-foreground` | 重排（分组顺序） |
| 993 | `routes/auth/signup/index.tsx:118` | `mx-auto w-full max-w-md py-6` | `py-6 mx-auto w-full max-w-md` | 重排（分组顺序） |
| 994 | `routes/auth/signup/index.tsx:120` | `items-center gap-2 text-center` | `gap-2 items-center text-center` | 重排（分组顺序） |
| 995 | `routes/auth/signup/index.tsx:140` | `flex items-center gap-1.5` | `flex gap-1.5 items-center` | 重排（分组顺序） |
| 996 | `routes/auth/signup/index.tsx:174` | `flex items-center gap-1.5` | `flex gap-1.5 items-center` | 重排（分组顺序） |
| 997 | `routes/auth/signup/index.tsx:208` | `flex items-center gap-1.5` | `flex gap-1.5 items-center` | 重排（分组顺序） |
| 998 | `routes/auth/signup/index.tsx:257` | `flex items-center gap-1.5` | `flex gap-1.5 items-center` | 重排（分组顺序） |
| 999 | `routes/auth/signup/index.tsx:327` | `mt-5 text-center text-xs text-muted-foreground` | `mt-5 text-xs text-center text-muted-foreground` | 重排（分组顺序） |
| 1000 | `routes/auth/signup/Verification.tsx:105` | `mx-auto w-full max-w-md py-6` | `py-6 mx-auto w-full max-w-md` | 重排（分组顺序） |
| 1001 | `routes/auth/signup/Verification.tsx:107` | `items-center gap-2 text-center` | `gap-2 items-center text-center` | 重排（分组顺序） |
| 1002 | `routes/auth/signup/Verification.tsx:123` | `flex items-center justify-between gap-2` | `flex gap-2 justify-between items-center` | 重排（分组顺序） |
| 1003 | `routes/auth/signup/Verification.tsx:149` | `*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-10 *:data-[slot=input-otp-slot]:text-xl sm:*:data-[slot=input-otp-slot]:w-11` | `*:data-[slot=input-otp-slot]:w-10 *:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:text-xl sm:*:data-[slot=input-otp-slot]:w-11` | 重排（分组顺序） |
| 1004 | `routes/auth/signup/Verification.tsx:157` | `*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-10 *:data-[slot=input-otp-slot]:text-xl sm:*:data-[slot=input-otp-slot]:w-11` | `*:data-[slot=input-otp-slot]:w-10 *:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:text-xl sm:*:data-[slot=input-otp-slot]:w-11` | 重排（分组顺序） |
| 1005 | `routes/auth/signup/Verification.tsx:166` | `flex-col items-stretch gap-3` | `flex-col gap-3 items-stretch` | 重排（分组顺序） |
| 1006 | `routes/auth/signup/Verification.tsx:179` | `text-center text-xs text-muted-foreground` | `text-xs text-center text-muted-foreground` | 重排（分组顺序） |
| 1007 | `routes/collections/$id.tsx:82` | `overflow-hidden rounded-2xl bg-card ring-1 ring-border/60` | `overflow-hidden bg-card rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 1008 | `routes/collections/$id.tsx:83` | `space-y-4 p-6 sm:p-8` | `p-6 space-y-4 sm:p-8` | 重排（分组顺序） |
| 1009 | `routes/collections/$id.tsx:85` | `h-5 w-16 rounded-full` | `w-16 h-5 rounded-full` | 重排（分组顺序） |
| 1010 | `routes/collections/$id.tsx:86` | `h-5 w-20 rounded-full` | `w-20 h-5 rounded-full` | 重排（分组顺序） |
| 1011 | `routes/collections/$id.tsx:88` | `h-9 w-1/2` | `w-1/2 h-9` | 重排（分组顺序） |
| 1012 | `routes/collections/$id.tsx:89` | `h-5 w-3/4` | `w-3/4 h-5` | 重排（分组顺序） |
| 1013 | `routes/collections/$id.tsx:90` | `h-5 w-1/2` | `w-1/2 h-5` | 重排（分组顺序） |
| 1014 | `routes/collections/$id.tsx:94` | `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4` | `grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6` | 重排（分组顺序） |
| 1015 | `routes/collections/$id.tsx:97` | `aspect-[2/3] rounded-lg w-full` | `aspect-[2/3] w-full rounded-lg` | 重排（分组顺序） |
| 1016 | `routes/collections/$id.tsx:98` | `h-4 w-3/4 mx-auto` | `mx-auto w-3/4 h-4` | 重排（分组顺序） |
| 1017 | `routes/collections/$id.tsx:175` | `relative overflow-hidden rounded-2xl bg-card ring-1 ring-border/60` | `overflow-hidden relative bg-card rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 1018 | `routes/collections/$id.tsx:178` | `absolute inset-0 grid grid-cols-4 opacity-25 dark:opacity-20` | `grid absolute inset-0 grid-cols-4 opacity-25 dark:opacity-20` | 重排（分组顺序） |
| 1019 | `routes/collections/$id.tsx:184` | `w-full h-full object-cover blur-[2px] scale-110` | `object-cover w-full h-full blur-[2px] scale-110` | 重排（分组顺序） |
| 1020 | `routes/collections/$id.tsx:197` | `mb-4 flex flex-wrap items-center gap-2.5` | `flex flex-wrap gap-2.5 items-center mb-4` | 重排（分组顺序） |
| 1021 | `routes/collections/$id.tsx:198` | `inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground tabular-nums ring-1 ring-border/60` | `inline-flex gap-1.5 items-center px-2.5 py-1 text-xs tabular-nums text-muted-foreground bg-muted/60 rounded-full ring-1 ring-border/60` | 重排（分组顺序） |
| 1022 | `routes/collections/$id.tsx:226` | `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4` | `grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6` | 重排（分组顺序） |
| 1023 | `routes/collections/$id.tsx:256` | `inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `inline-flex gap-1.5 items-center text-sm text-muted-foreground rounded-sm transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 1024 | `routes/collections/index.tsx:81` | `h-4 w-16` | `w-16 h-4` | 重排（分组顺序） |
| 1025 | `routes/games/index.tsx:682` | `mb-6 flex flex-wrap items-center gap-2 rounded-2xl bg-muted/40 px-3 py-2 ring-1 ring-border/60` | `flex flex-wrap gap-2 items-center px-3 py-2 mb-6 bg-muted/40 rounded-2xl ring-1 ring-border/60` | 重排（分组顺序） |
| 1026 | `routes/games/index.tsx:683` | `flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground` | `flex shrink-0 gap-1.5 items-center text-sm text-muted-foreground` | 重排（分组顺序） |
| 1027 | `routes/games/index.tsx:699` | `h-8 w-28 rounded-lg border-0 bg-transparent px-2 font-medium text-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50` | `px-2 w-28 h-8 font-medium text-foreground bg-transparent rounded-lg border-0 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50` | 重排（分组顺序） |
| 1028 | `routes/games/index.tsx:724` | `h-8 w-20 rounded-lg border-0 bg-transparent px-2 font-medium text-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50` | `px-2 w-20 h-8 font-medium text-foreground bg-transparent rounded-lg border-0 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50` | 重排（分组顺序） |
| 1029 | `routes/games/index.tsx:749` | `grid grid-cols-3 md:grid-cols-6 gap-4 absolute top-0 left-0 w-full` | `grid absolute top-0 left-0 grid-cols-3 gap-4 w-full md:grid-cols-6` | 重排（分组顺序） |
| 1030 | `routes/games/index.tsx:767` | `mt-4 grid grid-cols-3 gap-4 md:grid-cols-6` | `grid grid-cols-3 gap-4 mt-4 md:grid-cols-6` | 重排（分组顺序） |
| 1031 | `routes/games/index.tsx:773` | `mt-8 flex justify-center` | `flex justify-center mt-8` | 重排（分组顺序） |
| 1032 | `routes/games/index.tsx:858` | `h-10 w-full rounded-xl` | `w-full h-10 rounded-xl` | 重排（分组顺序） |
| 1033 | `routes/games/index.tsx:860` | `mb-6 h-12 w-full rounded-2xl` | `mb-6 w-full h-12 rounded-2xl` | 重排（分组顺序） |
| 1034 | `routes/index.tsx:84` | `mx-auto mt-6 mb-8 w-full max-w-2xl px-1` | `px-1 mx-auto mt-6 mb-8 w-full max-w-2xl` | 重排（分组顺序） |
| 1035 | `routes/producer/index.tsx:123` | `h-9 w-full rounded-xl` | `w-full h-9 rounded-xl` | 重排（分组顺序） |
| 1036 | `routes/producer/index.tsx:127` | `h-24 w-full rounded-2xl` | `w-full h-24 rounded-2xl` | 重排（分组顺序） |
| 1037 | `routes/topics/$topicId.tsx:174` | `flex items-start justify-between gap-3` | `flex gap-3 justify-between items-start` | 重排（分组顺序） |
| 1038 | `routes/topics/$topicId.tsx:184` | `shrink-0 border-warning/30 bg-warning/10 text-warning` | `shrink-0 text-warning bg-warning/10 border-warning/30` | 重排（分组顺序） |
| 1039 | `routes/topics/$topicId.tsx:191` | `flex flex-wrap items-center gap-x-2 gap-y-1` | `flex flex-wrap gap-x-2 gap-y-1 items-center` | 重排（分组顺序） |
| 1040 | `routes/topics/$topicId.tsx:200` | `bg-muted text-xs text-muted-foreground` | `text-xs text-muted-foreground bg-muted` | 重排（分组顺序） |
| 1041 | `routes/topics/$topicId.tsx:210` | `text-xs text-muted-foreground tabular-nums` | `text-xs tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 1042 | `routes/topics/$topicId.tsx:214` | `ml-auto flex items-center gap-1` | `flex gap-1 items-center ml-auto` | 重排（分组顺序） |
| 1043 | `routes/topics/$topicId.tsx:227` | `text-destructive hover:bg-destructive/10 hover:text-destructive` | `text-destructive hover:text-destructive hover:bg-destructive/10` | 重排（分组顺序） |
| 1044 | `routes/topics/$topicId.tsx:264` | `mt-5 flex items-center gap-2 border-t border-border/60 pt-3` | `flex gap-2 items-center pt-3 mt-5 border-t border-border/60` | 重排（分组顺序） |
| 1045 | `routes/topics/$topicId.tsx:427` | `bg-muted text-[10px] text-muted-foreground` | `text-[10px] text-muted-foreground bg-muted` | 重排（分组顺序） |
| 1046 | `routes/topics/$topicId.tsx:431` | `min-w-0 flex-1` | `flex-1 min-w-0` | 重排（分组顺序） |
| 1047 | `routes/topics/$topicId.tsx:432` | `flex flex-wrap items-center gap-x-2 gap-y-0.5` | `flex flex-wrap gap-x-2 gap-y-0.5 items-center` | 重排（分组顺序） |
| 1048 | `routes/topics/$topicId.tsx:436` | `ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground` | `flex shrink-0 gap-2 items-center ml-auto text-xs text-muted-foreground` | 重排（分组顺序） |
| 1049 | `routes/topics/$topicId.tsx:443` | `transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 1050 | `routes/topics/$topicId.tsx:503` | `border-l border-border/60 pl-2.5` | `pl-2.5 border-l border-border/60` | 重排（分组顺序） |
| 1051 | `routes/topics/$topicId.tsx:512` | `bg-muted text-[10px] text-muted-foreground` | `text-[10px] text-muted-foreground bg-muted` | 重排（分组顺序） |
| 1052 | `routes/topics/$topicId.tsx:516` | `min-w-0 flex-1` | `flex-1 min-w-0` | 重排（分组顺序） |
| 1053 | `routes/topics/$topicId.tsx:517` | `flex flex-wrap items-center gap-x-2 gap-y-0.5` | `flex flex-wrap gap-x-2 gap-y-0.5 items-center` | 重排（分组顺序） |
| 1054 | `routes/topics/$topicId.tsx:526` | `text-xs text-muted-foreground tabular-nums` | `text-xs tabular-nums text-muted-foreground` | 重排（分组顺序） |
| 1055 | `routes/topics/$topicId.tsx:532` | `text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 1056 | `routes/user/index.tsx:112` | `h-28 w-full rounded-2xl` | `w-full h-28 rounded-2xl` | 重排（分组顺序） |
| 1057 | `routes/user/index.tsx:124` | `h-3 w-16` | `w-16 h-3` | 重排（分组顺序） |
| 1058 | `routes/user/index.tsx:125` | `h-9 w-full rounded-xl` | `w-full h-9 rounded-xl` | 重排（分组顺序） |
| 1059 | `routes/user/index.tsx:128` | `h-9 w-24 rounded-lg` | `w-24 h-9 rounded-lg` | 重排（分组顺序） |
| 1060 | `routes/user/index.tsx:232` | `flex flex-col items-center gap-4 sm:flex-row sm:items-start` | `flex flex-col gap-4 items-center sm:flex-row sm:items-start` | 重排（分组顺序） |
| 1061 | `routes/user/index.tsx:233` | `flex flex-col items-center gap-1.5` | `flex flex-col gap-1.5 items-center` | 重排（分组顺序） |
| 1062 | `routes/user/index.tsx:235` | `cursor-default text-xs text-muted-foreground/70 select-none` | `text-xs text-muted-foreground/70 cursor-default select-none` | 重排（分组顺序） |
| 1063 | `routes/user/index.tsx:239` | `min-w-0 flex-1 text-center sm:text-left` | `flex-1 min-w-0 text-center sm:text-left` | 重排（分组顺序） |
| 1064 | `routes/user/index.tsx:240` | `truncate text-lg font-semibold tracking-tight` | `text-lg font-semibold tracking-tight truncate` | 重排（分组顺序） |
| 1065 | `routes/user/index.tsx:243` | `mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground sm:justify-start` | `flex gap-1 justify-center items-center mt-1 text-xs text-muted-foreground sm:justify-start` | 重排（分组顺序） |
| 1066 | `routes/user/index.tsx:244` | `size-3.5 shrink-0` | `shrink-0 size-3.5` | 重排（分组顺序） |
| 1067 | `routes/user/index.tsx:370` | `flex flex-col items-center gap-4 sm:flex-row sm:items-start` | `flex flex-col gap-4 items-center sm:flex-row sm:items-start` | 重排（分组顺序） |
| 1068 | `routes/user/index.tsx:371` | `flex flex-col items-center gap-1.5` | `flex flex-col gap-1.5 items-center` | 重排（分组顺序） |
| 1069 | `routes/user/index.tsx:373` | `h-3 w-20` | `w-20 h-3` | 重排（分组顺序） |
| 1070 | `routes/user/index.tsx:376` | `h-5 w-32` | `w-32 h-5` | 重排（分组顺序） |
| 1071 | `routes/user/index.tsx:377` | `h-3.5 w-48` | `w-48 h-3.5` | 重排（分组顺序） |
| 1072 | `routes/__root.tsx:138` | `font-sans antialiased flex flex-col min-h-screen` | `flex flex-col min-h-screen font-sans antialiased` | 重排（分组顺序） |
| 1073 | `routes/__root.tsx:176` | `fixed top-3 left-3 z-[100] -translate-y-20 rounded-xl bg-background px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-border transition-transform duration-200 focus:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` | `fixed top-3 left-3 z-[100] px-4 py-2 text-sm font-medium bg-background rounded-xl ring-1 ring-border shadow-lg transition-transform duration-200 -translate-y-20 focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60` | 重排（分组顺序） |
| 1074 | `routes/__root.tsx:188` | `mx-auto w-full max-w-7xl flex-1 px-4 pt-[var(--app-header-height)] outline-none sm:px-6` | `flex-1 px-4 pt-[var(--app-header-height)] mx-auto w-full max-w-7xl outline-none sm:px-6` | 重排（分组顺序） |
| 1075 | `routes/__root.tsx:193` | `relative mx-auto mb-3 flex w-full max-w-5xl justify-center opacity-[0.65] transition-opacity duration-200 hover:opacity-90` | `flex relative justify-center mx-auto mb-3 w-full max-w-5xl opacity-[0.65] transition-opacity duration-200 hover:opacity-90` | 重排（分组顺序） |
| 1076 | `routes/__root.tsx:202` | `block w-full overflow-hidden rounded-xl ring-1 ring-border/50` | `block overflow-hidden w-full rounded-xl ring-1 ring-border/50` | 重排（分组顺序） |
| 1077 | `routes/__root.tsx:210` | `w-full object-cover scale-[1.03]` | `object-cover w-full scale-[1.03]` | 重排（分组顺序） |
| 1078 | `routes/__root.tsx:222` | `w-full object-cover` | `object-cover w-full` | 重排（分组顺序） |
| 1079 | `routes/__root.tsx:288` | `fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-30 dark:opacity-10` | `fixed inset-0 -z-10 bg-center bg-cover bg-no-repeat opacity-30 dark:opacity-10` | 重排（分组顺序） |

## 附录 B：动态拼接类名（未改动，需人工维护顺序）

| 位置 | 片段 |
| --- | --- |
| `components/admin/comments-page.tsx:299` | ``text-sm truncate ${ isReply ? "text-muted-foreground" : "text-foreground" }`` |
| `components/cmments/index.tsx:221` | ``h-[18px] px-1.5 text-[10px] ${typeMeta.className}`` |
| `components/EmojiPicker/emoji-picker.tsx:750` | ``h-auto min-h-9 px-2 py-1.5 text-xs whitespace-nowrap transition-colors hover:bg-accent ${ selectedIndex === globalIndex ? "bg-accent ring-2` |
| `components/game/game-detail-pending.tsx:156` | ``${ (hero.height ?? 0) > 0 && (hero.height ?? 0) < (hero.width ?? 0) ? "min-w-60" : "w-48" } relative overflow-hidden rounded-xl text-left r` |
| `components/game/game-detail-pending.tsx:262` | ``h-4 ${width}`` |
| `components/game/game-detail-pending.tsx:270` | ``h-6 rounded-full ${width}`` |
| `components/game/game-tab-skeleton.tsx:52` | ``h-4 ${width}`` |
| `components/game/game-tab-skeleton.tsx:107` | ``h-7 rounded-md ${width}`` |
| `components/home/card.tsx:270` | ``galzy-thumbhash-placeholder absolute inset-0 w-full h-full object-cover ${className ?? ""}`` |
| `components/home/card.tsx:296` | ``${className ?? ""}${blurFallback}`` |
| `components/home/card.tsx:388` | ``w-full h-full object-cover transition-[filter] duration-500 ease-out${sensitiveHidden && !coarse ? " blur-xl" : ""} ${className ?? ""}`` |
| `components/home/card.tsx:392` | ``absolute inset-0 flex flex-col items-center justify-center z-10 rounded-lg text-center px-2 pb-12 ${coarse ? "bg-black/40" : "bg-black/40 b` |
| `components/home/card.tsx:450` | ``w-full h-full object-cover transition-[filter] duration-500 ease-out${sensitiveHidden && !coarse ? " blur-xl" : ""} ${className ?? ""}`` |
| `components/home/card.tsx:454` | ``absolute inset-0 flex flex-col items-center justify-center z-10 rounded-lg text-center px-2 pb-12 ${coarse ? "bg-black/40" : "bg-black/40 b` |
| `components/home/card.tsx:606` | ``w-full h-full object-cover${hoverClasses}${sensitiveHidden && !coarse ? " blur-xl" : ""}`` |
| `components/home/card.tsx:610` | ``absolute inset-0 flex flex-col items-center justify-center z-10 rounded-xl text-center px-2 pb-12 ${coarse ? "bg-black/40" : "bg-black/40 b` |
| `components/home/game/GameHeader.tsx:113` | ``${ (game?.vn?.image?.height ?? 0) > 0 && (game?.vn?.image?.height ?? 0) < (game?.vn?.image?.width ?? 0) ? "min-w-60" : "w-48" } relative ov` |
| `components/tags/tag-detail-pending.tsx:97` | ``h-4 ${width}`` |
| `components/tags/tag-detail-pending.tsx:143` | ``h-5 rounded-4xl ${width}`` |
| `components/user/ProfileMenu/AvatarEditor.tsx:521` | ``h-full w-full origin-left bg-primary transition-transform duration-300 ${ phase === "saving" ? "animate-pulse" : "" }`` |
| `components/user/ProfileMenu/UserHeader.tsx:31` | ``${profileMenu ? "max-w-39" : "max-w-80"}`` |
| `components/user/ProfileMenu/UserHeader.tsx:33` | ``${compact ? "text-sm" : "text-lg"} font-semibold leading-none tracking-tight truncate`` |
| `components/user/ProfileMenu/UserHeader.tsx:38` | ``${compact ? "text-xs" : "text-sm"} text-muted-foreground flex items-center gap-1 `` |

## 附录 C：说明与已知限制

- 自动生成的 `src/routeTree.gen.ts` 与 `src/styles.css` 不在范围（路由插件生成 / Tailwind 入口与主题变量）。
- 模板字符串里的动态类名严格未动，见附录 B。
- `components/ui/**`（shadcn 受管文件）也在整理范围内；若之后用 shadcn CLI 重新生成，会覆盖回上游基线顺序。
- 无法识别的自定义类（galzy-*、prose 等）归到「其他/末尾」；group/peer 标记类被放到最前。
- 整理脚本与报告数据在 `.dsh-tmp/`（未跟踪临时目录），提交前可删除。
