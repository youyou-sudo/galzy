import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { AdminCommandMenu } from "@web/components/admin/admin-command-menu";
import {
	adminNav,
	findNavItem,
	isNavItemActive,
} from "@web/components/admin/admin-nav";
import ThemeToggle from "@web/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
import { Button } from "@web/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@web/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@web/components/ui/sheet";
import { useLocalStorageState } from "@web/hooks/use-local-storage-state";
import { adminKeys } from "@web/lib/admin/query-keys";
import { cn } from "@web/lib/utils";
import { getTaskStats } from "@web/server/admin/tasks";
import { authClient } from "@web/server/auth/auth-client";
import {
	ChevronRightIcon,
	CommandIcon,
	ExternalLinkIcon,
	LogOutIcon,
	MenuIcon,
	PanelLeftCloseIcon,
	PanelLeftOpenIcon,
	ShieldCheckIcon,
	UserIcon,
	XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** 运行中 + 排队中的任务数，用于侧栏徽标（后台任意页面都能看到积压）。 */
function useRunningTaskCount() {
	const { data } = useQuery({
		queryKey: adminKeys.taskStats(),
		queryFn: () => getTaskStats(),
		refetchInterval: 30_000,
		staleTime: 15_000,
		retry: 1,
	});
	const counts = data?.counts ?? {};
	return (counts.running ?? 0) + (counts.queued ?? 0);
}

function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
	return (
		<div className={cn("flex gap-2.5 items-center min-w-0")}>
			<div className="flex justify-center items-center size-8 text-primary-foreground bg-primary rounded-lg shadow-sm shrink-0">
				<ShieldCheckIcon className="size-4.5" />
			</div>
			{!collapsed && (
				<div className="flex flex-col min-w-0">
					<span className="text-sm leading-none font-semibold tracking-tight truncate">
						GalZY 管理台
					</span>
					<span className="mt-1 text-[10px] leading-none tracking-[0.16em] text-muted-foreground uppercase">
						Admin Console
					</span>
				</div>
			)}
		</div>
	);
}

type NavProps = {
	pathname: string;
	collapsed: boolean;
	runningCount: number;
	onNavigate?: () => void;
};

function NavList({ pathname, collapsed, runningCount, onNavigate }: NavProps) {
	return (
		<nav
			aria-label="后台导航"
			className="flex overflow-y-auto flex-col flex-1 gap-5 px-2 py-3"
		>
			{adminNav.map(({ section, items }) => (
				<div key={section} className="flex flex-col gap-0.5">
					{!collapsed && (
						<p className="px-2.5 pb-1 text-[10px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
							{section}
						</p>
					)}
					{items.map((item) => {
						const active = isNavItemActive(item, pathname);
						const Icon = item.icon;
						const badge =
							item.badge === "tasks-running" && runningCount > 0
								? runningCount
								: null;
						return (
							<Link
								key={item.to}
								to={item.to}
								onClick={onNavigate}
								aria-current={active ? "page" : undefined}
								title={collapsed ? item.label : undefined}
								className={cn(
									"group relative flex gap-2.5 items-center rounded-lg text-sm font-medium transition-colors duration-150",
									collapsed ? "justify-center size-9 mx-auto" : "px-2.5 h-9",
									active
										? "bg-sidebar-accent text-sidebar-accent-foreground"
										: "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
								)}
							>
								{active && (
									<span className="absolute left-0 w-0.5 h-5 bg-primary rounded-r-full" />
								)}
								<Icon
									className={cn(
										"shrink-0 size-4",
										active ? "text-sidebar-primary" : "text-muted-foreground",
									)}
								/>
								{!collapsed && (
									<>
										<span className="flex-1 truncate">{item.label}</span>
										{badge != null && (
											<span className="flex justify-center items-center px-1 h-4.5 min-w-4.5 text-[10px] font-semibold tabular-nums text-info-foreground bg-info rounded-full">
												{badge > 99 ? "99+" : badge}
											</span>
										)}
									</>
								)}
							</Link>
						);
					})}
				</div>
			))}
		</nav>
	);
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const user = session?.user;

	const signOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					queryClient.invalidateQueries({ queryKey: ["auth"] });
					toast.success("已退出登录");
				},
				onError: () => {
					toast.error("退出登录失败");
				},
			},
		});
	};

	return (
		<div className="flex flex-col gap-1 px-2 py-2 border-t border-sidebar-border">
			<Link
				to="/"
				title={collapsed ? "查看站点" : undefined}
				className={cn(
					"flex gap-2.5 items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
					collapsed ? "justify-center size-9 mx-auto" : "px-2.5 h-9",
				)}
			>
				<ExternalLinkIcon className="shrink-0 size-4" />
				{!collapsed && "查看站点"}
			</Link>

			{user ? (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<button
								type="button"
								className={cn(
									"flex gap-2.5 items-center rounded-lg text-sm text-left transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
									collapsed ? "justify-center size-9 mx-auto" : "px-2 py-1.5",
								)}
							/>
						}
					>
						<Avatar className="size-6 shrink-0">
							<AvatarImage src={user.image ?? undefined} alt="" />
							<AvatarFallback>
								{user.name?.slice(0, 1) ?? <UserIcon className="size-3" />}
							</AvatarFallback>
						</Avatar>
						{!collapsed && (
							<span className="flex flex-col flex-1 min-w-0">
								<span className="text-xs font-medium truncate">
									{user.name ?? "管理员"}
								</span>
								<span className="text-[11px] truncate text-muted-foreground">
									{user.email}
								</span>
							</span>
						)}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" side="top" className="w-52">
						{/* GroupLabel 必须在 Menu.Group 内，否则 Base UI 抛 MenuGroupContext is missing */}
						<DropdownMenuGroup>
							<DropdownMenuLabel className="truncate">
								{user.email}
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => void signOut()}>
								<LogOutIcon className="size-4" />
								退出登录
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</div>
	);
}

