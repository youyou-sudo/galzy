import { cn } from "@web/lib/utils";

function AspectRatio({
	ratio,
	className,
	style,
	ref,
	...props
}: React.ComponentProps<"div"> & { ratio: number }) {
	return (
		<div
			ref={ref}
			data-slot="aspect-ratio"
			style={{ "--ratio": ratio, ...style } as React.CSSProperties}
			className={cn("relative aspect-(--ratio)", className)}
			{...props}
		/>
	);
}

export { AspectRatio };
