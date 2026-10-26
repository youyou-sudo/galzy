import { cn } from "@web/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

/**
 * 图标底片：全站页面头/区块头/空态共用。
 *
 * 视觉契约来自顶栏：小圆角方块 + 极淡主色底 + 单色图标，不做渐变、不加阴影。
 * 语义色只用于状态，不用于普通导航。
 */
const tileSizes = {
	sm: "size-8 rounded-lg",
	md: "size-9 rounded-xl",
	lg: "size-14 rounded-2xl",
} as const;

const iconSizes = {
	sm: "size-4",
	md: "size-4",
	lg: "size-7",
} as const;

const tones = {
	primary: "bg-primary/10 text-primary",
	muted: "bg-muted/60 text-muted-foreground",
	success: "bg-success/10 text-success",
	warning: "bg-warning/10 text-warning",
	info: "bg-info/10 text-info",
	destructive: "bg-destructive/10 text-destructive",
	neutral: "bg-neutral/15 text-muted-foreground",
} as const;

export type IconTileProps = ComponentProps<"span"> & {
	icon: LucideIcon;
	size?: keyof typeof tileSizes;
	tone?: keyof typeof tones;
};

export function IconTile({
	icon: Icon,
	size = "md",
	tone = "primary",
	className,
	...props
}: IconTileProps) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex shrink-0 justify-center items-center",
				tileSizes[size],
				tones[tone],
				className,
			)}
			{...props}
		>
			<Icon className={iconSizes[size]} />
		</span>
	);
}
