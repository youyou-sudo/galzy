import { DesktopNavAdItem } from "@web/components/adverts/nav-ad";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@web/components/ui/navigation-menu";
import { Link, usePathname } from "@web/lib/nav";
import { cn } from "@web/lib/utils";
import type { HeaderNavItem, HeaderNavKey } from "./nav-config";
import {
	desktopNavEntries,
	headerNav,
	menuPanels,
	navItem,
} from "./nav-config";
import {
	desktopFlatLinkClass,
	desktopNavItemClass,
	desktopNavTriggerClass,
} from "./nav-styles";

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
				className="group/row gap-3 items-start p-2.5 w-full h-auto rounded-xl hover:bg-muted/70"
				render={panelRenderTarget(item)}
			>
				<span className="flex shrink-0 justify-center items-center size-8 text-muted-foreground bg-muted/70 rounded-lg transition-colors group-hover/row:text-foreground group-hover/row:bg-background">
					<Icon className="size-4" />
				</span>
				<span className="flex flex-col gap-0.5 items-start min-w-0">
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
	const pathname = usePathname();
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
					if (entry.kind === "ad") {
						// 推广位：文案/链接来自后台广告位 header_nav，
						// 与站外条目共用同一套排版，列表项由组件自己托管
						return <DesktopNavAdItem key="ad" />;
					}
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
										className={desktopNavItemClass}
									>
										{item.label}
									</a>
								</NavigationMenuItem>
							);
						}
						return (
							<NavigationMenuItem key={entry.key}>
								<NavigationMenuLink
									className={desktopFlatLinkClass}
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
									desktopNavTriggerClass,
									activeMenu === entry.id &&
										"text-[color:var(--header-fg)] bg-[var(--header-hover)]",
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
