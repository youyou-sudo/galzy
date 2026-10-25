import { Button } from "@web/components/ui/button";
import { cn } from "@web/lib/utils";

/**
 * 移动端菜单按钮：三条横线 morph 成 X。
 *
 * 刻意不用 Menu / X 图标切换：两个图标之间没有可插值的中间态，切换会「跳」；
 * 三条绝对定位的横线各自只做 translate / rotate / opacity，全程走合成器。
 * onPrefetch 在 hover / focus 时预热 mobile-menu 的 lazy chunk，
 * 首次点击才不会等网络。
 */
export function MobileMenuTrigger({
	open,
	menuMounted,
	onToggle,
	onPrefetch,
}: {
	open: boolean;
	/** 覆盖层是否已挂载：未挂载时 aria-controls 会指向不存在的节点，干脆不输出 */
	menuMounted: boolean;
	onToggle: () => void;
	onPrefetch: () => void;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			className="rounded-lg md:hidden"
			aria-label={open ? "关闭菜单" : "打开菜单"}
			aria-expanded={open}
			aria-controls={menuMounted ? "galzy-mobile-menu" : undefined}
			onClick={onToggle}
			onPointerEnter={onPrefetch}
			onFocus={onPrefetch}
		>
			<span
				aria-hidden="true"
				className="relative flex size-4 items-center justify-center"
			>
				<span
					className={cn(
						"absolute h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
						open ? "rotate-45" : "-translate-y-1.5",
					)}
				/>
				<span
					className={cn(
						"absolute h-[1.5px] w-4 rounded-full bg-current transition-opacity duration-200",
						open ? "scale-x-0 opacity-0" : "opacity-100",
					)}
				/>
				<span
					className={cn(
						"absolute h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
						open ? "-rotate-45" : "translate-y-1.5",
					)}
				/>
			</span>
		</Button>
	);
}
