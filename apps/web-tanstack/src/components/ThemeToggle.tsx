import { lazy, Suspense, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Monitor, Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark" | "auto";

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

// 懒加载：dropdown-menu 代码只在首次点击主题按钮时进入客户端
const ThemeMenu = lazy(() =>
	import("./theme-menu").then((m) => ({
		default: m.ThemeMenu,
	})),
);

export default function ThemeToggle() {
	const [mode, setMode] = useState<ThemeMode>("auto");
	const [open, setOpen] = useState(false);

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

	function changeMode(next: ThemeMode) {
		setMode(next);
		applyThemeMode(next);
		window.localStorage.setItem("theme", next);
		setOpen(false);
	}

	if (!open) {
		return (
			<Button
				variant="outline"
				size="icon"
				className="rounded-full"
				aria-label="切换主题"
				onClick={() => setOpen(true)}
			>
				{mode === "light" ? (
					<Sun className="size-[1.2rem] text-amber-500" />
				) : mode === "dark" ? (
					<Moon className="size-[1.2rem] text-blue-400" />
				) : (
					<Monitor className="size-[1.2rem] text-zinc-500" />
				)}
				<span className="sr-only">主题</span>
			</Button>
		)
	}

	return (
		<Suspense fallback={null}>
			<ThemeMenu
				open={open}
				mode={mode}
				onOpenChange={setOpen}
				onSelect={changeMode}
			/>
		</Suspense>
	);
}
