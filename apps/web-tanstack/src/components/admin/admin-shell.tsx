import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { adminNav } from "@web/components/admin/admin-nav";
import ThemeToggle from "@web/components/ThemeToggle";
import { Button } from "@web/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@web/components/ui/sheet";
import { cn } from "@web/lib/utils";
import { authClient } from "@web/server/auth/auth-client";
import {
	ChevronRightIcon,
	ExternalLinkIcon,
	LogOutIcon,
	MenuIcon,
	ShieldCheckIcon,
	XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function isActive(to: string, exact: boolean | undefined, pathname: string) {
	return exact ? pathname === to : pathname.startsWith(to);
}

function pageTitleOf(pathname: string): string {
	for (const section of adminNav) {
		for (const item of section.items) {
			if (isActive(item.to, item.exact, pathname)) return item.label;
		}
	}
	return "管理后台";
}

function SignOutButton({
	variant = "ghost",
}: {
	variant?: "ghost" | "outline";
}) {
	const queryClient = useQueryClient();
	return (
		<Button
			variant={variant}
			size="sm"
			onClick={async () => {
				await authClient.signOut({
					fetchOptions: {
						onError: () => {
							toast.error("退出登录失败");
						},
						onSuccess: () => {
							queryClient.invalidateQueries({ queryKey: ["auth"] });
							toast.success("已退出登录");
						},
					},
				});
			}}
		>
			<LogOutIcon className="size-4" />
			退出登录
		</Button>
	);
}

function AdminBrand() {
	return (
		<div className="flex gap-3 items-center px-2">
			<div className="flex justify-center items-center size-9 text-primary-foreground bg-primary rounded-xl shadow-[0_1px_2px_oklch(0_0_0/0.08)]">
				<ShieldCheckIcon className="size-5" />
			</div>
			<div className="flex flex-col">
				<span className="text-sm leading-none font-semibold tracking-tight">
					GalZY 管理台
				</span>
				<span className="mt-1 text-[10px] leading-none tracking-[0.2em] text-muted-foreground uppercase">
					Admin Console
				</span>
			</div>
		</div>
	);
}

function AdminNavList({
	pathname,
	onNavigate,
}: {
	pathname: string;
	onNavigate?: () => void;
}) {
	return (
		<nav className="flex overflow-y-auto flex-col flex-1 gap-6 px-3 py-4">
			{adminNav.map(({ section, items }) => (
				<div key={section} className="flex flex-col gap-1">
					<p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase">
						{section}
					</p>
					{items.map((item) => {
						const active = isActive(item.to, item.exact, pathname);
						const Icon = item.icon;
						return (
							<Link
								key={item.to}
								to={item.to}
								onClick={onNavigate}
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex gap-3 items-center px-3 py-2 text-sm font-medium rounded-xl transition-colors duration-200",
									active
										? "text-sidebar-accent-foreground bg-sidebar-accent ring-1 ring-sidebar-border/60"
										: "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
								)}
							>
								<Icon
									className={cn(
										"shrink-0 size-4",
										active ? "text-sidebar-primary" : "text-muted-foreground",
									)}
								/>
								{item.label}
							</Link>
						);
					})}
				</div>
			))}
		</nav>
	);
}

// 侧栏尾部：返回站点 + 退出登录
function AdminSidebarFooter() {
	return (
		<div className="flex flex-col gap-1 px-3 py-4 border-t border-sidebar-border">
			<Link
				to="/"
				className="flex gap-3 items-center px-3 py-2 text-sm font-medium text-muted-foreground rounded-xl transition-colors duration-200 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
			>
				<ExternalLinkIcon className="shrink-0 size-4" />
				返回站点
			</Link>
			<SignOutButton />
		</div>
	);
}

