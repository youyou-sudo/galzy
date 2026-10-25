import { Monitor, Moon, Sun } from "lucide-react";

export type ThemeMode = "light" | "dark" | "auto";

/**
 * 主题按钮的图标。
 *
 * 抽成独立组件是必须的：收起态按钮、懒加载期间的占位按钮、展开后的下拉触发器
 * 三处必须渲染**完全一致**的图标，否则菜单挂载的那一刻按钮会「变脸」。
 */
export function ThemeIcon({ mode }: { mode: ThemeMode }) {
	if (mode === "light") {
		return <Sun className="size-[1.2rem] text-amber-500" />;
	}
	if (mode === "dark") {
		return <Moon className="size-[1.2rem] text-blue-400" />;
	}
	return <Monitor className="size-[1.2rem] text-zinc-500" />;
}
