import { cn } from "@web/lib/utils";
import { lazy, Suspense, useEffect, useState } from "react";
import { ThemeIcon } from "./theme-icon";
import type { ThemeMode } from "./theme-icon";
import { Button } from "./ui/button";

function getInitialMode(): ThemeMode {
	if (typeof window === "undefined") return "auto";

	const stored = window.localStorage.getItem("theme");
	if (stored === "light" || stored === "dark" || stored === "auto") {
		return stored;
	}

	return "auto";
}

function applyThemeMode(mode: ThemeMode) {
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;

	const root = document.documentElement;

	root.classList.remove("light", "dark");
	root.classList.add(resolved);

	if (mode === "auto") {
		root.removeAttribute("data-theme");
	} else {
		root.setAttribute("data-theme", mode);
	}

	root.style.colorScheme = resolved;
}

/** 按钮外观可被调用方接管：顶栏用 ghost（融入玻璃药丸），管理端保持 outline */
export type ThemeToggleProps = {
	variant?: "outline" | "ghost";
	size?: "icon" | "icon-sm" | "icon-lg";
	className?: string;
};

// 懒加载：dropdown-menu 代码只在首次打开主题菜单时进入客户端
const loadThemeMenu = () => import("./theme-menu");
const ThemeMenu = lazy(() =>
	loadThemeMenu().then((m) => ({ default: m.ThemeMenu })),
);

type ThemeTriggerProps = ThemeToggleProps & {
	mode: ThemeMode;
	/** 菜单已挂载后才有意义；undefined 表示按钮还没接管菜单 */
	expanded?: boolean;
	busy?: boolean;
	onClick: () => void;
	onPreload: () => void;
};

/**
 * 主题按钮本体。
 *
 * 收起态、chunk 加载中的占位、下拉菜单的触发器都用这一个组件渲染：
 * 以前 chunk 没到位时 Suspense 的 fallback 是 null，点一下按钮就「消失」几百毫秒，
 * 现在三态外观完全一致，加载期间只是按钮不可展开（aria-busy），不会再闪。
 */
function ThemeTrigger({
	mode,
	variant = "outline",
	size = "icon",
	className,
	expanded,
	busy,
	onClick,
	onPreload,
}: ThemeTriggerProps) {
	return (
		<Button
			variant={variant}
			size={size}
			className={cn("rounded-full", className)}
			aria-label="切换主题"
			aria-haspopup={expanded === undefined ? undefined : "menu"}
			aria-expanded={expanded}
			aria-busy={busy || undefined}
			onClick={onClick}
			onPointerEnter={onPreload}
			onFocus={onPreload}
		>
			<ThemeIcon mode={mode} />
			<span className="sr-only">主题</span>
		</Button>
	);
}

export default function ThemeToggle({
	variant = "outline",
	size = "icon",
	className,
}: ThemeToggleProps) {
	const [mode, setMode] = useState<ThemeMode>("auto");
	const [open, setOpen] = useState(false);
	// 首次打开后保持挂载：收起态继续用下拉菜单自己的触发器，
	// 按钮不会在 open 切换时被替换（否则每次收起都会闪一下并丢焦点）
	const [menuMounted, setMenuMounted] = useState(false);

	// 初始化
	useEffect(() => {
		const initial = getInitialMode();
		setMode(initial);
		applyThemeMode(initial);
	}, []);

	// 跟随系统
	useEffect(() => {
		if (mode !== "auto") return;

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyThemeMode("auto");

		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [mode]);

	// 空闲时预热 chunk：dropdown-menu 只在首屏空闲后才进客户端，
	// 于是首次点击基本不用等网络，菜单立即展开
	useEffect(() => {
		const run = () => void loadThemeMenu();
		if (typeof requestIdleCallback === "function") {
			requestIdleCallback(run, { timeout: 2000 });
		} else {
			setTimeout(run, 300);
		}
	}, []);

	function changeMode(next: ThemeMode) {
		setMode(next);
		applyThemeMode(next);
		window.localStorage.setItem("theme", next);
		setOpen(false);
	}

	const openMenu = () => {
		setMenuMounted(true);
		setOpen(true);
	};
	const preloadMenu = () => void loadThemeMenu();

	if (!menuMounted) {
		return (
			<ThemeTrigger
				mode={mode}
				variant={variant}
				size={size}
				className={className}
				onClick={openMenu}
				onPreload={preloadMenu}
			/>
		);
	}

	return (
		<Suspense
			fallback={
				<ThemeTrigger
					mode={mode}
					variant={variant}
					size={size}
					className={className}
					expanded={open}
					busy
					onClick={openMenu}
					onPreload={preloadMenu}
				/>
			}
		>
			<ThemeMenu
				open={open}
				mode={mode}
				onOpenChange={setOpen}
				onSelect={changeMode}
				variant={variant}
				size={size}
				className={className}
			/>
		</Suspense>
	);
}
