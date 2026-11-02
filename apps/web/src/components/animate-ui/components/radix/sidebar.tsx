"use client";

import {
	Sheet,
	SheetPopup,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@web/components/animate-ui/components/radix/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@web/components/animate-ui/components/radix/tooltip";
import {
	MotionHighlight,
	MotionHighlightItem,
} from "@web/components/animate-ui/effects/motion-highlight";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Separator } from "@web/components/ui/separator";
import { Skeleton } from "@web/components/ui/skeleton";
import { useIsMobile } from "@web/hooks/use-mobile";
import { cn } from "@web/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeftIcon } from "lucide-react";
import type { Transition } from "motion/react";
import * as React from "react";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextProps = {
	state: "expanded" | "collapsed";
	open: boolean;
	setOpen: (open: boolean) => void;
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	isMobile: boolean;
	toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
	const context = React.useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider.");
	}

	return context;
}

type SidebarProviderProps = React.ComponentProps<"div"> & {
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

function SidebarProvider({
	defaultOpen = true,
	open: openProp,
	onOpenChange: setOpenProp,
	className,
	style,
	children,
	...props
}: SidebarProviderProps) {
	const isMobile = useIsMobile();
	const [openMobile, setOpenMobile] = React.useState(false);

	// This is the internal state of the sidebar.
	// We use openProp and setOpenProp for control from outside the component.
	const [_open, _setOpen] = React.useState(defaultOpen);
	const open = openProp ?? _open;
	const setOpen = React.useCallback(
		(value: boolean | ((value: boolean) => boolean)) => {
			const openState = typeof value === "function" ? value(open) : value;
			if (setOpenProp) {
				setOpenProp(openState);
			} else {
				_setOpen(openState);
			}

			// This sets the cookie to keep the sidebar state.
			document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
		},
		[setOpenProp, open],
	);

	// Helper to toggle the sidebar.
	const toggleSidebar = React.useCallback(() => {
		return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
	}, [isMobile, setOpen, setOpenMobile]);

	// Adds a keyboard shortcut to toggle the sidebar.
	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
				(event.metaKey || event.ctrlKey)
			) {
				event.preventDefault();
				toggleSidebar();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleSidebar]);

	// We add a state so that we can do data-state="expanded" or "collapsed".
	// This makes it easier to style the sidebar with Tailwind classes.
	const state = open ? "expanded" : "collapsed";

	const contextValue = React.useMemo<SidebarContextProps>(
		() => ({
			state,
			open,
			setOpen,
			isMobile,
			openMobile,
			setOpenMobile,
			toggleSidebar,
		}),
		[state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
	);

	return (
		<SidebarContext.Provider value={contextValue}>
			<TooltipProvider delay={0}>
				<div
					data-slot="sidebar-wrapper"
					style={
						{
							"--sidebar-width": SIDEBAR_WIDTH,
							"--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
							...style,
						} as React.CSSProperties
					}
					className={cn(
						"group/sidebar-wrapper flex w-full min-h-svh has-data-[variant=inset]:bg-sidebar",
						className,
					)}
					{...props}
				>
					{children}
				</div>
			</TooltipProvider>
		</SidebarContext.Provider>
	);
}

type SidebarProps = React.ComponentProps<"div"> & {
	side?: "left" | "right";
	variant?: "sidebar" | "floating" | "inset";
	collapsible?: "offcanvas" | "icon" | "none";
	containerClassName?: string;
	animateOnHover?: boolean;
	transition?: Transition;
};

