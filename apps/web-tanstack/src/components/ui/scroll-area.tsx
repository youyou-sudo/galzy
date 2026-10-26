"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "@web/lib/utils";

function ScrollArea({
	className,
	children,
	...props
}: ScrollAreaPrimitive.Root.Props) {
	return (
		<ScrollAreaPrimitive.Root
			data-slot="scroll-area"
			className={cn("relative", className)}
			{...props}
		>
			<ScrollAreaPrimitive.Viewport
				data-slot="scroll-area-viewport"
				className="size-full rounded-[inherit] outline-none transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-2 focus-visible:ring-ring/50"
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollBar />
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}

function ScrollBar({
	className,
	orientation = "vertical",
	...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
	return (
		<ScrollAreaPrimitive.Scrollbar
			data-slot="scroll-area-scrollbar"
			data-orientation={orientation}
			orientation={orientation}
			className={cn(
				"flex p-px transition-colors touch-none select-none data-horizontal:flex-col data-horizontal:h-2.5 data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:w-2.5 data-vertical:h-full data-vertical:border-l data-vertical:border-l-transparent",
				className,
			)}
			{...props}
		>
			<ScrollAreaPrimitive.Thumb
				data-slot="scroll-area-thumb"
				className="relative flex-1 bg-border rounded-full"
			/>
		</ScrollAreaPrimitive.Scrollbar>
	);
}

export { ScrollArea, ScrollBar };
