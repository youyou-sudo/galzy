"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cn } from "@web/lib/utils";
import { XIcon } from "lucide-react";
import type * as React from "react";

const Drawer = DrawerPrimitive.Root;
const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerClose = DrawerPrimitive.Close;
const DrawerPortal = DrawerPrimitive.Portal;

function DrawerBackdrop({
	className,
	...props
}: DrawerPrimitive.Backdrop.Props) {
	return (
		<DrawerPrimitive.Backdrop
			data-slot="drawer-backdrop"
			className={cn(
				"fixed inset-0 z-50 bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-150 [--backdrop-opacity:0.4] data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
				className,
			)}
			{...props}
		/>
	);
}

function DrawerViewport({
	className,
	...props
}: DrawerPrimitive.Viewport.Props) {
	return (
		<DrawerPrimitive.Viewport
			data-slot="drawer-viewport"
			className={cn(
				"flex fixed inset-0 z-50 justify-center items-end",
				className,
			)}
			{...props}
		/>
	);
}

function DrawerContent({
	className,
	children,
	showGrabBar = true,
	showCloseButton = true,
	...props
}: DrawerPrimitive.Popup.Props & {
	showGrabBar?: boolean;
	showCloseButton?: boolean;
}) {
	return (
		<DrawerPortal>
			<DrawerBackdrop />
			<DrawerViewport>
				<DrawerPrimitive.Popup
					data-slot="drawer-content"
					className={cn(
						"galzy-max-h-85dvh flex overflow-y-auto overscroll-contain relative flex-col w-full text-sm text-popover-foreground bg-popover rounded-t-2xl border-t outline-none shadow-lg transition-transform duration-200 ease-in-out touch-auto [transform:translateY(var(--drawer-swipe-movement-y))] data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] sm:max-w-lg sm:rounded-2xl sm:border",
						className,
					)}
					{...props}
				>
					{showGrabBar && (
						<div
							data-slot="drawer-grab-bar"
							aria-hidden
							className="shrink-0 mx-auto mt-3 w-10 h-1.5 bg-muted rounded-full"
						/>
					)}
					{children}
					{showCloseButton && (
						<DrawerPrimitive.Close
							data-slot="drawer-close"
							className="absolute top-3 right-3 p-1.5 text-muted-foreground rounded-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						>
							<XIcon className="size-4" />
							<span className="sr-only">关闭</span>
						</DrawerPrimitive.Close>
					)}
				</DrawerPrimitive.Popup>
			</DrawerViewport>
		</DrawerPortal>
	);
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="drawer-header"
			className={cn("flex flex-col gap-1.5 p-4", className)}
			{...props}
		/>
	);
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="drawer-footer"
			className={cn("flex flex-col gap-2 p-4 mt-auto", className)}
			{...props}
		/>
	);
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
	return (
		<DrawerPrimitive.Title
			data-slot="drawer-title"
			className={cn(
				"text-base font-medium text-foreground font-heading",
				className,
			)}
			{...props}
		/>
	);
}

function DrawerDescription({
	className,
	...props
}: DrawerPrimitive.Description.Props) {
	return (
		<DrawerPrimitive.Description
			data-slot="drawer-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

export {
	Drawer,
	DrawerBackdrop,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
	DrawerViewport,
};
