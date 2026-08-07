"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "@web/lib/utils";
import { Circle } from "lucide-react";
import {
	AnimatePresence,
	type HTMLMotionProps,
	motion,
	type Transition,
} from "motion/react";

type RadioGroupProps = RadioGroupPrimitive.Props & {
	transition?: Transition;
};

function RadioGroup({ className, ...props }: RadioGroupProps) {
	return (
		<RadioGroupPrimitive
			data-slot="radio-group"
			className={cn("grid gap-2.5", className)}
			{...props}
		/>
	);
}

type RadioGroupIndicatorProps = RadioPrimitive.Indicator.Props & {
	transition: Transition;
};

function RadioGroupIndicator({
	className,
	transition,
	...props
}: RadioGroupIndicatorProps) {
	return (
		<RadioPrimitive.Indicator
			data-slot="radio-group-indicator"
			className={cn("flex items-center justify-center", className)}
			{...props}
		>
			<AnimatePresence>
				<motion.div
					key="radio-group-indicator-circle"
					data-slot="radio-group-indicator-circle"
					initial={{ opacity: 0, scale: 0 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0 }}
					transition={transition}
				>
					<Circle className="size-3 fill-current text-current" />
				</motion.div>
			</AnimatePresence>
		</RadioPrimitive.Indicator>
	);
}

type RadioGroupItemProps = RadioPrimitive.Root.Props &
	HTMLMotionProps<"button"> & {
		transition?: Transition;
	};

function RadioGroupItem({
	className,
	transition = { type: "spring", stiffness: 200, damping: 16 },
	...props
}: RadioGroupItemProps) {
	return (
		<RadioPrimitive.Root
			render={
				<motion.button
					data-slot="radio-group-item"
					className={cn(
						"aspect-square size-5 rounded-full flex items-center justify-center border border-input text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
				/>
			}
			{...props}
		>
			<RadioGroupIndicator
				data-slot="radio-group-item-indicator"
				transition={transition}
			/>
		</RadioPrimitive.Root>
	);
}

export {
	RadioGroup,
	RadioGroupItem,
	type RadioGroupItemProps,
	type RadioGroupProps,
};
