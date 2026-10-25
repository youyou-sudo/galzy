import { Link, useRouterState } from "@tanstack/react-router";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@web/components/ui/navigation-menu";
import { cn } from "@web/lib/utils";
import {
	desktopNavEntries,
	headerNav,
	menuPanels,
	navItem,
} from "./nav-config";
import type { HeaderNavItem, HeaderNavKey } from "./nav-config";

/** 扁平链接与下拉触发器共用一套排版：同高同圆角，只差展开箭头 */
const navItemClass = cn(
	"h-8 gap-1.5 rounded-lg px-3 text-sm font-medium",
	"text-muted-foreground transition-colors duration-200",
	"hover:bg-muted/60 hover:text-foreground",
	"focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
);

/** 当前页高亮：TanStack Link 命中时自带 data-status="active" */
const flatLinkClass = cn(
	navItemClass,
	"data-[status=active]:bg-muted/60 data-[status=active]:text-foreground",
);

const triggerClass = cn(
	navItemClass,
	"data-popup-open:bg-muted/60 data-popup-open:text-foreground",
);

/** 面板行的 render 目标：站外用 <a>，站内用 Link（保留预取） */
function panelRenderTarget(item: HeaderNavItem) {
	if (item.type === "external") {
		return <a href={item.href} target="_blank" rel="noreferrer" />;
	}
	return <Link to={item.to} preload="viewport" />;
}

/**
 * 下拉面板里的一行：左侧图标方块 + 主文案 + 次要描述。
 * 图标容器在 hover 时换成更亮的底色，让整行有「被选中」的层次。
 */
function PanelRow({ item }: { item: HeaderNavItem }) {
	const Icon = item.icon;
	return (
		<li>
			<NavigationMenuLink
				className="group/row h-auto w-full items-start gap-3 rounded-xl p-2.5 hover:bg-muted/70"
				render={panelRenderTarget(item)}
			>
				<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground transition-colors group-hover/row:bg-background group-hover/row:text-foreground">
					<Icon className="size-4" />
				</span>
				<span className="flex min-w-0 flex-col items-start gap-0.5">
					<span className="text-sm font-medium">{item.label}</span>
					<span className="text-xs font-normal text-muted-foreground">
						{item.description}
					</span>
				</span>
			</NavigationMenuLink>
		</li>
	);
}

/** 桌面端主导航（md 及以上）。顺序来自 nav-config.desktopNavEntries。 */
export function DesktopNav() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	// 下拉触发器没有 Link 的 data-status，按路径前缀判断所属区块
	const activeMenu =
		pathname === "/" || pathname.startsWith("/contact")
			? "home"
			: pathname.startsWith("/tools")
				? "tools"
				: null;

	return (
		<NavigationMenu className="flex-none">
			<NavigationMenuList className="gap-0.5">
				{desktopNavEntries.map((entry) => {
					if (entry.kind === "link") {
						// 用 navItem 取宽类型条目：这样 external 分支在类型层是活的
						const item = navItem(entry.key);
						if (item.type === "external") {
							return (
								<NavigationMenuItem key={entry.key}>
									<a
										href={item.href}
										target="_blank"
										rel="noreferrer"
										className={navItemClass}
									>
										{item.label}
									</a>
								</NavigationMenuItem>
							);
						}
						return (
							<NavigationMenuItem key={entry.key}>
								<NavigationMenuLink
									className={flatLinkClass}
									render={<Link to={item.to} preload="viewport" />}
								>
									{item.label}
								</NavigationMenuLink>
							</NavigationMenuItem>
						);
					}

					const panel = menuPanels[entry.id];
					const keys: readonly HeaderNavKey[] = panel.keys;
					return (
						<NavigationMenuItem key={entry.id}>
							<NavigationMenuTrigger
								className={cn(
									triggerClass,
									activeMenu === entry.id && "bg-muted/60 text-foreground",
								)}
							>
								{entry.label}
							</NavigationMenuTrigger>
							<NavigationMenuContent>
								<ul className={cn("grid gap-0.5 p-1", panel.width)}>
									{keys.map((key) => (
										<PanelRow key={key} item={headerNav[key]} />
									))}
								</ul>
							</NavigationMenuContent>
						</NavigationMenuItem>
					);
				})}
			</NavigationMenuList>
		</NavigationMenu>
	);
}
