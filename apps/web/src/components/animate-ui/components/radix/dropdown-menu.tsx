import {
	DropdownMenuCheckboxItem as DropdownMenuCheckboxItemPrimitive,
	type DropdownMenuCheckboxItemProps as DropdownMenuCheckboxItemPrimitiveProps,
	DropdownMenuContent as DropdownMenuContentPrimitive,
	type DropdownMenuContentProps as DropdownMenuContentPrimitiveProps,
	DropdownMenuGroup as DropdownMenuGroupPrimitive,
	type DropdownMenuGroupProps as DropdownMenuGroupPrimitiveProps,
	DropdownMenuHighlightItem as DropdownMenuHighlightItemPrimitive,
	DropdownMenuHighlight as DropdownMenuHighlightPrimitive,
	DropdownMenuItemIndicator as DropdownMenuItemIndicatorPrimitive,
	DropdownMenuItem as DropdownMenuItemPrimitive,
	type DropdownMenuItemProps as DropdownMenuItemPrimitiveProps,
	DropdownMenuLabel as DropdownMenuLabelPrimitive,
	type DropdownMenuLabelProps as DropdownMenuLabelPrimitiveProps,
	DropdownMenu as DropdownMenuPrimitive,
	type DropdownMenuProps as DropdownMenuPrimitiveProps,
	DropdownMenuRadioGroup as DropdownMenuRadioGroupPrimitive,
	type DropdownMenuRadioGroupProps as DropdownMenuRadioGroupPrimitiveProps,
	DropdownMenuRadioItem as DropdownMenuRadioItemPrimitive,
	type DropdownMenuRadioItemProps as DropdownMenuRadioItemPrimitiveProps,
	DropdownMenuSeparator as DropdownMenuSeparatorPrimitive,
	type DropdownMenuSeparatorProps as DropdownMenuSeparatorPrimitiveProps,
	DropdownMenuShortcut as DropdownMenuShortcutPrimitive,
	type DropdownMenuShortcutProps as DropdownMenuShortcutPrimitiveProps,
	DropdownMenuSubContent as DropdownMenuSubContentPrimitive,
	type DropdownMenuSubContentProps as DropdownMenuSubContentPrimitiveProps,
	DropdownMenuSub as DropdownMenuSubPrimitive,
	type DropdownMenuSubProps as DropdownMenuSubPrimitiveProps,
	DropdownMenuSubTrigger as DropdownMenuSubTriggerPrimitive,
	type DropdownMenuSubTriggerProps as DropdownMenuSubTriggerPrimitiveProps,
	DropdownMenuTrigger as DropdownMenuTriggerPrimitive,
	type DropdownMenuTriggerProps as DropdownMenuTriggerPrimitiveProps,
} from "@web/components/animate-ui/primitives/radix/dropdown-menu";
import { cn } from "@web/lib/utils";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";

type DropdownMenuProps = DropdownMenuPrimitiveProps;

function DropdownMenu(props: DropdownMenuProps) {
	return <DropdownMenuPrimitive {...props} />;
}

type DropdownMenuTriggerProps = DropdownMenuTriggerPrimitiveProps;

function DropdownMenuTrigger(props: DropdownMenuTriggerProps) {
	return <DropdownMenuTriggerPrimitive {...props} />;
}

type DropdownMenuContentProps = DropdownMenuContentPrimitiveProps;

function DropdownMenuContent({
	sideOffset = 4,
	className,
	children,
	...props
}: DropdownMenuContentProps) {
	return (
		<DropdownMenuContentPrimitive
			sideOffset={sideOffset}
			className={cn(
				"overflow-x-hidden overflow-y-auto z-50 p-1 min-w-[8rem] max-h-(--radix-dropdown-menu-content-available-height) text-popover-foreground bg-popover rounded-md border shadow-md origin-(--radix-dropdown-menu-content-transform-origin)",
				className,
			)}
			{...props}
		>
			<DropdownMenuHighlightPrimitive className="absolute inset-0 z-0 bg-accent rounded-sm">
				{children}
			</DropdownMenuHighlightPrimitive>
		</DropdownMenuContentPrimitive>
	);
}

type DropdownMenuGroupProps = DropdownMenuGroupPrimitiveProps;

function DropdownMenuGroup({ ...props }: DropdownMenuGroupProps) {
	return <DropdownMenuGroupPrimitive {...props} />;
}

type DropdownMenuItemProps = DropdownMenuItemPrimitiveProps & {
	inset?: boolean;
	variant?: "default" | "destructive";
};

function DropdownMenuItem({
	className,
	inset,
	variant = "default",
	disabled,
	...props
}: DropdownMenuItemProps) {
	return (
		<DropdownMenuHighlightItemPrimitive disabled={disabled}>
			<DropdownMenuItemPrimitive
				disabled={disabled}
				data-inset={inset}
				data-variant={variant}
				className={cn(
					"flex relative gap-2 items-center px-2 py-1.5 text-sm rounded-sm outline-hidden cursor-default select-none focus:text-accent-foreground data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:shrink-0 [&_svg]:pointer-events-none",
					className,
				)}
				{...props}
			/>
		</DropdownMenuHighlightItemPrimitive>
	);
}

type DropdownMenuCheckboxItemProps = DropdownMenuCheckboxItemPrimitiveProps;

