import { useSelector } from "@tanstack/react-store";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import { Button } from "@web/components/ui/button";
import { cn } from "@web/lib/utils";
import { r18Actions, r18Store } from "@web/stores/r18Store";
import { Eye, EyeOff } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import ThemeToggle from "../ThemeToggle";

// 仅客户端懒加载：auth-client/better-auth、头像裁剪等只在用户菜单挂载后进入客户端，
// SSR 不渲染该组件（输出骨架），首屏不下载其代码
const UserMenu = lazy(() => import("../user/UserMenu"));

/**
 * 顶栏右侧动作区。**按钮顺序固定**（与旧顶栏一致，不允许调整）：
 * 涩！过滤 → 主题切换 → 发丝分隔 → 用户（未登录时是登录入口）。
 *
 * 三段统一 32px 高：玻璃药丸在滚动中收缩时，右侧不会因为高度差互相挤动。
 */
export default function HeaderActions() {
	const showR18 = useSelector(r18Store, (s) => s.showR18);
	// session 只在浏览器可用：首帧渲染占位，避免 SSR 与客户端结构不一致
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	return (
		<div className="flex shrink-0 items-center gap-0.5">
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							variant="ghost"
							size="sm"
							aria-pressed={showR18}
							aria-label="涩！R18 过滤"
							className={cn(
								"h-8 gap-1 rounded-lg px-2",
								showR18
									? "text-[color:var(--header-pink)] hover:bg-pink-500/10"
									: "text-[color:var(--header-success)] hover:bg-success/10",
							)}
							onClick={r18Actions.toggle}
						>
							{showR18 ? (
								<Eye className="size-4 shrink-0" />
							) : (
								<EyeOff className="size-4 shrink-0" />
							)}
							<span className="text-[10px] leading-none font-semibold">涩！</span>
						</Button>
					}
				/>
				<TooltipContent>
					{showR18 ? "点击关闭涩！过滤 R18 游戏" : "点击开启涩！显示 R18 游戏"}
				</TooltipContent>
			</Tooltip>

			<ThemeToggle
				variant="ghost"
				size="icon-sm"
				className="text-[color:var(--header-muted)] hover:bg-[var(--header-hover)] hover:text-[color:var(--header-fg)]"
			/>

			{/* 操作组与账户之间的发丝分隔：窄屏下省掉，避免和头像挤在一起 */}
			<span
				aria-hidden="true"
				className="mx-1 hidden h-4 w-px bg-[color:var(--header-muted)]/30 sm:block"
			/>

			{mounted ? (
				<Suspense
					fallback={
						<div className="size-8 rounded-full bg-[color:var(--header-muted)]/25" />
					}
				>
					<UserMenu />
				</Suspense>
			) : (
				<div className="size-8 rounded-full bg-[color:var(--header-muted)]/25" />
			)}
		</div>
	);
}
