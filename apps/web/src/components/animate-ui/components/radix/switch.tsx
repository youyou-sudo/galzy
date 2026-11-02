"use client";

import { cn } from "@web/lib/utils";
import { type HTMLMotionProps, motion } from "motion/react";
import { Switch as SwitchPrimitives } from "@base-ui/react/switch";
import * as React from "react";

type SwitchProps = SwitchPrimitives.Root.Props &
	HTMLMotionProps<"button"> & {
		leftIcon?: React.ReactNode;
		rightIcon?: React.ReactNode;
		thumbIcon?: React.ReactNode;
	};

function Switch({
	className,
	leftIcon,
	rightIcon,
	thumbIcon,
	onCheckedChange,
	...props
}: SwitchProps) {
	const [isChecked, setIsChecked] = React.useState(
		props?.checked ?? props?.defaultChecked ?? false,
	);
	const [isTapped, setIsTapped] = React.useState(false);

	React.useEffect(() => {
		if (props?.checked !== undefined) setIsChecked(props.checked);
	}, [props?.checked]);

	const handleCheckedChange = React.useCallback(
		(checked: boolean) => {
			setIsChecked(checked);
			onCheckedChange?.(checked, {} as any);
		},
		[onCheckedChange],
	);

	return (
		<SwitchPrimitives.Root
			{...(props as any)}
			onCheckedChange={handleCheckedChange}
			render={(renderProps: any) => (
				<motion.button
					{...renderProps}
					data-slot="switch"
					className={cn(
						"flex relative shrink-0 items-center p-[3px] w-10 h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed data-[state=checked]:justify-end data-[state=checked]:bg-primary data-[state=unchecked]:justify-start data-[state=unchecked]:bg-input",
						className,
					)}
					whileTap="tap"
					initial={false}
					onTapStart={() => setIsTapped(true)}
					onTapCancel={() => setIsTapped(false)}
					onTap={() => setIsTapped(false)}
				>
					{leftIcon && (
						<motion.div
							data-slot="switch-left-icon"
							animate={
								isChecked ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }
							}
							transition={{ type: "spring", bounce: 0 }}
							className="absolute top-1/2 left-1 text-neutral-400 -translate-y-1/2 dark:text-neutral-500 [&_svg]:size-3"
						>
							{typeof leftIcon !== "string" ? leftIcon : null}
						</motion.div>
					)}

					{rightIcon && (
						<motion.div
							data-slot="switch-right-icon"
							animate={
								isChecked ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }
							}
							transition={{ type: "spring", bounce: 0 }}
							className="absolute top-1/2 right-1 text-neutral-500 -translate-y-1/2 dark:text-neutral-400 [&_svg]:size-3"
						>
							{typeof rightIcon !== "string" ? rightIcon : null}
						</motion.div>
					)}

					<SwitchPrimitives.Thumb
						render={(thumbRenderProps: any) => (
							<motion.div
								{...thumbRenderProps}
								data-slot="switch-thumb"
								whileTap="tab"
								className={cn(
									"flex relative z-[1] justify-center items-center text-neutral-500 bg-background rounded-full ring-0 shadow-lg dark:text-neutral-400 [&_svg]:size-3",
								)}
								layout
								transition={{ type: "spring", stiffness: 300, damping: 25 }}
								style={{
									width: 18,
									height: 18,
								}}
								animate={
									isTapped
										? { width: 21, transition: { duration: 0.1 } }
										: { width: 18, transition: { duration: 0.1 } }
								}
							>
								{thumbIcon && typeof thumbIcon !== "string" ? thumbIcon : null}
							</motion.div>
						)}
					/>
				</motion.button>
			)}
		/>
	);
}

export { Switch, type SwitchProps };