function DropdownMenuCheckboxItem({
	className,
	children,
	checked,
	disabled,
	...props
}: DropdownMenuCheckboxItemProps) {
	return (
		<DropdownMenuHighlightItemPrimitive disabled={disabled}>
			<DropdownMenuCheckboxItemPrimitive
				disabled={disabled}
				className={cn(
					"flex relative gap-2 items-center py-1.5 pr-2 pl-8 text-sm rounded-sm outline-hidden cursor-default select-none focus:text-accent-foreground data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none",
					className,
				)}
				checked={checked}
				{...props}
			>
				<span className="flex absolute left-2 justify-center items-center size-3.5 pointer-events-none">
					<DropdownMenuItemIndicatorPrimitive
						initial={{ opacity: 0, scale: 0.5 }}
						animate={{ opacity: 1, scale: 1 }}
					>
						<CheckIcon className="size-4" />
					</DropdownMenuItemIndicatorPrimitive>
				</span>
				{children}
			</DropdownMenuCheckboxItemPrimitive>
		</DropdownMenuHighlightItemPrimitive>
	);
}

type DropdownMenuRadioGroupProps = DropdownMenuRadioGroupPrimitiveProps;

function DropdownMenuRadioGroup(props: DropdownMenuRadioGroupProps) {
	return <DropdownMenuRadioGroupPrimitive {...props} />;
}

type DropdownMenuRadioItemProps = DropdownMenuRadioItemPrimitiveProps;

function DropdownMenuRadioItem({
	className,
	children,
	disabled,
	...props
}: DropdownMenuRadioItemProps) {
	return (
		<DropdownMenuHighlightItemPrimitive disabled={disabled}>
			<DropdownMenuRadioItemPrimitive
				disabled={disabled}
				className={cn(
					"flex relative gap-2 items-center py-1.5 pr-2 pl-8 text-sm rounded-sm outline-hidden cursor-default select-none focus:text-accent-foreground data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none",
					className,
				)}
				{...props}
			>
				<span className="flex absolute left-2 justify-center items-center size-3.5 pointer-events-none">
					<DropdownMenuItemIndicatorPrimitive layoutId="dropdown-menu-item-indicator-radio">
						<CircleIcon className="size-2 fill-current" />
					</DropdownMenuItemIndicatorPrimitive>
				</span>
				{children}
			</DropdownMenuRadioItemPrimitive>
		</DropdownMenuHighlightItemPrimitive>
	);
}

type DropdownMenuLabelProps = DropdownMenuLabelPrimitiveProps & {
	inset?: boolean;
};

function DropdownMenuLabel({
	className,
	inset,
	...props
}: DropdownMenuLabelProps) {
	return (
		<DropdownMenuLabelPrimitive
			data-inset={inset}
			className={cn(
				"px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
				className,
			)}
			{...props}
		/>
	);
}

type DropdownMenuSeparatorProps = DropdownMenuSeparatorPrimitiveProps;

function DropdownMenuSeparator({
	className,
	...props
}: DropdownMenuSeparatorProps) {
	return (
		<DropdownMenuSeparatorPrimitive
			className={cn("-mx-1 my-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

type DropdownMenuShortcutProps = DropdownMenuShortcutPrimitiveProps;

function DropdownMenuShortcut({
	className,
	...props
}: DropdownMenuShortcutProps) {
	return (
		<DropdownMenuShortcutPrimitive
			className={cn(
				"ml-auto text-xs tracking-widest text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

type DropdownMenuSubProps = DropdownMenuSubPrimitiveProps;

function DropdownMenuSub(props: DropdownMenuSubProps) {
	return <DropdownMenuSubPrimitive {...props} />;
}

type DropdownMenuSubTriggerProps = DropdownMenuSubTriggerPrimitiveProps & {
	inset?: boolean;
};

function DropdownMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: DropdownMenuSubTriggerProps) {
	return (
		<DropdownMenuHighlightItemPrimitive>
			<DropdownMenuSubTriggerPrimitive
				data-inset={inset}
				className={cn(
					"flex items-center px-2 py-1.5 text-sm rounded-sm outline-hidden cursor-default select-none focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:text-accent-foreground",
					"data-[state=open]:[&_[data-slot=chevron]]:rotate-90 [&_[data-slot=chevron]]:transition-transform [&_[data-slot=chevron]]:duration-300 [&_[data-slot=chevron]]:ease-in-out",
					className,
				)}
				{...props}
			>
				{children}
				<ChevronRightIcon data-slot="chevron" className="ml-auto size-4" />
			</DropdownMenuSubTriggerPrimitive>
		</DropdownMenuHighlightItemPrimitive>
	);
}

type DropdownMenuSubContentProps = DropdownMenuSubContentPrimitiveProps;

function DropdownMenuSubContent({
	className,
	...props
}: DropdownMenuSubContentProps) {
	return (
		<DropdownMenuSubContentPrimitive
			className={cn(
				"overflow-hidden z-50 p-1 min-w-[8rem] text-popover-foreground bg-popover rounded-md border shadow-lg origin-(--radix-dropdown-menu-content-transform-origin)",
				className,
			)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
	type DropdownMenuProps,
	type DropdownMenuTriggerProps,
	type DropdownMenuContentProps,
	type DropdownMenuGroupProps,
	type DropdownMenuItemProps,
	type DropdownMenuCheckboxItemProps,
	type DropdownMenuRadioGroupProps,
	type DropdownMenuRadioItemProps,
	type DropdownMenuLabelProps,
	type DropdownMenuSeparatorProps,
	type DropdownMenuShortcutProps,
	type DropdownMenuSubProps,
	type DropdownMenuSubTriggerProps,
	type DropdownMenuSubContentProps,
};
