import { useEffect, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Check, Monitor, Moon, Sun } from "lucide-react";

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

export default function ThemeToggle() {
	const [mode, setMode] = useState<ThemeMode>("auto");

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
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" className="rounded-full">
					{mode === "light" ? (
						<Sun className="h-[1.2rem] w-[1.2rem] text-amber-500" />
					) : mode === "dark" ? (
						<Moon className="h-[1.2rem] w-[1.2rem] text-blue-400" />
					) : (
						<Monitor className="h-[1.2rem] w-[1.2rem] text-gray-500" />
					)}
					<span className="sr-only">主题</span>
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end" className="min-w-32 rounded-xl">
				<DropdownMenuItem
					className="flex items-center gap-2 cursor-pointer"
					onClick={() => changeMode("light")}
				>
					<Sun className="h-4 w-4 text-amber-500" />
					<span>浅色</span>
					{mode === "light" && <Check className="h-4 w-4 ml-auto" />}
				</DropdownMenuItem>

				<DropdownMenuItem
					className="flex items-center gap-2 cursor-pointer"
					onClick={() => changeMode("dark")}
				>
					<Moon className="h-4 w-4 text-blue-400" />
					<span>深色</span>
					{mode === "dark" && <Check className="h-4 w-4 ml-auto" />}
				</DropdownMenuItem>

				<DropdownMenuItem
					className="flex items-center gap-2 cursor-pointer"
					onClick={() => changeMode("auto")}
				>
					<Monitor className="h-4 w-4 text-gray-500" />
					<span>系统</span>
					{mode === "auto" && <Check className="h-4 w-4 ml-auto" />}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
