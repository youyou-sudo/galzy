"use client";

import {
	Highlight,
	HighlightItem,
	type HighlightItemProps,
	type HighlightProps,
} from "@web/components/animate-ui/primitives/effects/highlight";
import { useControlledState } from "@web/hooks/use-controlled-state";
import { getStrictContext } from "@web/lib/get-strict-context";
import { AnimatePresence, type HTMLMotionProps, motion } from "motion/react";
import { Menu as DropdownMenuPrimitive } from "@base-ui/react/menu";
import type * as React from "react";

type DropdownMenuContextType = {
	isOpen: boolean;
	setIsOpen: (o: boolean) => void;
};

const [DropdownMenuProvider, useDropdownMenu] =
	getStrictContext<DropdownMenuContextType>("DropdownMenuContext");

const [DropdownMenuSubProvider, useDropdownMenuSub] =
	getStrictContext<DropdownMenuContextType>("DropdownMenuSubContext");

type DropdownMenuProps = DropdownMenuPrimitive.Root.Props;

function DropdownMenu(props: DropdownMenuProps) {
	const [isOpen, setIsOpen] = useControlledState({
		value: props?.open,
		defaultValue: props?.defaultOpen,
		onChange: props?.onOpenChange,
	});

	return (
		<DropdownMenuProvider value={{ isOpen, setIsOpen: setIsOpen as unknown as (o: boolean) => void }}>
			<DropdownMenuPrimitive.Root
				data-slot="dropdown-menu"
				{...props}
				onOpenChange={(next, details) => setIsOpen(next, details)}
			/>
		</DropdownMenuProvider>
	);
}

type DropdownMenuTriggerProps = DropdownMenuPrimitive.Trigger.Props;

function DropdownMenuTrigger(props: DropdownMenuTriggerProps) {
	return (
		<DropdownMenuPrimitive.Trigger
			data-slot="dropdown-menu-trigger"
			{...props}
		/>
	);
}

type DropdownMenuPortalProps = DropdownMenuPrimitive.Portal.Props;

function DropdownMenuPortal(props: DropdownMenuPortalProps) {
	return (
		<DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
	);
}

type DropdownMenuGroupProps = DropdownMenuPrimitive.Group.Props;

function DropdownMenuGroup(props: DropdownMenuGroupProps) {
	return (
		<DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
	);
}

type DropdownMenuSubProps = DropdownMenuPrimitive.SubmenuRoot.Props;

function DropdownMenuSub(props: DropdownMenuSubProps) {
	const [isOpen, setIsOpen] = useControlledState({
		value: props?.open,
		defaultValue: props?.defaultOpen,
		onChange: props?.onOpenChange,
	});

	return (
		<DropdownMenuSubProvider value={{ isOpen, setIsOpen: setIsOpen as unknown as (o: boolean) => void }}>
			<DropdownMenuPrimitive.SubmenuRoot
				data-slot="dropdown-menu-sub"
				{...props}
				onOpenChange={(next, details) => setIsOpen(next, details)}
			/>
		</DropdownMenuSubProvider>
	);
}

type DropdownMenuRadioGroupProps = DropdownMenuPrimitive.RadioGroup.Props;

function DropdownMenuRadioGroup(props: DropdownMenuRadioGroupProps) {
	return (
		<DropdownMenuPrimitive.RadioGroup
			data-slot="dropdown-menu-radio-group"
			{...props}
		/>
	);
}

type DropdownMenuSubTriggerProps = Omit<
	DropdownMenuPrimitive.SubmenuTrigger.Props,
	"asChild"
> &
	HTMLMotionProps<"div">;

function DropdownMenuSubTrigger({
	disabled,
	...props
}: DropdownMenuSubTriggerProps) {
	return (
		<DropdownMenuPrimitive.SubmenuTrigger
			disabled={disabled}
			render={
				<motion.div
					data-slot="dropdown-menu-sub-trigger"
					data-disabled={disabled}
					{...props}
				/>
			}
		/>
	);
}

type DropdownMenuContentProps = Omit<
	DropdownMenuPrimitive.Popup.Props,
	"forceMount" | "asChild"
> &
	Partial<DropdownMenuPrimitive.Positioner.Props> &
	Pick<DropdownMenuPrimitive.Portal.Props, "container"> &
	HTMLMotionProps<"div"> & {
		/** @deprecated Radix-specific, no-op in Base UI */
		loop?: boolean;
		/** @deprecated Radix-specific, no-op in Base UI */
		onCloseAutoFocus?: (e: Event) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		onEscapeKeyDown?: (e: KeyboardEvent) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		onPointerDownOutside?: (e: CustomEvent) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		onFocusOutside?: (e: FocusEvent) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		onInteractOutside?: (e: CustomEvent) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		avoidCollisions?: boolean;
		/** @deprecated Radix-specific, no-op in Base UI */
		collisionBoundary?: Element | Element[] | null;
		/** @deprecated Radix-specific, no-op in Base UI */
		collisionPadding?: number | Partial<Record<string, number>>;
		/** @deprecated Radix-specific, no-op in Base UI */
		arrowPadding?: number;
		/** @deprecated Radix-specific, no-op in Base UI */
		sticky?: "always" | "partial";
		/** @deprecated Radix-specific, no-op in Base UI */
		hideWhenDetached?: boolean;
	};

