import { Tooltip, TooltipContent } from "@web/components/ui/tooltip";
import type { ComponentProps } from "react";

/**
 * 标签列表 / 标签流里专用的提示气泡。
 *
 * 标签行排得很密，气泡（默认开在触发元素上方、z-50）必然会盖住相邻那一行。
 * Base UI 默认允许指针停留在气泡上，并借此让气泡保持打开，于是「点相邻那一行的
 * 标签」会先落到气泡上：标签点不动，气泡还一直挂着不走。
 *
 * 所以这里统一两件事：
 * - `disableHoverablePopup`：指针一离开触发元素就关，不靠悬停气泡续命；
 * - 气泡外层 Positioner 加 `pointer-events-none`：整块气泡不接收指针事件，
 *   悬停 / 点击直接穿到下面的标签行。
 *
 * 代价是气泡内容不能再交互 —— 标签气泡只有文字，用不到交互。
 */
export function TagTooltip({
	children,
	...props
}: ComponentProps<typeof Tooltip>) {
	return (
		<Tooltip disableHoverablePopup {...props}>
			{children}
		</Tooltip>
	);
}

export function TagTooltipContent({
	...props
}: ComponentProps<typeof TooltipContent>) {
	return (
		<TooltipContent positionerClassName="pointer-events-none" {...props} />
	);
}
