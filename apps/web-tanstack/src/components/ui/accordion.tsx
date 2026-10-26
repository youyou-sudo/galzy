import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";

import { cn } from "@web/lib/utils";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
	return (
		<AccordionPrimitive.Root
			data-slot="accordion"
			className={cn("flex flex-col w-full", className)}
			{...props}
		/>
	);
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
	return (
		<AccordionPrimitive.Item
			data-slot="accordion-item"
			className={cn("not-last:border-b", className)}
			{...props}
		/>
	);
}

function AccordionTrigger({
	className,
	children,
	...props
}: AccordionPrimitive.Trigger.Props) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				data-slot="accordion-trigger"
				className={cn(
					"group/accordion-trigger flex relative flex-1 justify-between items-start py-2.5 text-sm font-medium text-left rounded-lg border border-transparent outline-none transition-[color,background-color,border-color,box-shadow,text-decoration-color] **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground hover:underline focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:opacity-50 aria-disabled:pointer-events-none",
					className,
				)}
				{...props}
			>
				{children}
				<ChevronDownIcon
					data-slot="accordion-trigger-icon"
					className="shrink-0 pointer-events-none group-aria-expanded/accordion-trigger:hidden"
				/>
				<ChevronUpIcon
					data-slot="accordion-trigger-icon"
					className="hidden shrink-0 pointer-events-none group-aria-expanded/accordion-trigger:inline"
				/>
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

function AccordionContent({
	className,
	children,
	...props
}: AccordionPrimitive.Panel.Props) {
	return (
		<AccordionPrimitive.Panel
			data-slot="accordion-content"
			className="overflow-hidden text-sm data-closed:animate-accordion-up data-open:animate-accordion-down"
			{...props}
		>
			<div
				className={cn(
					"pt-0 pb-2.5 h-(--accordion-panel-height) data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4 [&_a]:hover:text-foreground",
					className,
				)}
			>
				{children}
			</div>
		</AccordionPrimitive.Panel>
	);
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
