import { Button } from "@web/components/ui/button";
import { useNavigate } from "@web/lib/nav";
import { cn } from "@web/lib/utils";
import { Download } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 「下载」定位按钮 + 文件列表高亮框。
 *
 * 交互（按需求）：
 * - 按钮**在所有页签下都常驻**（下载 / 攻略 / 讨论 / 统计 / 系列）；
 * - 在**下载页签**点击 → 文件列表周围淡入一个大的半透明框，显示 2 秒后自动淡出；
 * - 在**其它页签**点击 → 先切回下载页签，切回来之后再淡入并计时；
 * - 不响应 hover；
 * - 2 秒内按 Esc 或点列表/按钮之外的空白处，可提前淡出。
 *
 * 实现要点：
 * - 高亮框**常驻 DOM**、只切 `opacity`：淡入淡出都是一条 CSS transition，
 *   不需要「等动画播完再卸载」的相位机，也不依赖动画库的 fill-mode；
 * - `pointer-events: none`，永远不拦截列表的点击与悬停；
 * - 只依赖 `react-dom` 的 portal + 原生 `ResizeObserver`，**不引入任何第三方库**；
 * - 高亮框处在**文档坐标**（portal 到 body + absolute），滚动时自动跟随，
 *   不需要 scroll 监听；只在「显示中」才挂 ResizeObserver / resize 监听。
 */

/** 文件列表容器上的锚点属性（挂在页面 tab 内容的外层 div 上） */
export const DOWNLOAD_TARGET_ATTR = "data-download-target";

/** 高亮框展示时长：到点自动淡出。 */
export const SHOW_MS = 2_000;

/** 高亮框相对列表外扩的像素：形成「括号」而不是贴着内容。 */
const SPOTLIGHT_OUTSET = 6;

type SpotlightRect = {
	top: number;
	left: number;
	width: number;
	height: number;
};

function findTarget(): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[${DOWNLOAD_TARGET_ATTR}]`);
}

function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	if (typeof window.matchMedia !== "function") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DownloadSpotlight({
	gameId,
	isDownloadTab,
	className,
}: {
	gameId: string;
	/** 当前是否在下载页签：不在时点击先切回下载页签再高亮 */
	isDownloadTab: boolean;
	className?: string;
}) {
	const navigate = useNavigate();
	/** 当前是否可见（opacity 由它驱动，元素本身常驻） */
	const [shown, setShown] = useState(false);
	/** 点击时不在下载页签：等切回来再高亮 */
	const [pendingShow, setPendingShow] = useState(false);
	/** 仅在客户端挂 portal，避免 SSR 访问 document */
	const [mounted, setMounted] = useState(false);
	const [rect, setRect] = useState<SpotlightRect | null>(null);

	const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const clearHideTimer = useCallback(() => {
		if (hideTimerRef.current === undefined) return;
		clearTimeout(hideTimerRef.current);
		hideTimerRef.current = undefined;
	}, []);

	useEffect(() => {
		setMounted(true);
		return clearHideTimer;
	}, [clearHideTimer]);

	/** 显示 2 秒：连点会刷新计时，并把列表滚进视口 */
	const show = useCallback(() => {
		clearHideTimer();
		setShown(true);
		hideTimerRef.current = setTimeout(() => {
			hideTimerRef.current = undefined;
			setShown(false);
		}, SHOW_MS);

		const target = findTarget();
		if (!target) return;
		const r = target.getBoundingClientRect();
		// 列表已在视口内就别滚，避免页面无谓跳动
		if (r.top >= 0 && r.bottom <= window.innerHeight) return;
		target.scrollIntoView({
			behavior: prefersReducedMotion() ? "auto" : "smooth",
			block: "center",
		});
	}, [clearHideTimer]);

	// 从别的页签点进来：等切回下载页签后再高亮（此时列表 DOM 已就位）
	useEffect(() => {
		if (!pendingShow || !isDownloadTab) return;
		setPendingShow(false);
		show();
	}, [pendingShow, isDownloadTab, show]);

	// 离开下载页签：高亮框只对文件列表有意义，立刻收起
	useEffect(() => {
		if (isDownloadTab) return;
		clearHideTimer();
		setShown(false);
	}, [isDownloadTab, clearHideTimer]);

	// 显示期间测量：存**文档坐标**，配合 portal + absolute，滚动时无需重算。
	// 用 layout effect：在 paint 前完成测量，淡入的第一帧位置就是对的。
	useLayoutEffect(() => {
		if (!shown) return; // 隐藏时保留上次 rect，淡出期间位置不跳
		const target = findTarget();
		if (!target) return;
		const measure = () => {
			const r = target.getBoundingClientRect();
			setRect({
				top: r.top + window.scrollY - SPOTLIGHT_OUTSET,
				left: r.left + window.scrollX - SPOTLIGHT_OUTSET,
				width: r.width + SPOTLIGHT_OUTSET * 2,
				height: r.height + SPOTLIGHT_OUTSET * 2,
			});
		};
		measure();
		// 文件树展开/收起、数据到达都会改变高度，跟着更新。
		// 老 WebView 可能没有 ResizeObserver：缺失时退化为「显示那一刻测一次」，
		// 不能让异常从 layout effect 抛出（会连累整棵详情页子树）。
		const observer =
			typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
		observer?.observe(target);
		// 列表**上方**内容变化（字体切换、顶栏广告图到达）会让整块位移但不改自身尺寸，
		// 顺带观察根元素高度变化，尽量把这类位移也跟上。
		observer?.observe(document.documentElement);
		window.addEventListener("resize", measure);
		return () => {
			observer?.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, [shown]);

	// 显示期间：Esc / 点列表与按钮之外的空白处 → 提前淡出
	useEffect(() => {
		if (!shown) return;
		const hide = () => {
			clearHideTimer();
			setShown(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") hide();
		};
		const onPointerDown = (event: PointerEvent) => {
			const el = event.target as Element | null;
			if (!el) return;
			// 点按钮：交给按钮自己的 onClick（否则「刚点亮又被这里关掉」）
			if (el.closest?.("[data-download-button]")) return;
			// 点列表内部：用户正在操作文件列表，不打扰
			if (findTarget()?.contains(el)) return;
			hide();
		};
		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown, true);
		};
	}, [shown, clearHideTimer]);

	const handleClick = () => {
		if (isDownloadTab) {
			show();
			return;
		}
		// 不在下载页签：先切回去，等 isDownloadTab 变 true 再由上面的 effect 高亮
		setPendingShow(true);
		void navigate({ to: "/:id", params: { id: gameId } });
	};

	return (
		<>
			<Button
				type="button"
				variant="default"
				data-download-button=""
				title="定位到文件列表"
				onClick={handleClick}
				className={cn("w-full gap-1.5", className)}
			>
				<Download aria-hidden="true" />
				下载
			</Button>
			{mounted
				? createPortal(
						// z-30：盖在正文卡片之上、顶栏(50)与弹窗(50)之下；
						// pointer-events-none：绝不拦截列表的点击/悬停
						<div
							aria-hidden="true"
							data-download-spotlight=""
							data-shown={shown ? "" : undefined}
							className="pointer-events-none absolute z-30 rounded-2xl bg-primary/[0.05] ring-2 ring-primary/70 transition-opacity duration-200 ease-out motion-reduce:transition-none"
							style={{
								top: rect?.top ?? 0,
								left: rect?.left ?? 0,
								width: rect?.width ?? 0,
								height: rect?.height ?? 0,
								opacity: shown ? 1 : 0,
							}}
						/>,
						document.body,
					)
				: null}
		</>
	);
}
