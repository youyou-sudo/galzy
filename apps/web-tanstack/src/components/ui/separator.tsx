import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "@web/lib/utils";

function Separator({
	className,
	orientation = "horizontal",
	...props
}: SeparatorPrimitive.Props) {
	return (
		<SeparatorPrimitive
			data-slot="separator"
			orientation={orientation}
			className={cn(
				"shrink-0 bg-border data-horizontal:w-full data-horizontal:h-px data-vertical:self-stretch data-vertical:w-px",
				className,
			)}
			{...props}
		/>
	);
}

export { Separator };
