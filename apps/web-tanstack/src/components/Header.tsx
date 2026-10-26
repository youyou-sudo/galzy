import { Link, useRouterState } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { useHeaderTone } from "@web/hooks/use-header-tone";
import { cn } from "@web/lib/utils";
import { lazy, Suspense, useEffect, useState } from "react";
import { DesktopNav } from "./header/desktop-nav";
import HeaderActions from "./header/header-actions";
import { MobileMenuTrigger } from "./header/mobile-trigger";

// 懒加载：全屏菜单的代码不进首屏 bundle，移动端首屏空闲时预加载、首次打开前就绪
const loadHeaderMobileMenu = () =>
	import("./header/mobile-menu").then((m) => ({
		default: m.HeaderMobileMenu,
	}));
const HeaderMobileMenu = lazy(loadHeaderMobileMenu);

/**
 * 滚动超过这个像素就收起为「玻璃药丸」。
 * 8px 而不是几十像素：顶栏在页面顶部是完全透明的，内容一旦开始上移就必须
 * 立刻给出一块可读的底（药丸 + 背景模糊），否则标题会从透明顶栏里穿过去。
 */
const SCROLL_PILL_THRESHOLD = 8;

/**
 * 用户端顶栏。
 *
 * 布局参考 new-api 的 PublicHeader：
 * - 固定定位，页面顶部完全透明（内容靠 __root 的 pt-14 让位）；
 * - 滚动后向中间收缩成 4xl 宽的悬浮药丸：高度 56→44、圆角 2xl、发丝描边 + 阴影；
 * - 背景模糊按需启用：滚动全程重采样是列表滚动掉帧的主因之一（图片逐张上屏时
 *   header 反复重滤波）。滚动中只留 bg-background/95，静止 150ms 后恢复 blur，
 *   视觉几乎无差异。
 */
export default function Header() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [isOpen, setIsOpen] = useState(false);
	// 首次打开后保持挂载：关闭动画由 mobile-menu 自己用 open 过渡，卸载会丢掉动画
	const [menuReady, setMenuReady] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const [scrolling, setScrolling] = useState(false);
	// 只在透明态需要：采样顶栏背后的背景图亮度，自动切换深字/浅字
	const headerTone = useHeaderTone(!scrolled);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const onScroll = () => {
			setScrolled(window.scrollY > SCROLL_PILL_THRESHOLD);
			setScrolling(true);
			clearTimeout(timer);
			timer = setTimeout(() => setScrolling(false), 150);
		};
		// 首帧校正：刷新时可能已经停在页面中部
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			clearTimeout(timer);
		};
	}, []);

	useEffect(() => {
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

	// 路由变化时收起菜单：点击条目本身会关，这一条兜住浏览器前进/后退。
	// 顺便同步一次滚动态：路由切换后可能停在页面顶部，而 scroll 事件不保证派发。
	useEffect(() => {
		setIsOpen(false);
		setScrolled(window.scrollY > SCROLL_PILL_THRESHOLD);
	}, [pathname]);

	// 视口从移动端变宽到 md：汉堡入口消失，覆盖层却仍会盖住页面、锁住 body 滚动，
	// 必须在断点变化时主动收起
	useEffect(() => {
		const media = window.matchMedia("(min-width: 768px)");
		const onChange = () => {
			if (media.matches) setIsOpen(false);
		};
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, []);

	const showMenu = () => {
		setMenuReady(true);
		setIsOpen(true);
	};

	return (
		<>
			<header
				className="galzy-site-header fixed inset-x-0 top-0 z-50"
				data-header-tone={!scrolled ? (headerTone ?? undefined) : undefined}
			>
				<div
					className={cn(
						// 只过渡真正变化的布局属性：transition-all 会把 backdrop-filter
						// 也纳入过渡，停手那一下多一次整条顶栏重绘
						"mx-auto w-full transition-[max-width,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
						scrolled ? "px-3 pt-2 max-w-4xl" : "px-4 max-w-7xl sm:px-6",
					)}
				>
					<nav
						aria-label="主导航"
						className={cn(
							"flex gap-3 justify-between items-center",
							"transition-[height,padding,background-color,box-shadow,border-radius] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
							scrolled
								? cn(
										"pr-1.5 pl-2 h-11 rounded-2xl ring-1 ring-border/60 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
										scrolling
											? "bg-background/95"
											: "bg-background/70 backdrop-blur-xl galzy-vt-no-blur",
									)
								: "h-14 bg-transparent",
						)}
					>
						{/* 左：移动端菜单入口 → 站点标识 → 桌面端主导航 */}
						<div className="flex gap-0.5 items-center min-w-0">
							<MobileMenuTrigger
								open={isOpen}
								menuMounted={menuReady}
								onToggle={() => (isOpen ? setIsOpen(false) : showMenu())}
								onPrefetch={() => void loadHeaderMobileMenu()}
							/>
							<Link
								to="/"
								aria-label="GalZY 首页"
								className="group/brand flex gap-2 items-center px-1 py-0.5 min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
							>
								{/* 小图标不参与首屏关键路径：fetchPriority="low" 同时会抑制
								React 19 自动注入的 <link rel="preload" as="image">（它会被
								排到 stylesheet / modulepreload 之前抢占关键带宽）。 */}
								{/* 站标原图直接显示：favicon 四周有内容，圆角容器 + overflow-hidden
								    会把四个角裁掉。这里只保留 hover 缩放，不做任何裁剪。 */}
								<span className="flex shrink-0 justify-center items-center size-8 transition-transform duration-300 group-hover/brand:scale-105">
									<Image
										src="/favicon.ico"
										width={32}
										height={32}
										fetchPriority="low"
										decoding="async"
										className="size-8"
									/>
								</span>
								<span className="hidden text-[15px] leading-none font-semibold tracking-tight text-[color:var(--header-fg)] truncate sm:block">
									GalZY
								</span>
							</Link>
							<div className="hidden items-center ml-1 md:flex">
								<DesktopNav />
							</div>
						</div>

						{/* 右：涩！/ 主题 / 用户 */}
						<HeaderActions />
					</nav>
				</div>
			</header>

			{menuReady && (
				<Suspense fallback={null}>
					<HeaderMobileMenu open={isOpen} onOpenChange={setIsOpen} />
				</Suspense>
			)}
		</>
	);
}