function Sidebar({
	side = "left",
	variant = "sidebar",
	collapsible = "offcanvas",
	className,
	children,
	animateOnHover = true,
	containerClassName,
	transition = { type: "spring", stiffness: 350, damping: 35 },
	...props
}: SidebarProps) {
	const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

	if (collapsible === "none") {
		return (
			<MotionHighlight
				enabled={animateOnHover}
				hover
				controlledItems
				mode="parent"
				containerClassName={containerClassName}
				transition={transition}
			>
				<div
					data-slot="sidebar"
					className={cn(
						"flex flex-col w-(--sidebar-width) h-full text-sidebar-foreground bg-sidebar",
						className,
					)}
					{...props}
				>
					{children}
				</div>
			</MotionHighlight>
		);
	}

	if (isMobile) {
		return (
			<Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
				<SheetPopup
					data-sidebar="sidebar"
					data-slot="sidebar"
					data-mobile="true"
					className="p-0 w-(--sidebar-width) text-sidebar-foreground bg-sidebar [&>button]:hidden"
					style={
						{
							"--sidebar-width": SIDEBAR_WIDTH_MOBILE,
						} as React.CSSProperties
					}
					side={side}
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Sidebar</SheetTitle>
						<SheetDescription>Displays the mobile sidebar.</SheetDescription>
					</SheetHeader>
					<MotionHighlight
						enabled={animateOnHover}
						hover
						controlledItems
						mode="parent"
						containerClassName={cn("h-full", containerClassName)}
						transition={transition}
					>
						<div className="flex flex-col w-full h-full">{children}</div>
					</MotionHighlight>
				</SheetPopup>
			</Sheet>
		);
	}

	return (
		<div
			className="group peer hidden text-sidebar-foreground md:block"
			data-state={state}
			data-collapsible={state === "collapsed" ? collapsible : ""}
			data-variant={variant}
			data-side={side}
			data-slot="sidebar"
		>
			{/* This is what handles the sidebar gap on desktop */}
			<div
				data-slot="sidebar-gap"
				className={cn(
					"relative w-(--sidebar-width) bg-transparent transition-[width] duration-400 ease-[cubic-bezier(0.7,-0.15,0.25,1.15)]",
					"group-data-[collapsible=offcanvas]:w-0",
					"group-data-[side=right]:rotate-180",
					variant === "floating" || variant === "inset"
						? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
						: "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
				)}
			/>
			<div
				data-slot="sidebar-container"
				className={cn(
					"hidden fixed inset-y-0 z-10 w-(--sidebar-width) h-svh transition-[left,right,width] duration-400 ease-[cubic-bezier(0.75,0,0.25,1)] md:flex",
					side === "left"
						? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
						: "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
					// Adjust the padding for floating and inset variants.
					variant === "floating" || variant === "inset"
						? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
						: "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
					className,
				)}
				{...props}
			>
				<MotionHighlight
					containerClassName={cn("size-full", containerClassName)}
					enabled={animateOnHover}
					hover
					controlledItems
					mode="parent"
					forceUpdateBounds
					transition={transition}
				>
					<div
						data-sidebar="sidebar"
						data-slot="sidebar-inner"
						className="flex flex-col size-full bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
					>
						{children}
					</div>
				</MotionHighlight>
			</div>
		</div>
	);
}

type SidebarTriggerProps = React.ComponentProps<typeof Button>;

function SidebarTrigger({ className, onClick, ...props }: SidebarTriggerProps) {
	const { toggleSidebar } = useSidebar();

	return (
		<Button
			data-sidebar="trigger"
			data-slot="sidebar-trigger"
			variant="ghost"
			size="icon"
			className={cn("size-7", className)}
			onClick={(event) => {
				onClick?.(event);
				toggleSidebar();
			}}
			{...props}
		>
			<PanelLeftIcon />
			<span className="sr-only">Toggle Sidebar</span>
		</Button>
	);
}

type SidebarRailProps = React.ComponentProps<"button">;

function SidebarRail({ className, ...props }: SidebarRailProps) {
	const { toggleSidebar } = useSidebar();

	return (
		<button
			data-sidebar="rail"
			data-slot="sidebar-rail"
			aria-label="Toggle Sidebar"
			tabIndex={-1}
			onClick={toggleSidebar}
			title="Toggle Sidebar"
			className={cn(
				"hidden absolute inset-y-0 z-20 w-4 transition-all ease-linear -translate-x-1/2 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
				"in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
				"[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
				"hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
				"[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
				"[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
				className,
			)}
			{...props}
		/>
	);
}

type SidebarInsetProps = React.ComponentProps<"main">;

function SidebarInset({ className, ...props }: SidebarInsetProps) {
	return (
		<main
			data-slot="sidebar-inset"
			className={cn(
				"flex relative flex-col flex-1 w-full bg-background",
				"md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
				className,
			)}
			{...props}
		/>
	);
}

type SidebarInputProps = React.ComponentProps<typeof Input>;

function SidebarInput({ className, ...props }: SidebarInputProps) {
	return (
		<Input
			data-slot="sidebar-input"
			data-sidebar="input"
			className={cn("w-full h-8 bg-background shadow-none", className)}
			{...props}
		/>
	);
}

type SidebarHeaderProps = React.ComponentProps<"div">;

function SidebarHeader({ className, ...props }: SidebarHeaderProps) {
	return (
		<div
			data-slot="sidebar-header"
			data-sidebar="header"
			className={cn("flex flex-col gap-2 p-2", className)}
			{...props}
		/>
	);
}