function MobileNav({
	pathname,
	runningCount,
}: {
	pathname: string;
	runningCount: number;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="打开菜单"
				onClick={() => setOpen(true)}
			>
				<MenuIcon className="size-4.5" />
			</Button>
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent
					side="left"
					showCloseButton={false}
					className="flex flex-col gap-0 p-0 w-64 text-sidebar-foreground bg-sidebar"
				>
					<SheetTitle className="sr-only">后台导航</SheetTitle>
					<div className="flex justify-between items-center px-4 h-14 border-b border-sidebar-border">
						<BrandMark />
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="关闭菜单"
							onClick={() => setOpen(false)}
						>
							<XIcon className="size-4" />
						</Button>
					</div>
					<NavList
						pathname={pathname}
						collapsed={false}
						runningCount={runningCount}
						onNavigate={() => setOpen(false)}
					/>
					<SidebarFooter collapsed={false} />
				</SheetContent>
			</Sheet>
		</>
	);
}

function TopBar({
	pathname,
	runningCount,
	onOpenCommand,
}: {
	pathname: string;
	runningCount: number;
	onOpenCommand: () => void;
}) {
	const matched = findNavItem(pathname);
	const [scrolling, setScrolling] = useState(false);

	// 滚动中关闭 backdrop-blur：每帧重采样是长列表掉帧的主因（沿用旧实现的结论）
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const onScroll = () => {
			setScrolling(true);
			clearTimeout(timer);
			timer = setTimeout(() => setScrolling(false), 160);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			clearTimeout(timer);
		};
	}, []);

	return (
		<header
			className={cn(
				"flex sticky top-0 z-30 gap-2 items-center px-3 h-14 bg-background/85 border-b border-border/60 sm:px-5",
				!scrolling && "backdrop-blur-xl",
			)}
		>
			<div className="lg:hidden">
				<MobileNav pathname={pathname} runningCount={runningCount} />
			</div>

			<nav aria-label="面包屑" className="flex gap-1.5 items-center min-w-0">
				<span className="hidden text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase sm:inline">
					管理台
				</span>
				{matched && (
					<>
						<ChevronRightIcon className="hidden size-3.5 text-muted-foreground/40 sm:block" />
						<span className="hidden text-xs text-muted-foreground sm:inline">
							{matched.section}
						</span>
						<ChevronRightIcon className="hidden size-3.5 text-muted-foreground/40 sm:block" />
					</>
				)}
				<span className="text-sm font-semibold tracking-tight truncate">
					{matched?.item.label ?? "管理后台"}
				</span>
			</nav>

			<div className="flex gap-1.5 items-center ml-auto">
				<button
					type="button"
					onClick={onOpenCommand}
					className="hidden gap-2 items-center px-2.5 h-8 text-xs text-muted-foreground rounded-lg ring-1 ring-border/70 transition-colors hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:flex"
				>
					<CommandIcon className="size-3.5" />
					<span>搜索页面</span>
					<kbd className="px-1 h-4.5 text-[10px] bg-muted rounded">⌘K</kbd>
				</button>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="搜索页面"
					onClick={onOpenCommand}
					className="sm:hidden"
				>
					<CommandIcon className="size-4" />
				</Button>
				<ThemeToggle variant="ghost" size="icon-sm" />
			</div>
		</header>
	);
}

