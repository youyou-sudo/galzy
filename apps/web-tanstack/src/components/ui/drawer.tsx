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
				"[--backdrop-opacity:0.4] fixed inset-0 z-50 bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
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
				"fixed inset-0 z-50 flex items-end justify-center",
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
						"relative flex max-h-[85dvh] w-full flex-col overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-popover text-sm text-popover-foreground shadow-lg outline-none touch-auto [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-200 ease-in-out data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] sm:max-w-lg sm:rounded-2xl sm:border",
						className,
					)}
					{...props}
				>
					{showGrabBar && (
						<div
							data-slot="drawer-grab-bar"
							aria-hidden
							className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted"
						/>
					)}
					{children}
					{showCloseButton && (
						<DrawerPrimitive.Close
							data-slot="drawer-close"
							className="absolute top-3 right-3 rounded-xs p-1.5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
			className={cn("mt-auto flex flex-col gap-2 p-4", className)}
			{...props}
		/>
	);
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
	return (
		<DrawerPrimitive.Title
			data-slot="drawer-title"
			className={cn(
				"font-heading text-base font-medium text-foreground",
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
