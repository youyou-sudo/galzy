import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@web/lib/utils";

function Progress({
	className,
	value,
	...props
}: ProgressPrimitive.Root.Props) {
	return (
		<ProgressPrimitive.Root
			data-slot="progress"
			className={cn(
				"overflow-hidden relative w-full h-2 bg-muted rounded-full",
				className,
			)}
			value={value}
			{...props}
		>
			<ProgressPrimitive.Track
				data-slot="progress-track"
				className="w-full h-full"
			>
				<ProgressPrimitive.Indicator
					data-slot="progress-indicator"
					className="flex-1 w-full h-full bg-primary transition-[width]"
				/>
			</ProgressPrimitive.Track>
		</ProgressPrimitive.Root>
	);
}

export { Progress };