/**
 * 管理端独立布局。
 *
 * 结构对齐 new-api：固定侧栏（可折叠图标模式）+ 玻璃顶栏（面包屑 + ⌘K 命令面板）
 * + 内容区容器查询。用户端 Header/Footer 完全隔离。
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
	const { pathname } = useLocation();
	const [collapsed, setCollapsed] = useLocalStorageState(
		"galzy:admin:sidebar:collapsed",
		false,
	);
	const [commandOpen, setCommandOpen] = useState(false);
	const runningCount = useRunningTaskCount();

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setCommandOpen((open) => !open);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<div className="flex w-full min-h-screen bg-muted/40 dark:bg-background">
			<a
				href="#admin-main"
				className="fixed top-3 left-3 z-[100] px-4 py-2 text-sm font-medium bg-background rounded-xl ring-1 ring-border shadow-lg transition-transform duration-200 -translate-y-20 focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
			>
				跳到主内容
			</a>

			{/* 桌面侧栏 */}
			<aside
				className={cn(
					"hidden fixed inset-y-0 left-0 z-40 flex-col text-sidebar-foreground bg-sidebar border-r border-sidebar-border/70 transition-[width] duration-200 lg:flex",
					collapsed ? "w-14" : "w-60",
				)}
			>
				<div
					className={cn(
						"flex gap-1 items-center h-14 border-b border-sidebar-border",
						collapsed ? "justify-center px-2" : "justify-between px-3",
					)}
				>
					<BrandMark collapsed={collapsed} />
					{!collapsed && (
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="收起侧栏"
							onClick={() => setCollapsed(true)}
							className="text-muted-foreground"
						>
							<PanelLeftCloseIcon className="size-4" />
						</Button>
					)}
				</div>

				{/* 折叠态把展开按钮放在导航上方，避免和品牌挤在一行 */}
				{collapsed && (
					<div className="flex justify-center pt-2">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="展开侧栏"
							onClick={() => setCollapsed(false)}
							className="text-muted-foreground"
						>
							<PanelLeftOpenIcon className="size-4" />
						</Button>
					</div>
				)}

				<NavList
					pathname={pathname}
					collapsed={collapsed}
					runningCount={runningCount}
				/>
				<SidebarFooter collapsed={collapsed} />
			</aside>

			{/* 主区域 */}
			<div
				className={cn(
					"flex flex-col flex-1 min-w-0 transition-[padding] duration-200",
					collapsed ? "lg:pl-14" : "lg:pl-60",
				)}
			>
				<TopBar
					pathname={pathname}
					runningCount={runningCount}
					onOpenCommand={() => setCommandOpen(true)}
				/>
				<main
					id="admin-main"
					tabIndex={-1}
					className="flex-1 px-3 py-5 mx-auto w-full max-w-[1400px] outline-none sm:px-5 lg:px-7 lg:py-6"
				>
					{children}
				</main>
			</div>

			<AdminCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
		</div>
	);
}
