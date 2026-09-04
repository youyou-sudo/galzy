import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { Image } from "@unpic/react";
import { Button } from "@web/components/ui/button";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
} from "@web/components/ui/navigation-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import { cn } from "@web/lib/utils";
import { r18Actions, r18Store } from "@web/stores/r18Store";
import {
	ExternalLink,
	Eye,
	EyeOff,
	Home,
	Mail,
	Megaphone,
	Menu,
	Wrench,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";

// 仅客户端懒加载：auth-client/better-auth、头像裁剪等只在用户菜单挂载后进入客户端，
// SSR 不渲染该组件（输出骨架），首屏不下载其代码
const UserMenu = lazy(() => import("./user/UserMenu"));
// 懒加载：dialog/scroll-lock 代码不进首屏 bundle，空闲时预加载、首次打开前就绪
const loadHeaderMobileMenu = () =>
	import("./header/mobile-menu").then((m) => ({
		default: m.HeaderMobileMenu,
	}));
const HeaderMobileMenu = lazy(loadHeaderMobileMenu);

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	const showR18 = useSelector(r18Store, (s) => s.showR18);
	useEffect(() => {
		setMounted(true);
		// 移动端首屏空闲时预加载侧栏菜单 chunk：首次点击汉堡按钮时立即打开，不等待网络请求
		if (window.matchMedia("(max-width: 767px)").matches) {
			const run = () => void loadHeaderMobileMenu();
			if (typeof requestIdleCallback === "function") {
				requestIdleCallback(run, { timeout: 2000 });
			} else {
				setTimeout(run, 300);
			}
		}
	}, []);
	return (
		<div className="sticky top-0 z-50 mx-auto w-full max-w-7xl border-b bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-2 lg:mb-4 rounded-full lg:border dark:opacity-70">
			<div className="flex items-center justify-between">
				{/* Left block */}
				<div className="flex items-center">
					<Link to="/" className="hidden md:flex items-center">
						<Image src="/favicon.ico" width={32} height={32} />
					</Link>
					<div className="md:hidden">
						<Button
							variant="ghost"
							size="icon"
							aria-label="打开菜单"
							onClick={() => setIsOpen(true)}
							onPointerEnter={() => void loadHeaderMobileMenu()}
						>
							<Menu className="size-5" />
							<span className="sr-only">打开菜单</span>
						</Button>
						{isOpen && (
							<Suspense fallback={null}>
								<HeaderMobileMenu open={isOpen} onOpenChange={setIsOpen} />
							</Suspense>
						)}
					</div>
					<div className="hidden md:block">
						<NavigationMenu>
							<NavigationMenuList>
								<NavigationMenuItem>
									<NavigationMenuTrigger>主页</NavigationMenuTrigger>
									<NavigationMenuContent>
										<ul className="grid w-[280px] gap-1">
											<li>
												<NavigationMenuLink
													className={cn(
														navigationMenuTriggerStyle(),
														"h-auto w-full justify-start gap-3",
													)}
													render={<Link to="/" />}
												>
													<Home className="size-4 shrink-0" />
													<div className="flex flex-col items-start gap-0.5">
														<span className="text-sm font-medium">主站</span>
														<span className="text-xs font-normal text-muted-foreground">
															GalZY 游戏资源主页
														</span>
													</div>
												</NavigationMenuLink>
											</li>
											<li>
												<NavigationMenuLink
													className={cn(
														navigationMenuTriggerStyle(),
														"h-auto w-full justify-start gap-3",
													)}
													render={
														<a
															href="https://list.galzy.moe"
															target="_blank"
															rel="noreferrer"
														/>
													}
												>
													<ExternalLink className="size-4 shrink-0" />
													<div className="flex flex-col items-start gap-0.5">
														<span className="text-sm font-medium">
															OpList 站
														</span>
														<span className="text-xs font-normal text-muted-foreground">
															Openlist 搭建 · list.galzy.moe
														</span>
													</div>
												</NavigationMenuLink>
											</li>
											<li>
												<NavigationMenuLink
													className={cn(
														navigationMenuTriggerStyle(),
														"h-auto w-full justify-start gap-3",
													)}
													render={
														<a
															href="https://galzy.top/"
															target="_blank"
															rel="noreferrer"
														/>
													}
												>
													<Megaphone className="size-4 shrink-0" />
													<div className="flex flex-col items-start gap-0.5">
														<span className="text-sm font-medium">
															防失联&发布页
														</span>
														<span className="text-xs font-normal text-muted-foreground">
															维护公告 · 防失联 · 地址发布
														</span>
													</div>
												</NavigationMenuLink>
											</li>
											<li>
												<NavigationMenuLink
													className={cn(
														navigationMenuTriggerStyle(),
														"h-auto w-full justify-start gap-3",
													)}
													render={<Link to="/contact" />}
												>
													<Mail className="size-4 shrink-0" />
													<div className="flex flex-col items-start gap-0.5">
														<span className="text-sm font-medium">联系</span>
														<span className="text-xs font-normal text-muted-foreground">
															问题反馈 · 合作赞助
														</span>
													</div>
												</NavigationMenuLink>
											</li>
										</ul>
									</NavigationMenuContent>
								</NavigationMenuItem>
								<NavigationMenuItem>
									<NavigationMenuLink
										className={navigationMenuTriggerStyle()}
										render={<Link to="/tags" preload="viewport" />}
									>
										标签
									</NavigationMenuLink>
								</NavigationMenuItem>
								<NavigationMenuItem>
									<NavigationMenuLink
										className={navigationMenuTriggerStyle()}
										render={<Link to="/producer" preload="viewport" />}
									>
										会社
									</NavigationMenuLink>
								</NavigationMenuItem>
								<NavigationMenuItem>
									<NavigationMenuLink
										className={navigationMenuTriggerStyle()}
										render={
											<Link
												to="/collections"
												search={{ page: 1 }}
												preload="viewport"
											/>
										}
									>
										合集
									</NavigationMenuLink>
								</NavigationMenuItem>
								<NavigationMenuItem>
									<NavigationMenuTrigger>工具</NavigationMenuTrigger>
									<NavigationMenuContent>
										<ul className="grid w-[220px] gap-1 p-3">
											<li>
												<NavigationMenuLink
													className={cn(
														navigationMenuTriggerStyle(),
														"h-auto w-full justify-start gap-3",
													)}
													render={<Link to="/tools" />}
												>
													<Wrench className="size-4 shrink-0" />
													<div className="flex flex-col items-start gap-0.5">
														<span className="text-sm font-medium">
															所有工具
														</span>
														<span className="text-xs font-normal text-muted-foreground">
															查看全部实用工具
														</span>
													</div>
												</NavigationMenuLink>
											</li>
											<li>
												<NavigationMenuLink
													className={cn(
														navigationMenuTriggerStyle(),
														"h-auto w-full justify-start gap-3",
													)}
													render={<Link to="/tools/plate" />}
												>
													<ExternalLink className="size-4 shrink-0" />
													<div className="flex flex-col items-start gap-0.5">
														<span className="text-sm font-medium">
															车牌号跳转
														</span>
														<span className="text-xs font-normal text-muted-foreground">
															快速跳转到 nhentai、禁漫天堂等网站
														</span>
													</div>
												</NavigationMenuLink>
											</li>
										</ul>
									</NavigationMenuContent>
								</NavigationMenuItem>
								<NavigationMenuItem>
									<NavigationMenuLink
										className={navigationMenuTriggerStyle()}
										render={
											<Link
												to="/topics"
												search={{ page: 1 }}
												preload="viewport"
											/>
										}
									>
										论坛
									</NavigationMenuLink>
								</NavigationMenuItem>
							</NavigationMenuList>
						</NavigationMenu>
					</div>
				</div>

				{/* Right block */}
				<div className="flex items-center gap-2">
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									variant="ghost"
									size="sm"
									className={cn(
										"gap-1 px-1.5 min-w-0",
										showR18
											? "text-pink-500 hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/20"
											: "text-green-500 hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20",
									)}
									onClick={r18Actions.toggle}
								>
									{showR18 ? (
										<Eye className="size-4 shrink-0" />
									) : (
										<EyeOff className="size-4 shrink-0" />
									)}
									<span className="text-[10px] font-bold leading-none">
										涩！
									</span>
								</Button>
							}
						/>
						<TooltipContent>
							{showR18
								? "点击关闭涩！过滤 R18 游戏"
								: "点击开启涩！显示 R18 游戏"}
						</TooltipContent>
					</Tooltip>
					<ThemeToggle />
					{mounted ? (
						<Suspense
							fallback={
								<div className="size-8 rounded-full bg-muted animate-pulse" />
							}
						>
							<UserMenu />
						</Suspense>
					) : (
						<div className="size-8 rounded-full bg-muted animate-pulse" />
					)}
				</div>
			</div>
		</div>
	);
}
