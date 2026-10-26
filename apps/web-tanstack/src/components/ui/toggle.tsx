import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@web/lib/utils";

const toggleVariants = cva(
	"group/toggle inline-flex gap-1 justify-center items-center text-sm font-medium whitespace-nowrap rounded-lg outline-none transition-[color,background-color,border-color,box-shadow] hover:text-foreground hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				outline: "bg-transparent border border-input hover:bg-muted",
			},
			size: {
				default:
					"px-2.5 min-w-8 h-8 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				sm: "px-2.5 min-w-7 h-7 text-[0.8rem] rounded-[min(var(--radius-md),12px)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
				lg: "px-2.5 min-w-9 h-9 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Toggle({
	className,
	variant = "default",
	size = "default",
	...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
	return (
		<TogglePrimitive
			data-slot="toggle"
			className={cn(toggleVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Toggle, toggleVariants };