function DropdownMenuContent({
	loop: _loop,
	onCloseAutoFocus: _onCloseAutoFocus,
	onEscapeKeyDown: _onEscapeKeyDown,
	onPointerDownOutside: _onPointerDownOutside,
	onFocusOutside: _onFocusOutside,
	onInteractOutside: _onInteractOutside,
	side,
	sideOffset,
	align,
	alignOffset,
	avoidCollisions: _avoidCollisions,
	collisionBoundary: _collisionBoundary,
	collisionPadding: _collisionPadding,
	arrowPadding: _arrowPadding,
	sticky: _sticky,
	hideWhenDetached: _hideWhenDetached,
	transition = { duration: 0.2 },
	style,
	container,
	children,
	...props
}: DropdownMenuContentProps) {
	const { isOpen } = useDropdownMenu();

	return (
		<AnimatePresence>
			{isOpen && (
				<DropdownMenuPrimitive.Portal container={container}>
					<DropdownMenuPrimitive.Positioner
						side={side}
						sideOffset={sideOffset}
						align={align}
						alignOffset={alignOffset}
					>
						<DropdownMenuPrimitive.Popup
							render={
								<motion.div
									key="dropdown-menu-content"
									data-slot="dropdown-menu-content"
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{
										opacity: 0,
										scale: 0.95,
										transition: { ...transition, delay: 0.3 },
									}}
									transition={transition}
									style={{ willChange: "opacity, transform", ...style }}
									{...props}
								/>
							}
						>
							{children}
						</DropdownMenuPrimitive.Popup>
					</DropdownMenuPrimitive.Positioner>
				</DropdownMenuPrimitive.Portal>
			)}
		</AnimatePresence>
	);
}

type DropdownMenuSubContentProps = Omit<
	DropdownMenuPrimitive.Popup.Props,
	"forceMount" | "asChild"
> &
	Partial<DropdownMenuPrimitive.Positioner.Props> &
	Pick<DropdownMenuPrimitive.Portal.Props, "container"> &
	HTMLMotionProps<"div"> & {
		/** @deprecated Radix-specific, no-op in Base UI */
		loop?: boolean;
		/** @deprecated Radix-specific, no-op in Base UI */
		onEscapeKeyDown?: (e: KeyboardEvent) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		onPointerDownOutside?: (e: CustomEvent) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		onFocusOutside?: (e: FocusEvent) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		onInteractOutside?: (e: CustomEvent) => void;
		/** @deprecated Radix-specific, no-op in Base UI */
		avoidCollisions?: boolean;
		/** @deprecated Radix-specific, no-op in Base UI */
		collisionBoundary?: Element | Element[] | null;
		/** @deprecated Radix-specific, no-op in Base UI */
		collisionPadding?: number | Partial<Record<string, number>>;
		/** @deprecated Radix-specific, no-op in Base UI */
		arrowPadding?: number;
		/** @deprecated Radix-specific, no-op in Base UI */
		sticky?: "always" | "partial";
		/** @deprecated Radix-specific, no-op in Base UI */
		hideWhenDetached?: boolean;
	};

function DropdownMenuSubContent({
	loop: _loop,
	onEscapeKeyDown: _onEscapeKeyDown,
	onPointerDownOutside: _onPointerDownOutside,
	onFocusOutside: _onFocusOutside,
	onInteractOutside: _onInteractOutside,
	sideOffset,
	alignOffset,
	avoidCollisions: _avoidCollisions,
	collisionBoundary: _collisionBoundary,
	collisionPadding: _collisionPadding,
	arrowPadding: _arrowPadding,
	sticky: _sticky,
	hideWhenDetached: _hideWhenDetached,
	transition = { duration: 0.2 },
	style,
	container,
	children,
	...props
}: DropdownMenuSubContentProps) {
	const { isOpen } = useDropdownMenuSub();

	return (
		<AnimatePresence>
			{isOpen && (
				<DropdownMenuPrimitive.Portal container={container}>
					<DropdownMenuPrimitive.Positioner
						sideOffset={sideOffset}
						alignOffset={alignOffset}
					>
						<DropdownMenuPrimitive.Popup
							render={
								<motion.div
									key="dropdown-menu-sub-content"
									data-slot="dropdown-menu-sub-content"
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.95 }}
									transition={transition}
									style={{ willChange: "opacity, transform", ...style }}
									{...props}
								/>
							}
						>
							{children}
						</DropdownMenuPrimitive.Popup>
					</DropdownMenuPrimitive.Positioner>
				</DropdownMenuPrimitive.Portal>
			)}
		</AnimatePresence>
	);
}

