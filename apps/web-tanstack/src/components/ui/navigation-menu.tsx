import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { cva } from "class-variance-authority";

import { cn } from "@web/lib/utils";
import { ChevronDownIcon } from "lucide-react";

function NavigationMenu({
	align = "start",
	className,
	children,
	...props
}: NavigationMenuPrimitive.Root.Props &
	Pick<NavigationMenuPrimitive.Positioner.Props, "align">) {
	return (
		<NavigationMenuPrimitive.Root
			data-slot="navigation-menu"
			className={cn(
				"group/navigation-menu flex relative flex-1 justify-center items-center max-w-max",
				className,
			)}
			{...props}
		>
			{children}
			<NavigationMenuPositioner align={align} />
		</NavigationMenuPrimitive.Root>
	);
}

function NavigationMenuList({
	className,
	...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.List>) {
	return (
		<NavigationMenuPrimitive.List
			data-slot="navigation-menu-list"
			className={cn(
				"group flex flex-1 gap-0 justify-center items-center list-none",
				className,
			)}
			{...props}
		/>
	);
}

function NavigationMenuItem({
	className,
	...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.Item>) {
	return (
		<NavigationMenuPrimitive.Item
			data-slot="navigation-menu-item"
			className={cn("relative", className)}
			{...props}
		/>
	);
}

const navigationMenuTriggerStyle = cva(
	"group/navigation-menu-trigger inline-flex justify-center items-center px-2.5 py-1.5 w-max h-9 text-sm font-medium rounded-lg outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-muted focus:bg-muted focus-visible:outline-1 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:pointer-events-none data-open:bg-muted/50 data-popup-open:bg-muted/50 data-open:hover:bg-muted data-popup-open:hover:bg-muted data-open:focus:bg-muted",
);

function NavigationMenuTrigger({
	className,
	children,
	...props
}: NavigationMenuPrimitive.Trigger.Props) {
	return (
		<NavigationMenuPrimitive.Trigger
			data-slot="navigation-menu-trigger"
			className={cn(navigationMenuTriggerStyle(), "group", className)}
			{...props}
		>
			{children}{" "}
			<ChevronDownIcon
				className="relative top-px ml-1 size-3 transition duration-300 group-data-open/navigation-menu-trigger:rotate-180 group-data-popup-open/navigation-menu-trigger:rotate-180"
				aria-hidden="true"
			/>
		</NavigationMenuPrimitive.Trigger>
	);
}

function NavigationMenuContent({
	className,
	...props
}: NavigationMenuPrimitive.Content.Props) {
	return (
		<NavigationMenuPrimitive.Content
			data-slot="navigation-menu-content"
			className={cn(
				"p-1 w-auto h-full transition-[opacity,transform,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] **:data-[slot=navigation-menu-link]:focus:outline-none **:data-[slot=navigation-menu-link]:focus:ring-0 group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:rounded-xl group-data-[viewport=false]/navigation-menu:ring-1 group-data-[viewport=false]/navigation-menu:ring-border/60 group-data-[viewport=false]/navigation-menu:shadow group-data-[viewport=false]/navigation-menu:duration-300 group-data-[viewport=false]/navigation-menu:data-closed:animate-out group-data-[viewport=false]/navigation-menu:data-closed:fade-out-0 group-data-[viewport=false]/navigation-menu:data-closed:zoom-out-95 group-data-[viewport=false]/navigation-menu:data-open:animate-in group-data-[viewport=false]/navigation-menu:data-open:fade-in-0 group-data-[viewport=false]/navigation-menu:data-open:zoom-in-95 data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 data-[motion^=from-]:animate-in data-[motion^=from-]:fade-in data-[motion^=to-]:animate-out data-[motion^=to-]:fade-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:data-activation-direction=left:translate-x-[50%] data-ending-style:data-activation-direction=right:translate-x-[-50%] data-starting-style:data-activation-direction=left:translate-x-[-50%] data-starting-style:data-activation-direction=right:translate-x-[50%]",
				className,
			)}
			{...props}
		/>
	);
}

function NavigationMenuPositioner({
	className,
	side = "bottom",
	sideOffset = 8,
	align = "start",
	alignOffset = 0,
	...props
}: NavigationMenuPrimitive.Positioner.Props) {
	return (
		<NavigationMenuPrimitive.Portal>
			<NavigationMenuPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				className={cn(
					"isolate z-50 w-(--positioner-width) max-w-(--available-width) h-(--positioner-height) transition-[top,left,right,bottom] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0",
					className,
				)}
				{...props}
			>
				<NavigationMenuPrimitive.Popup className="relative w-(--popup-width) h-(--popup-height) text-popover-foreground bg-popover rounded-xl outline-none ring-1 ring-foreground/10 shadow transition-[opacity,transform,width,height,scale,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] origin-(--transform-origin) data-[ending-style]:easing-[ease] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:scale-90 data-starting-style:opacity-0 data-starting-style:scale-90 xs:w-(--popup-width)">
					<NavigationMenuPrimitive.Viewport className="overflow-hidden relative size-full" />
				</NavigationMenuPrimitive.Popup>
			</NavigationMenuPrimitive.Positioner>
		</NavigationMenuPrimitive.Portal>
	);
}

function NavigationMenuLink({
	className,
	...props
}: NavigationMenuPrimitive.Link.Props) {
	return (
		<NavigationMenuPrimitive.Link
			data-slot="navigation-menu-link"
			className={cn(
				"flex gap-2 items-center p-2 text-sm rounded-lg outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-muted focus:bg-muted focus-visible:outline-1 focus-visible:ring-2 focus-visible:ring-ring/50 in-data-[slot=navigation-menu-content]:rounded-md data-active:bg-muted/50 data-active:hover:bg-muted data-active:focus:bg-muted [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function NavigationMenuIndicator({
	className,
	...props
}: React.ComponentPropsWithRef<typeof NavigationMenuPrimitive.Icon>) {
	return (
		<NavigationMenuPrimitive.Icon
			data-slot="navigation-menu-indicator"
			className={cn(
				"flex overflow-hidden top-full z-1 justify-center items-end h-1.5 data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:animate-in data-[state=visible]:fade-in",
				className,
			)}
			{...props}
		>
			<div className="relative top-[60%] w-2 h-2 bg-border rounded-tl-sm shadow-md rotate-45" />
		</NavigationMenuPrimitive.Icon>
	);
}

export {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuIndicator,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
	NavigationMenuPositioner,
};
