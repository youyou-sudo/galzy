"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@web/lib/utils";

function Tabs({
	className,
	orientation = "horizontal",
	...props
}: TabsPrimitive.Root.Props) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			data-orientation={orientation}
			className={cn(
				"group/tabs flex gap-2 data-horizontal:flex-col",
				className,
			)}
			{...props}
		/>
	);
}

const tabsListVariants = cva(
	"group/tabs-list inline-flex justify-center items-center p-[3px] w-fit text-muted-foreground rounded-lg group-data-horizontal/tabs:h-8 group-data-vertical/tabs:flex-col group-data-vertical/tabs:h-fit data-[variant=line]:rounded-none",
	{
		variants: {
			variant: {
				default: "bg-muted",
				line: "gap-1 bg-transparent",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function TabsList({
	className,
	variant = "default",
	...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			data-variant={variant}
			className={cn(tabsListVariants({ variant }), className)}
			{...props}
		/>
	);
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
	return (
		<TabsPrimitive.Tab
			data-slot="tabs-trigger"
			className={cn(
				"inline-flex relative flex-1 gap-1.5 justify-center items-center px-1.5 py-0.5 h-[calc(100%-1px)] text-sm font-medium text-foreground/60 whitespace-nowrap rounded-md border border-transparent transition-[color,background-color,border-color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:pointer-events-none group-data-vertical/tabs:justify-start group-data-vertical/tabs:w-full group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:opacity-50 aria-disabled:pointer-events-none dark:text-muted-foreground dark:hover:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none",
				"group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent",
				"data-active:text-foreground data-active:bg-background dark:data-active:text-foreground dark:data-active:bg-input/30 dark:data-active:border-input",
				"after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
				className,
			)}
			{...props}
		/>
	);
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
	return (
		<TabsPrimitive.Panel
			data-slot="tabs-content"
			className={cn("flex-1 text-sm outline-none", className)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
