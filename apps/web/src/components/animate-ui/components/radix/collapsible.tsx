"use client";

import {
	AnimatePresence,
	type HTMLMotionProps,
	motion,
	type Transition,
} from "motion/react";
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import * as React from "react";

type CollapsibleContextType = {
	isOpen: boolean;
};

const CollapsibleContext = React.createContext<
	CollapsibleContextType | undefined
>(undefined);

const useCollapsible = (): CollapsibleContextType => {
	const context = React.useContext(CollapsibleContext);
	if (!context) {
		throw new Error("useCollapsible must be used within a Collapsible");
	}
	return context;
};

type CollapsibleProps = CollapsiblePrimitive.Root.Props;

function Collapsible({ children, ...props }: CollapsibleProps) {
	const [isOpen, setIsOpen] = React.useState(
		props?.open ?? props?.defaultOpen ?? false,
	);

	React.useEffect(() => {
		if (props?.open !== undefined) setIsOpen(props.open);
	}, [props?.open]);

	const handleOpenChange = React.useCallback(
		(open: boolean) => {
			setIsOpen(open);
			props.onOpenChange?.(open, {} as any);
		},
		[props],
	);

	return (
		<CollapsibleContext.Provider value={{ isOpen }}>
			<CollapsiblePrimitive.Root
				data-slot="collapsible"
				{...props}
				onOpenChange={handleOpenChange}
			>
				{children}
			</CollapsiblePrimitive.Root>
		</CollapsibleContext.Provider>
	);
}

type CollapsibleTriggerProps = CollapsiblePrimitive.Trigger.Props;

function CollapsibleTrigger(props: CollapsibleTriggerProps) {
	return (
		<CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
	);
}

type CollapsibleContentProps = CollapsiblePrimitive.Panel.Props &
	HTMLMotionProps<"div"> & {
		transition?: Transition;
	};

function CollapsibleContent({
	className,
	children,
	transition = { type: "spring", stiffness: 150, damping: 22 },
}: CollapsibleContentProps) {
	const { isOpen } = useCollapsible();

	return (
		<AnimatePresence>
			{isOpen && (
				<CollapsiblePrimitive.Panel
					keepMounted
					render={(renderProps: any) => (
						<motion.div
							{...renderProps}
							key="collapsible-content"
							data-slot="collapsible-content"
							layout
							initial={{ opacity: 0, height: 0, overflow: "hidden" }}
							animate={{ opacity: 1, height: "auto", overflow: "hidden" }}
							exit={{ opacity: 0, height: 0, overflow: "hidden" }}
							transition={transition}
							className={className}
						>
							{children}
						</motion.div>
					)}
				/>
			)}
		</AnimatePresence>
	);
}

export {
	Collapsible,
	CollapsibleTrigger,
	CollapsibleContent,
	useCollapsible,
	type CollapsibleContextType,
	type CollapsibleProps,
	type CollapsibleTriggerProps,
	type CollapsibleContentProps,
};