// 移动端抽屉导航：复用 shadcn Sheet（side="left"）
function AdminMobileNav({ pathname }: { pathname: string }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				aria-label="打开菜单"
				onClick={() => setOpen(true)}
			>
				<MenuIcon className="size-5" />
			</Button>
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent
					side="left"
					showCloseButton={false}
					className="flex flex-col gap-0 p-0 w-72 text-sidebar-foreground bg-sidebar"
				>
					<SheetTitle className="sr-only">后台导航</SheetTitle>
					<div className="flex justify-between items-center p-4 border-b border-sidebar-border">
						<AdminBrand />
						<Button
							variant="ghost"
							size="icon"
							aria-label="关闭菜单"
							onClick={() => setOpen(false)}
						>
							<XIcon className="size-5" />
						</Button>
					</div>
					<AdminNavList pathname={pathname} onNavigate={() => setOpen(false)} />
					<AdminSidebarFooter />
				</SheetContent>
			</Sheet>
		</>
	);
}

// 顶栏：移动端菜单入口 + 当前页面标题 + 主题切换 + 返回站点
function AdminTopBar({ pathname }: { pathname: string }) {
	// backdrop-blur 按需启用：滚动全程重采样是列表滚动掉帧的主因之一
	// （内容逐帧上屏时 header 反复重滤波）。滚动中移除，静止 150ms 后恢复；
	// bg-background/85 在滚动中仍保持近不透明，视觉几乎无差异。
	const [scrolling, setScrolling] = useState(false);
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const onScroll = () => {
			setScrolling(true);
			clearTimeout(timer);
			timer = setTimeout(() => setScrolling(false), 150);
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
				"flex sticky top-0 z-30 gap-3 items-center px-4 h-[var(--app-header-height)] bg-background/80 border-b border-border/60 sm:px-6 lg:px-8",
				!scrolling && "backdrop-blur-xl",
			)}
		>
			<div className="lg:hidden">
				<AdminMobileNav pathname={pathname} />
			</div>
			<div className="flex gap-2 items-center min-w-0">
				<span className="hidden text-[11px] font-medium tracking-wider text-muted-foreground/60 uppercase sm:inline">
					管理后台
				</span>
				<ChevronRightIcon className="hidden size-3.5 text-muted-foreground/40 sm:block" />
				<span className="text-sm font-semibold tracking-tight truncate">
					{pageTitleOf(pathname)}
				</span>
			</div>
			<div className="flex gap-2 items-center ml-auto">
				<Link
					to="/"
					className="hidden gap-1.5 items-center px-2.5 h-8 text-xs font-medium text-muted-foreground rounded-lg transition-colors duration-200 hover:text-foreground hover:bg-muted/60 sm:flex"
				>
					<ExternalLinkIcon className="size-3.5" />
					查看站点
				</Link>
				<ThemeToggle />
			</div>
		</header>
	);
}

/**
 * 管理端独立布局：固定侧栏（桌面）+ 抽屉导航（移动）+ 顶栏。
 * 由 /admin/_authL pathless 布局渲染，用户端 Header/Footer/广告完全隔离。
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
	const { pathname } = useLocation();

	return (
		<div className="flex w-full min-h-screen bg-muted/40 dark:bg-background">
			<a
				href="#admin-main"
				className="fixed top-3 left-3 z-[100] px-4 py-2 text-sm font-medium bg-background rounded-xl ring-1 ring-border shadow-lg transition-transform duration-200 -translate-y-20 focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
			>
				跳到主内容
			</a>
			{/* 桌面侧栏 */}
			<aside className="hidden fixed inset-y-0 left-0 z-40 flex-col w-64 text-sidebar-foreground bg-sidebar border-r border-sidebar-border/70 lg:flex">
				<div className="p-4 border-b border-sidebar-border">
					<AdminBrand />
				</div>
				<AdminNavList pathname={pathname} />
				<AdminSidebarFooter />
			</aside>

			{/* 主区域 */}
			<div className="flex flex-col flex-1 min-w-0 lg:pl-64">
				<AdminTopBar pathname={pathname} />
				<main
					id="admin-main"
					tabIndex={-1}
					className="flex-1 px-4 py-6 mx-auto w-full max-w-7xl outline-none sm:px-6 lg:p-8"
				>
					{children}
				</main>
			</div>
		</div>
	);
}
