"use client";

import { cn } from "@web/lib/utils";
import { motion, type Transition } from "motion/react";
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

const MotionProgressIndicator = motion.create(ProgressPrimitive.Indicator);

type ProgressProps = ProgressPrimitive.Root.Props & {
	transition?: Transition;
};

function Progress({
	className,
	value,
	transition = { type: "spring", stiffness: 100, damping: 30 },
	...props
}: ProgressProps) {
	return (
		<ProgressPrimitive.Root
			data-slot="progress"
			className={cn(
				"overflow-hidden relative w-full h-2 bg-secondary rounded-full",
				className,
			)}
			value={value}
			{...props}
		>
			<MotionProgressIndicator
				data-slot="progress-indicator"
				className="flex-1 w-full h-full bg-primary rounded-full"
				animate={{ translateX: `-${100 - (value || 0)}%` }}
				transition={transition}
			/>
		</ProgressPrimitive.Root>
	);
}

export { Progress, type ProgressProps };
