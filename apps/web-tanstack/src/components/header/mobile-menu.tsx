import { Link } from "@tanstack/react-router";
import { cn } from "@web/lib/utils";
import { ChevronRight, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Ref } from "react";
import { mobilePrimaryKeys, navItem, toolMenuKeys } from "./nav-config";
import type { HeaderNavItem } from "./nav-config";

/**
 * 覆盖层里的一行：左侧图标 + 主文案 +（可选）次要描述 + 右侧箭头。
 *
 * 手机端默认折叠说明文字，只保留一行 44px 的可点区域：
 * 8 个主入口 + 工具分组可以在不滚动的一屏内看完；需要看说明时由底部按钮展开。
 */
const rowClass = cn(
	"group/row galzy-mobile-item flex gap-2.5 items-center px-2.5 py-2 min-h-11 rounded-xl",
	"text-foreground no-underline outline-none transition-colors duration-200",
	"hover:bg-muted/60 focus-visible:bg-muted/60",
	"focus-visible:ring-2 focus-visible:ring-ring/60",
	// TanStack Link 命中当前路由时自带 data-status="active"
	"data-[status=active]:bg-muted/60",
);

type NavRowProps = {
	item: HeaderNavItem;
	/** 全局序号（跨分组连续），用于错峰入场延迟 */
	index: number;
	open: boolean;
	onSelect: () => void;
	rowRef?: Ref<HTMLAnchorElement>;
	/** 默认 false：说明文字折叠，保证首屏信息密度 */
	showDescription: boolean;
};

/**
 * 站外条目走原生 <a>（新标签页打开），站内条目走 TanStack Link 保留预取；
 * 两种行共享同一套排版，只差渲染目标。
 */
function NavRow({
	item,
	index,
	open,
	onSelect,
	rowRef,
	showDescription,
}: NavRowProps) {
	const Icon = item.icon;
	// 关闭后移除延迟，下次打开时关键帧从干净的起点重播
	const style = open ? { animationDelay: `${80 + index * 45}ms` } : undefined;

	const content = (
		<>
			<span
				className={cn(
					"flex shrink-0 justify-center items-center size-8 rounded-lg",
					"text-muted-foreground bg-muted/70 transition-colors duration-200",
					"group-hover/row:text-foreground group-hover/row:bg-background",
				)}
			>
				<Icon className="size-4" />
			</span>
			<span className="flex flex-col flex-1 min-w-0">
				<span className="text-sm leading-tight font-medium truncate">
					{item.label}
				</span>
				{showDescription && (
					<span className="mt-0.5 text-xs font-normal text-muted-foreground truncate">
						{item.description}
					</span>
				)}
			</span>
			<ChevronRight
				className={cn(
					"shrink-0 size-4 text-muted-foreground/60",
					"transition-transform duration-200",
					"group-hover/row:translate-x-0.5",
				)}
			/>
		</>
	);

	if (item.type === "external") {
		return (
			<a
				ref={rowRef}
				href={item.href}
				target="_blank"
				rel="noreferrer"
				className={rowClass}
				style={style}
				onClick={onSelect}
			>
				{content}
			</a>
		);
	}

	return (
		<Link
			ref={rowRef}
			to={item.to}
			preload="viewport"
			className={rowClass}
			style={style}
			onClick={onSelect}
		>
			{content}
		</Link>
	);
}

/**
 * 移动端顶栏全屏菜单。
 *
 * 这里刻意不用 Sheet / Dialog：Base UI 的焦点陷阱会把焦点锁在覆盖层内，
 * 而顶栏（z-50）要浮在覆盖层（z-40）之上且汉堡按钮必须保持可点，
 * 两者会互相抢焦点。手写覆盖层 + Esc + 焦点归还，行为可控且没有额外依赖。
 *
 * Header 首次打开后保持挂载、只切换 open，所以进出场动画全部由 open 驱动：
 * 入场读 styles.css 的 .galzy-mobile-overlay / .galzy-mobile-item 关键帧
 * （data-open="true" 时播放），退场交给这里的 opacity transition 完成。
 */
