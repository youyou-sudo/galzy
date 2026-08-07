import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { adminNav } from "@web/components/admin/admin-nav";
import ThemeToggle from "@web/components/ThemeToggle";
import { Button } from "@web/components/ui/button";
import { Separator } from "@web/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@web/components/ui/sheet";
import { cn } from "@web/lib/utils";
import { authClient } from "@web/server/auth/auth-client";
import {
	ExternalLinkIcon,
	LogOutIcon,
	MenuIcon,
	ShieldCheckIcon,
	XIcon,
} from "lucide-react";
import { useState } from "react";
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
		<div className="flex items-center gap-3 px-2">
			<div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
				<ShieldCheckIcon className="size-5" />
			</div>
			<div className="flex flex-col">
				<span className="text-sm font-semibold tracking-tight leading-none">
					GalZY 管理台
				</span>
				<span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground leading-none">
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
		<nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
			{adminNav.map(({ section, items }) => (
				<div key={section} className="flex flex-col gap-1">
					<p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
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
								className={cn(
									"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
									active
										? "bg-sidebar-accent text-sidebar-accent-foreground"
										: "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
								)}
							>
								<Icon
									className={cn(
										"size-4 shrink-0",
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
		<div className="flex flex-col gap-1 border-t border-sidebar-border px-3 py-4">
			<Link
				to="/"
				className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
			>
				<ExternalLinkIcon className="size-4 shrink-0" />
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
					className="flex w-72 flex-col gap-0 bg-sidebar p-0 text-sidebar-foreground"
				>
					<SheetTitle className="sr-only">后台导航</SheetTitle>
					<div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
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
	return (
		<header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
			<div className="lg:hidden">
				<AdminMobileNav pathname={pathname} />
			</div>
			<div className="flex min-w-0 items-center gap-2">
				<span className="hidden text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 sm:inline">
					管理后台
				</span>
				<Separator orientation="vertical" className="hidden h-4 sm:block" />
				<span className="truncate text-sm font-semibold tracking-tight">
					{pageTitleOf(pathname)}
				</span>
			</div>
			<div className="ml-auto flex items-center gap-2">
				<Link
					to="/"
					className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:flex"
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
		<div className="flex min-h-screen w-full bg-muted/40 dark:bg-background">
			{/* 桌面侧栏 */}
			<aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
				<div className="border-b border-sidebar-border px-4 py-4">
					<AdminBrand />
				</div>
				<AdminNavList pathname={pathname} />
				<AdminSidebarFooter />
			</aside>

			{/* 主区域 */}
			<div className="flex min-w-0 flex-1 flex-col lg:pl-64">
				<AdminTopBar pathname={pathname} />
				<main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
					{children}
				</main>
			</div>
		</div>
	);
}
