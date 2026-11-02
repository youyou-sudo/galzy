"use client";

import { useControlledState } from "@web/hooks/use-controlled-state";
import { getStrictContext } from "@web/lib/get-strict-context";
import { AnimatePresence, type HTMLMotionProps, motion } from "motion/react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type * as React from "react";

type DialogContextType = {
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
};

const [DialogProvider, useDialog] =
	getStrictContext<DialogContextType>("DialogContext");

type DialogProps = DialogPrimitive.Root.Props;

function Dialog(props: DialogProps) {
	const [isOpen, setIsOpen] = useControlledState({
		value: props?.open,
		defaultValue: props?.defaultOpen,
		onChange: props?.onOpenChange,
	});

	return (
		<DialogProvider
			value={{
				isOpen,
				setIsOpen: setIsOpen as unknown as (isOpen: boolean) => void,
			}}
		>
			<DialogPrimitive.Root
				data-slot="dialog"
				{...props}
				onOpenChange={(next, details) => setIsOpen(next, details)}
			/>
		</DialogProvider>
	);
}

type DialogTriggerProps = DialogPrimitive.Trigger.Props;

function DialogTrigger(props: DialogTriggerProps) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

type DialogPortalProps = Omit<
	React.ComponentProps<typeof DialogPrimitive.Portal>,
	"forceMount"
>;

function DialogPortal(props: DialogPortalProps) {
	const { isOpen } = useDialog();

	return (
		<AnimatePresence>
			{isOpen && (
				<DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
			)}
		</AnimatePresence>
	);
}

type DialogOverlayProps = Omit<
	DialogPrimitive.Backdrop.Props,
	"forceMount" | "asChild"
> &
	HTMLMotionProps<"div">;

function DialogOverlay({
	transition = { duration: 0.2, ease: "easeInOut" },
	...props
}: DialogOverlayProps) {
	return (
		<DialogPrimitive.Backdrop
			data-slot="dialog-overlay"
			render={
				<motion.div
					key="dialog-overlay"
					initial={{ opacity: 0, filter: "blur(4px)" }}
					animate={{ opacity: 1, filter: "blur(0px)" }}
					exit={{ opacity: 0, filter: "blur(4px)" }}
					transition={transition}
					{...props}
				/>
			}
		/>
	);
}

type DialogFlipDirection = "top" | "bottom" | "left" | "right";

type DialogContentProps = Omit<
	DialogPrimitive.Popup.Props,
	"forceMount" | "asChild"
> &
	HTMLMotionProps<"div"> & {
		from?: DialogFlipDirection;
		/** @deprecated Radix-specific, no-op in Base UI */
		onOpenAutoFocus?: (e: Event) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		onCloseAutoFocus?: (e: Event) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		onEscapeKeyDown?: (e: KeyboardEvent) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		onPointerDownOutside?: (e: CustomEvent) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		onInteractOutside?: (e: CustomEvent) => void;
	};

function DialogContent({
	from = "top",
	onOpenAutoFocus: _onOpenAutoFocus,
	onCloseAutoFocus: _onCloseAutoFocus,
	onEscapeKeyDown: _onEscapeKeyDown,
	onPointerDownOutside: _onPointerDownOutside,
	onInteractOutside: _onInteractOutside,
	transition = { type: "spring", stiffness: 150, damping: 25 },
	children,
	...props
}: DialogContentProps) {
	const initialRotation =
		from === "bottom" || from === "left" ? "20deg" : "-20deg";
	const isVertical = from === "top" || from === "bottom";
	const rotateAxis = isVertical ? "rotateX" : "rotateY";

	return (
		<DialogPrimitive.Popup
			render={
				<motion.div
					key="dialog-content"
					data-slot="dialog-content"
					initial={{
						opacity: 0,
						filter: "blur(4px)",
						transform: `perspective(500px) ${rotateAxis}(${initialRotation}) scale(0.8)`,
					}}
					animate={{
						opacity: 1,
						filter: "blur(0px)",
						transform: `perspective(500px) ${rotateAxis}(0deg) scale(1)`,
					}}
					exit={{
						opacity: 0,
						filter: "blur(4px)",
						transform: `perspective(500px) ${rotateAxis}(${initialRotation}) scale(0.8)`,
					}}
					transition={transition}
					{...props}
				/>
			}
		>
			{children}
		</DialogPrimitive.Popup>
	);
}

type DialogCloseProps = DialogPrimitive.Close.Props;

function DialogClose(props: DialogCloseProps) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

type DialogHeaderProps = React.ComponentProps<"div">;

function DialogHeader(props: DialogHeaderProps) {
	return <div data-slot="dialog-header" {...props} />;
}

type DialogFooterProps = React.ComponentProps<"div">;

function DialogFooter(props: DialogFooterProps) {
	return <div data-slot="dialog-footer" {...props} />;
}

type DialogTitleProps = DialogPrimitive.Title.Props;

function DialogTitle(props: DialogTitleProps) {
	return <DialogPrimitive.Title data-slot="dialog-title" {...props} />;
}

type DialogDescriptionProps = DialogPrimitive.Description.Props;

function DialogDescription(props: DialogDescriptionProps) {
	return (
		<DialogPrimitive.Description data-slot="dialog-description" {...props} />
	);
}

export {
	Dialog,
	DialogPortal,
	DialogOverlay,
	DialogClose,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription,
	useDialog,
	type DialogProps,
	type DialogTriggerProps,
	type DialogPortalProps,
	type DialogCloseProps,
	type DialogOverlayProps,
	type DialogContentProps,
	type DialogHeaderProps,
	type DialogFooterProps,
	type DialogTitleProps,
	type DialogDescriptionProps,
	type DialogContextType,
	type DialogFlipDirection,
};