type SidebarFooterProps = React.ComponentProps<"div">;

function SidebarFooter({ className, ...props }: SidebarFooterProps) {
	return (
		<div
			data-slot="sidebar-footer"
			data-sidebar="footer"
			className={cn("flex flex-col gap-2 p-2", className)}
			{...props}
		/>
	);
}

type SidebarSeparatorProps = React.ComponentProps<typeof Separator>;

function SidebarSeparator({ className, ...props }: SidebarSeparatorProps) {
	return (
		<Separator
			data-slot="sidebar-separator"
			data-sidebar="separator"
			className={cn("mx-2 w-auto bg-sidebar-border", className)}
			{...props}
		/>
	);
}

type SidebarContentProps = React.ComponentProps<"div">;

function SidebarContent({ className, ...props }: SidebarContentProps) {
	return (
		<div
			data-slot="sidebar-content"
			data-sidebar="content"
			className={cn(
				"flex overflow-auto flex-col flex-1 gap-2 min-h-0 group-data-[collapsible=icon]:overflow-hidden",
				className,
			)}
			{...props}
		/>
	);
}

type SidebarGroupProps = React.ComponentProps<"div">;

function SidebarGroup({ className, ...props }: SidebarGroupProps) {
	return (
		<div
			data-slot="sidebar-group"
			data-sidebar="group"
			className={cn("flex relative flex-col p-2 w-full min-w-0", className)}
			{...props}
		/>
	);
}

type SidebarGroupLabelProps = React.ComponentProps<"div">;

function SidebarGroupLabel({ className, ...props }: SidebarGroupLabelProps) {
	return (
		<div
			data-slot="sidebar-group-label"
			data-sidebar="group-label"
			className={cn(
				"flex shrink-0 items-center px-2 h-8 text-xs font-medium text-sidebar-foreground/70 rounded-md outline-hidden ring-sidebar-ring transition-[margin,opacity] duration-300 ease-linear focus-visible:ring-2 [&>svg]:shrink-0 [&>svg]:size-4",
				"group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
				className,
			)}
			{...props}
		/>
	);
}

type SidebarGroupActionProps = React.ComponentProps<"button">;

function SidebarGroupAction({ className, ...props }: SidebarGroupActionProps) {
	return (
		<button
			data-slot="sidebar-group-action"
			data-sidebar="group-action"
			className={cn(
				"flex absolute top-3.5 right-3 aspect-square justify-center items-center p-0 w-5 text-sidebar-foreground rounded-md outline-hidden ring-sidebar-ring transition-transform hover:text-sidebar-accent-foreground hover:bg-sidebar-accent focus-visible:ring-2 [&>svg]:shrink-0 [&>svg]:size-4",
				// Increases the hit area of the button on mobile.
				"after:absolute after:-inset-2 md:after:hidden",
				"group-data-[collapsible=icon]:hidden",
				className,
			)}
			{...props}
		/>
	);
}

type SidebarGroupContentProps = React.ComponentProps<"div">;

function SidebarGroupContent({
	className,
	...props
}: SidebarGroupContentProps) {
	return (
		<div
			data-slot="sidebar-group-content"
			data-sidebar="group-content"
			className={cn("w-full text-sm", className)}
			{...props}
		/>
	);
}

type SidebarMenuProps = React.ComponentProps<"ul">;

function SidebarMenu({ className, ...props }: SidebarMenuProps) {
	return (
		<ul
			data-slot="sidebar-menu"
			data-sidebar="menu"
			className={cn("flex flex-col gap-1 w-full min-w-0", className)}
			{...props}
		/>
	);
}

type SidebarMenuItemProps = React.ComponentProps<"li">;

function SidebarMenuItem({ className, ...props }: SidebarMenuItemProps) {
	return (
		<li
			data-slot="sidebar-menu-item"
			data-sidebar="menu-item"
			className={cn("group/menu-item relative", className)}
			{...props}
		/>
	);
}