type DropdownMenuHighlightProps = Omit<
	HighlightProps,
	"controlledItems" | "enabled" | "hover"
> & {
	animateOnHover?: boolean;
};

function DropdownMenuHighlight({
	transition = { type: "spring", stiffness: 350, damping: 35 },
	animateOnHover = true,
	...props
}: DropdownMenuHighlightProps) {
	return (
		<Highlight
			hover
			controlledItems
			enabled={animateOnHover}
			transition={transition}
			{...props}
		/>
	);
}

type DropdownMenuItemProps = Omit<
	DropdownMenuPrimitive.Item.Props,
	"asChild"
> &
	HTMLMotionProps<"div">;

function DropdownMenuItem({
	disabled,
	onSelect,
	...props
}: DropdownMenuItemProps) {
	return (
		<DropdownMenuPrimitive.Item
			disabled={disabled}
			onSelect={onSelect}
			render={
				<motion.div
					data-slot="dropdown-menu-item"
					data-disabled={disabled}
					{...props}
				/>
			}
		/>
	);
}

type DropdownMenuCheckboxItemProps = Omit<
	DropdownMenuPrimitive.CheckboxItem.Props,
	"asChild"
> &
	HTMLMotionProps<"div">;

function DropdownMenuCheckboxItem({
	checked,
	onCheckedChange,
	disabled,
	onSelect,
	...props
}: DropdownMenuCheckboxItemProps) {
	return (
		<DropdownMenuPrimitive.CheckboxItem
			checked={checked}
			onCheckedChange={onCheckedChange}
			disabled={disabled}
			onSelect={onSelect}
			render={
				<motion.div
					data-slot="dropdown-menu-checkbox-item"
					data-disabled={disabled}
					{...props}
				/>
			}
		/>
	);
}

type DropdownMenuRadioItemProps = Omit<
	DropdownMenuPrimitive.RadioItem.Props,
	"asChild"
> &
	HTMLMotionProps<"div">;

function DropdownMenuRadioItem({
	value,
	disabled,
	onSelect,
	...props
}: DropdownMenuRadioItemProps) {
	return (
		<DropdownMenuPrimitive.RadioItem
			value={value}
			disabled={disabled}
			onSelect={onSelect}
			render={
				<motion.div
					data-slot="dropdown-menu-radio-item"
					data-disabled={disabled}
					{...props}
				/>
			}
		/>
	);
}

type DropdownMenuLabelProps = DropdownMenuPrimitive.GroupLabel.Props;

function DropdownMenuLabel(props: DropdownMenuLabelProps) {
	return (
		<DropdownMenuPrimitive.GroupLabel data-slot="dropdown-menu-label" {...props} />
	);
}

type DropdownMenuSeparatorProps = DropdownMenuPrimitive.Separator.Props;

function DropdownMenuSeparator(props: DropdownMenuSeparatorProps) {
	return (
		<DropdownMenuPrimitive.Separator
			data-slot="dropdown-menu-separator"
			{...props}
		/>
	);
}

type DropdownMenuShortcutProps = React.ComponentProps<"span">;

function DropdownMenuShortcut(props: DropdownMenuShortcutProps) {
	return <span data-slot="dropdown-menu-shortcut" {...props} />;
}

type DropdownMenuItemIndicatorProps = HTMLMotionProps<"div">;

function DropdownMenuItemIndicator(props: DropdownMenuItemIndicatorProps) {
	return (
		<DropdownMenuPrimitive.CheckboxItemIndicator data-slot="dropdown-menu-item-indicator">
			<motion.div {...props} />
		</DropdownMenuPrimitive.CheckboxItemIndicator>
	);
}

type DropdownMenuHighlightItemProps = HighlightItemProps;

function DropdownMenuHighlightItem(props: DropdownMenuHighlightItemProps) {
	return <HighlightItem data-slot="dropdown-menu-highlight-item" {...props} />;
}

export {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuHighlight,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuItemIndicator,
	DropdownMenuHighlightItem,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuGroup,
	DropdownMenuPortal,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuRadioGroup,
	useDropdownMenu,
	useDropdownMenuSub,
	type DropdownMenuProps,
	type DropdownMenuTriggerProps,
	type DropdownMenuHighlightProps,
	type DropdownMenuContentProps,
	type DropdownMenuItemProps,
	type DropdownMenuItemIndicatorProps,
	type DropdownMenuHighlightItemProps,
	type DropdownMenuCheckboxItemProps,
	type DropdownMenuRadioItemProps,
	type DropdownMenuLabelProps,
	type DropdownMenuSeparatorProps,
	type DropdownMenuShortcutProps,
	type DropdownMenuGroupProps,
	type DropdownMenuPortalProps,
	type DropdownMenuSubProps,
	type DropdownMenuSubContentProps,
	type DropdownMenuSubTriggerProps,
	type DropdownMenuRadioGroupProps,
	type DropdownMenuContextType,
};
