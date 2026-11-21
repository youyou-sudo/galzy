import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@web/lib/utils";
import type { ReactNode } from "react";

/** 节点卡外观。两张图的栅格不同，尺寸/定位一律由调用方的 style 决定。 */
export type GraphNodeCardProps = useRender.ComponentProps<"div"> & {
	/** 节点文字：单行、居中、超出截断 */
	label: ReactNode;
	/** 行首图标（攻略流程图的起点/存档/结局/回收） */
	icon?: ReactNode;
	/**
	 * 语义配色类（起点、结局、回收…）。组件只提供卡底 + 发丝边的默认值，
	 * 具体色调用调用方的类名覆盖，避免节点组件里再长出一张配色表。
	 */
	tone?: string;
	/** 站点卡（圆角矩形）或端点的药丸（攻略图里的起点/结局） */
	shape?: "card" | "pill";
	/** 当前：primary 实底 + 反白 + 柔光环（标签层级图里的当前标签） */
	current?: boolean;
	/** 选中：primary 边 + 柔光环（流程图里选中边的两端） */
	selected?: boolean;
	/** 悬停：浅光环。由 JS 驱动的 hover 用，CSS hover 由调用方的类名负责 */
	hovered?: boolean;
	/** 弱化：虚线边 + 更淡的文字（未本地化祖先 / 回收节点） */
	muted?: boolean;
	/** 压暗：图里处于「非当前路径」的节点 */
	dimmed?: boolean;
	/** 可交互：为 false 时不加 hover 反馈（不可点击的节点） */
	interactive?: boolean;
};

/**
 * 画布节点卡：标签层级关系图与攻略流程图共用的「站点卡」。
 *
 * 两张图的版面各自算坐标（标签图是祖先链 + 子标签卡片，攻略图是分层流程图），
 * 但节点是同一套语言：固定尺寸、圆角、发丝边、居中截断的文字；只有当前/选中
 * 节点才加柔光环，框一多也不会把阴影叠成黑带。
 *
 * 根元素用 Base UI 的 useRender，调用方可以按语义换掉：标签节点是 Link（点击
 * 进标签详情），攻略节点是 button，不可点击的祖先退化成 div。
 */
export function GraphNodeCard({
	label,
	icon,
	tone,
	shape = "card",
	current = false,
	selected = false,
	hovered = false,
	muted = false,
	dimmed = false,
	interactive = true,
	className,
	render,
	...props
}: GraphNodeCardProps) {
	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(
			{
				className: cn(
					"flex justify-center items-center border font-medium text-xs",
					"transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150",
					"focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
					shape === "pill" ? "rounded-full" : "rounded-lg",
					"border-border/80 bg-card text-foreground",
					tone,
					current
						? "text-primary-foreground bg-primary border-primary/40 ring-[3px] ring-primary/20 shadow-md"
						: cn(
								muted
									? "border-dashed border-border/70 bg-muted/25 text-muted-foreground"
									: interactive && "hover:border-primary/50",
								selected &&
									"border-primary/40 shadow-sm ring-[3px] ring-primary/20",
								hovered &&
									!selected &&
									"border-primary/50 shadow-sm ring-2 ring-primary/15",
								dimmed && "opacity-40",
							),
					className,
				),
				children: icon ? (
					<span className="flex items-center gap-1.5 min-w-0">
						{icon}
						<span className="truncate">{label}</span>
					</span>
				) : (
					<span className="truncate">{label}</span>
				),
			},
			props,
		),
		render,
		state: { slot: "graph-node", current, selected, hovered, muted, dimmed },
	});
}