const sidebarMenuButtonActiveVariants = cva(
	"text-sidebar-accent-foreground bg-sidebar-accent rounded-md",
	{
		variants: {
			variant: {
				default: "text-sidebar-accent-foreground bg-sidebar-accent",
				outline:
					"text-sidebar-accent-foreground bg-sidebar-accent shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

const sidebarMenuButtonVariants = cva(
	"peer/menu-button flex overflow-hidden gap-2 items-center p-2 w-full text-sm text-left rounded-md outline-hidden ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 active:text-sidebar-accent-foreground active:bg-sidebar-accent disabled:opacity-50 disabled:pointer-events-none group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:size-8! group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:opacity-50 aria-disabled:pointer-events-none data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent [&>span:last-child]:truncate [&>svg]:shrink-0 [&>svg]:size-4 [&:not([data-highlight])]:hover:text-sidebar-accent-foreground [&:not([data-highlight])]:hover:bg-sidebar-accent [&:not([data-highlight])]:data-[state=open]:hover:text-sidebar-accent-foreground [&:not([data-highlight])]:data-[state=open]:hover:bg-sidebar-accent",
	{
		variants: {
			variant: {
				default:
					"[&:not([data-highlight])]:hover:text-sidebar-accent-foreground [&:not([data-highlight])]:hover:bg-sidebar-accent",
				outline:
					"bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] [&:not([data-highlight])]:hover:text-sidebar-accent-foreground [&:not([data-highlight])]:hover:bg-sidebar-accent [&:not([data-highlight])]:hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
			},
			size: {
				default: "h-8 text-sm",
				sm: "h-7 text-xs",
				lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type SidebarMenuButtonProps = React.ComponentProps<"button"> & {
	isActive?: boolean;
	tooltip?: string | React.ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>;

function SidebarMenuButton({
	isActive = false,
	variant = "default",
	size = "default",
	tooltip,
	className,
	...props
}: SidebarMenuButtonProps) {
	const { isMobile, state } = useSidebar();

	const button = (
		<MotionHighlightItem
			activeClassName={sidebarMenuButtonActiveVariants({ variant })}
		>
			<button
				data-slot="sidebar-menu-button"
				data-sidebar="menu-button"
				data-size={size}
				data-active={isActive}
				className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
				{...props}
			/>
		</MotionHighlightItem>
	);

	if (!tooltip) {
		return button;
	}

	if (typeof tooltip === "string") {
		tooltip = {
			children: tooltip,
		};
	}

	return (
		<Tooltip>
			<TooltipTrigger render={button} />
			<TooltipContent
				side="right"
				align="center"
				hidden={state !== "collapsed" || isMobile}
				{...tooltip}
			/>
		</Tooltip>
	);
}

type SidebarMenuActionProps = React.ComponentProps<"button"> & {
	showOnHover?: boolean;
};

function SidebarMenuAction({
	className,
	showOnHover = false,
	...props
}: SidebarMenuActionProps) {
	return (
		<button
			data-slot="sidebar-menu-action"
			data-sidebar="menu-action"
			className={cn(
				// Increases the hit area of the button on mobile.
				"flex absolute top-1.5 right-1 z-[1] aspect-square justify-center items-center p-0 w-5 text-sidebar-foreground rounded-md outline-hidden ring-sidebar-ring transition-transform hover:text-sidebar-accent-foreground hover:bg-sidebar-accent focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:shrink-0 [&>svg]:size-4",
				"after:absolute after:-inset-2 md:after:hidden",
				"peer-data-[size=sm]/menu-button:top-1",
				"peer-data-[size=default]/menu-button:top-1.5",
				"peer-data-[size=lg]/menu-button:top-2.5",
				"group-data-[collapsible=icon]:hidden",
				showOnHover &&
					"group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground data-[state=open]:opacity-100 md:opacity-0",
				className,
			)}
			{...props}
		/>
	);
}

type SidebarMenuBadgeProps = React.ComponentProps<"div">;

function SidebarMenuBadge({ className, ...props }: SidebarMenuBadgeProps) {
	return (
		<div
			data-slot="sidebar-menu-badge"
			data-sidebar="menu-badge"
			className={cn(
				"flex absolute right-1 justify-center items-center px-1 min-w-5 h-5 text-xs font-medium tabular-nums text-sidebar-foreground rounded-md pointer-events-none select-none",
				"peer-data-[active=true]/menu-button:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground",
				"peer-data-[size=sm]/menu-button:top-1",
				"peer-data-[size=default]/menu-button:top-1.5",
				"peer-data-[size=lg]/menu-button:top-2.5",
				"group-data-[collapsible=icon]:hidden",
				className,
			)}
			{...props}
		/>
	);
}

type SidebarMenuSkeletonProps = React.ComponentProps<"div"> & {
	showIcon?: boolean;
};

function SidebarMenuSkeleton({
	className,
	showIcon = false,
	...props
}: SidebarMenuSkeletonProps) {
	// Random width between 50 to 90%.
	const width = React.useMemo(() => {
		return `${Math.floor(Math.random() * 40) + 50}%`;
	}, []);

	return (
		<div
			data-slot="sidebar-menu-skeleton"
			data-sidebar="menu-skeleton"
			className={cn("flex gap-2 items-center px-2 h-8 rounded-md", className)}
			{...props}
		>
			{showIcon && (
				<Skeleton
					className="size-4 rounded-md"
					data-sidebar="menu-skeleton-icon"
				/>
			)}
			<Skeleton
				className="flex-1 max-w-(--skeleton-width) h-4"
				data-sidebar="menu-skeleton-text"
				style={
					{
						"--skeleton-width": width,
					} as React.CSSProperties
				}
			/>
		</div>
	);
}

type SidebarMenuSubProps = React.ComponentProps<"ul">;

function SidebarMenuSub({ className, ...props }: SidebarMenuSubProps) {
	return (
		<ul
			data-slot="sidebar-menu-sub"
			data-sidebar="menu-sub"
			className={cn(
				"flex flex-col gap-1 px-2.5 py-0.5 mx-3.5 min-w-0 border-l border-sidebar-border translate-x-px",
				"group-data-[collapsible=icon]:hidden",
				className,
			)}
			{...props}
		/>
	);
}

type SidebarMenuSubItemProps = React.ComponentProps<"li">;

function SidebarMenuSubItem({ className, ...props }: SidebarMenuSubItemProps) {
	return (
		<li
			data-slot="sidebar-menu-sub-item"
			data-sidebar="menu-sub-item"
			className={cn("group/menu-sub-item relative", className)}
			{...props}
		/>
	);
}

type SidebarMenuSubButtonProps = React.ComponentProps<"a"> & {
	size?: "sm" | "md";
	isActive?: boolean;
};

function SidebarMenuSubButton({
	size = "md",
	isActive = false,
	className,
	...props
}: SidebarMenuSubButtonProps) {
	return (
		<MotionHighlightItem activeClassName="text-sidebar-accent-foreground bg-sidebar-accent rounded-md">
			<a
				data-slot="sidebar-menu-sub-button"
				data-sidebar="menu-sub-button"
				data-size={size}
				data-active={isActive}
				className={cn(
					"flex overflow-hidden gap-2 items-center px-2 min-w-0 h-7 text-sidebar-foreground rounded-md outline-hidden ring-sidebar-ring -translate-x-px focus-visible:ring-2 active:text-sidebar-accent-foreground active:bg-sidebar-accent disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none [&>span:last-child]:truncate [&>svg]:shrink-0 [&>svg]:size-4 [&>svg]:text-sidebar-accent-foreground [&:not([data-highlight])]:hover:text-sidebar-accent-foreground [&:not([data-highlight])]:hover:bg-sidebar-accent",
					"data-[active=true]:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent",
					size === "sm" && "text-xs",
					size === "md" && "text-sm",
					"group-data-[collapsible=icon]:hidden",
					className,
				)}
				{...props}
			/>
		</MotionHighlightItem>
	);
}

export {
	Sidebar,
	SidebarContent,
	type SidebarContentProps,
	SidebarFooter,
	type SidebarFooterProps,
	SidebarGroup,
	SidebarGroupAction,
	type SidebarGroupActionProps,
	SidebarGroupContent,
	type SidebarGroupContentProps,
	SidebarGroupLabel,
	type SidebarGroupLabelProps,
	type SidebarGroupProps,
	SidebarHeader,
	type SidebarHeaderProps,
	SidebarInput,
	type SidebarInputProps,
	SidebarInset,
	type SidebarInsetProps,
	SidebarMenu,
	SidebarMenuAction,
	type SidebarMenuActionProps,
	SidebarMenuBadge,
	type SidebarMenuBadgeProps,
	SidebarMenuButton,
	type SidebarMenuButtonProps,
	SidebarMenuItem,
	type SidebarMenuItemProps,
	type SidebarMenuProps,
	SidebarMenuSkeleton,
	type SidebarMenuSkeletonProps,
	SidebarMenuSub,
	SidebarMenuSubButton,
	type SidebarMenuSubButtonProps,
	SidebarMenuSubItem,
	type SidebarMenuSubItemProps,
	type SidebarMenuSubProps,
	type SidebarProps,
	SidebarProvider,
	type SidebarProviderProps,
	SidebarRail,
	type SidebarRailProps,
	SidebarSeparator,
	type SidebarSeparatorProps,
	SidebarTrigger,
	type SidebarTriggerProps,
	useSidebar,
};