export function HeaderMobileMenu({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const triggerRef = useRef<HTMLElement | null>(null);
	const firstRowRef = useRef<HTMLAnchorElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);
	// 点导航行/外链后关闭：焦点应该跟着导航走，不能抢回汉堡按钮
	const skipFocusReturn = useRef(false);
	// 说明文字默认折叠：手机端首屏优先放完整入口，需要解释时再展开
	const [showDescriptions, setShowDescriptions] = useState(false);

	const dismissByNavigation = () => {
		skipFocusReturn.current = true;
		onOpenChange(false);
	};

	// 焦点管理：打开时记录焦点来源（通常就是顶栏汉堡按钮）并把焦点交给
	// 第一个条目；Esc / 点遮罩 / 点汉堡关闭时归还，键盘用户不会「掉」到页面顶部。
	useEffect(() => {
		if (!open) {
			if (!skipFocusReturn.current) triggerRef.current?.focus();
			skipFocusReturn.current = false;
			// 下次打开重新记录（触发器可能换了一个）
			triggerRef.current = null;
			return;
		}
		// 只在「关 → 开」的第一次记录：StrictMode 会把 effect 跑两遍，
		// 第二遍时焦点已经在第一行上，无条件覆盖会把触发者记成菜单里的链接，
		// 关闭时焦点就会「还」给一个立刻被 inert 抹掉的元素。
		if (!triggerRef.current) {
			const active = document.activeElement;
			triggerRef.current =
				active instanceof HTMLElement &&
				active !== document.body &&
				!overlayRef.current?.contains(active)
					? active
					: document.querySelector<HTMLElement>(
							'[aria-controls="galzy-mobile-menu"]',
						);
		}
		firstRowRef.current?.focus();
	}, [open]);

	// 关闭菜单后恢复折叠，下次打开仍是高密度的一屏
	useEffect(() => {
		if (!open) setShowDescriptions(false);
	}, [open]);

	// 滚动锁：保存原值再恢复，避免覆盖其他组件对 body.style.overflow 的写法。
	// html 上有 scrollbar-gutter: stable，隐藏溢出不会引起横向抖动。
	useEffect(() => {
		if (!open) return;
		const { body } = document;
		const previous = body.style.overflow;
		body.style.overflow = "hidden";
		return () => {
			body.style.overflow = previous;
		};
	}, [open]);

	// 键盘：Esc 关闭 + Tab 首尾循环。
	// 覆盖层自称 aria-modal，但顶栏（z-50）在其上方且必须可点，所以不能交给
	// Dialog 的焦点陷阱；手写「首尾哨兵」把 Tab 圈在覆盖层内，避免焦点跑到
	// 被覆盖层盖住的正文里。
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onOpenChange(false);
				return;
			}
			if (event.key !== "Tab") return;

			const root = overlayRef.current;
			if (!root) return;
			const focusables = Array.from(
				root.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]):not([tabindex="-1"])',
				),
			).filter(
				(el) => el.offsetParent !== null || el === document.activeElement,
			);
			if (focusables.length === 0) return;

			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement;
			const outside = !root.contains(active);

			if (event.shiftKey && (active === first || outside)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && (active === last || outside)) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, onOpenChange]);

	return (
		<div
			ref={overlayRef}
			// 顶栏汉堡按钮（mobile-trigger.tsx）用 aria-controls 指向这里
			id="galzy-mobile-menu"
			// styles.css 的入场关键帧依赖 data-open
			data-open={open}
			className={cn(
				"galzy-mobile-overlay fixed inset-0 z-40",
				// 顶部留出 z-50 顶栏的安全区，汉堡按钮始终露在外面可点
				"overflow-y-auto overscroll-contain pt-16 pb-6",
				"bg-background/95 backdrop-blur-xl",
				"transition-opacity duration-200 ease-out",
				open ? "opacity-100" : "opacity-0 pointer-events-none",
			)}
			role="dialog"
			aria-modal="true"
			aria-label="主导航"
			// open=false 时整棵子树退出可访问树与 Tab 序列（覆盖层不卸载）。
			// 只用 inert：它本身就会把子树移出可访问树，再加 aria-hidden 会在
			// 关闭瞬间「有焦点后代」而触发 Chrome 的 aria-hidden 警告。
			inert={!open}
			onClick={(event) => {
				// 点空白处收起，符合全屏菜单的直觉；行内点击的 target 不是容器本身，
				// 因此不会重复触发关闭
				if (event.target === event.currentTarget) onOpenChange(false);
			}}
		>
			<nav className="flex flex-col gap-0.5 px-4 mx-auto w-full max-w-md">
				{/* 主菜单顺序：mobilePrimaryKeys（主站→OpList→防失联→标签→会社→
            合集→论坛→联系），与桌面端导航同一份数据源 */}
				{mobilePrimaryKeys.map((key, index) => (
					<NavRow
						key={key}
						item={navItem(key)}
						index={index}
						open={open}
						onSelect={dismissByNavigation}
						rowRef={index === 0 ? firstRowRef : undefined}
						showDescription={showDescriptions}
					/>
				))}

				<div className="mx-2 my-1.5 h-px bg-border" />
				<p
					className={cn(
						"px-2.5 pt-1 pb-1 text-[10px] font-semibold tracking-wider",
						"text-muted-foreground uppercase",
					)}
				>
					工具
				</p>
				{/* 工具分组：toolMenuKeys（所有工具 / 车牌号跳转） */}
				{toolMenuKeys.map((key, index) => (
					<NavRow
						key={key}
						item={navItem(key)}
						index={mobilePrimaryKeys.length + index}
						open={open}
						onSelect={dismissByNavigation}
						showDescription={showDescriptions}
					/>
				))}

			</nav>

			{/* 折叠说明 + 关闭提示合并为一行，少占一屏高度 */}
			<div className="flex gap-2 justify-center items-center mt-2 text-[11px] text-muted-foreground">
				<button
					type="button"
					aria-pressed={showDescriptions}
					onClick={() => setShowDescriptions((value) => !value)}
					className="inline-flex gap-1 items-center px-2 min-h-8 rounded-lg transition-colors duration-200 hover:text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
				>
					<Info className="size-3.5" aria-hidden="true" />
					{showDescriptions ? "收起说明" : "显示说明"}
				</button>
				<span aria-hidden="true">·</span>
				<span>Esc 关闭</span>
			</div>
		</div>
	);
}
