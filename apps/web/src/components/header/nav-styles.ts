import { cn } from "@web/lib/utils";

/**
 * 顶栏导航的排版常量。
 *
 * 桌面主导航、移动全屏菜单、以及后台下发的推广入口（广告位 header_nav）
 * 共用这几份 class：推广入口看起来就是普通导航标签，不额外做一套样式，
 * 避免「推广位单独一套 hover」这种只在视觉上才暴露的分叉。
 */

/** 扁平链接与下拉触发器共用一套排版：同高同圆角，只差展开箭头 */
export const desktopNavItemClass = cn(
	"gap-1.5 px-3 h-8 text-sm font-medium rounded-lg",
	// 透明态颜色由 useHeaderTone 写进 .galzy-site-header 的变量；
	// 滚动成玻璃药丸后 data-header-tone 移除，变量回退到主题色。
	"text-[color:var(--header-muted)] transition-colors duration-200",
	"hover:text-[color:var(--header-hover-fg)] hover:bg-[var(--header-hover)]",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
);

/** 当前页高亮：TanStack Link 命中时自带 data-status="active" */
export const desktopFlatLinkClass = cn(
	desktopNavItemClass,
	"data-[status=active]:text-[color:var(--header-fg)] data-[status=active]:bg-[var(--header-hover)]",
);

/** 下拉触发器：展开时保持和「当前页」一样的底色 */
export const desktopNavTriggerClass = cn(
	desktopNavItemClass,
	"data-popup-open:text-[color:var(--header-fg)] data-popup-open:bg-[var(--header-hover)]",
);

/**
 * 移动全屏菜单里的一行：左侧图标 + 主文案 +（可选）次要描述 + 右侧箭头。
 * 默认 44px 高，保证 8 个主入口可以在不滚动的一屏内看完。
 */
export const mobileNavRowClass = cn(
	"group/row galzy-mobile-item flex gap-2.5 items-center px-2.5 py-2 min-h-11 rounded-xl",
	"text-foreground no-underline outline-none transition-colors duration-200",
	"hover:bg-muted/60 focus-visible:bg-muted/60",
	"focus-visible:ring-2 focus-visible:ring-ring/60",
	// TanStack Link 命中当前路由时自带 data-status="active"
	"data-[status=active]:bg-muted/60",
);
