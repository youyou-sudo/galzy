import {
	DialogClose as DialogClosePrimitive,
	type DialogCloseProps as DialogClosePrimitiveProps,
	DialogContent as DialogContentPrimitive,
	type DialogContentProps as DialogContentPrimitiveProps,
	DialogDescription as DialogDescriptionPrimitive,
	type DialogDescriptionProps as DialogDescriptionPrimitiveProps,
	DialogFooter as DialogFooterPrimitive,
	type DialogFooterProps as DialogFooterPrimitiveProps,
	DialogHeader as DialogHeaderPrimitive,
	type DialogHeaderProps as DialogHeaderPrimitiveProps,
	DialogOverlay as DialogOverlayPrimitive,
	type DialogOverlayProps as DialogOverlayPrimitiveProps,
	DialogPortal as DialogPortalPrimitive,
	Dialog as DialogPrimitive,
	type DialogProps as DialogPrimitiveProps,
	DialogTitle as DialogTitlePrimitive,
	type DialogTitleProps as DialogTitlePrimitiveProps,
	DialogTrigger as DialogTriggerPrimitive,
	type DialogTriggerProps as DialogTriggerPrimitiveProps,
} from "@web/components/animate-ui/primitives/radix/dialog";
import { cn } from "@web/lib/utils";
import { XIcon } from "lucide-react";

type DialogProps = DialogPrimitiveProps;

function Dialog(props: DialogProps) {
	return <DialogPrimitive {...props} />;
}

type DialogTriggerProps = DialogTriggerPrimitiveProps;

function DialogTrigger(props: DialogTriggerProps) {
	return <DialogTriggerPrimitive {...props} />;
}

type DialogCloseProps = DialogClosePrimitiveProps;

function DialogClose(props: DialogCloseProps) {
	return <DialogClosePrimitive {...props} />;
}

type DialogOverlayProps = DialogOverlayPrimitiveProps;

function DialogOverlay({ className, ...props }: DialogOverlayProps) {
	return (
		<DialogOverlayPrimitive
			className={cn("fixed inset-0 z-50 bg-black/50", className)}
			{...props}
		/>
	);
}

type DialogContentProps = DialogContentPrimitiveProps & {
	showCloseButton?: boolean;
};

function DialogContent({
	className,
	children,
	showCloseButton = true,
	...props
}: DialogContentProps & {
	showCloseButton?: boolean;
}) {
	return (
		<DialogPortalPrimitive>
			<DialogOverlay />
			<DialogContentPrimitive
				className={cn(
					"grid fixed top-[50%] left-[50%] z-50 gap-4 p-6 w-full max-w-[calc(100%-2rem)] bg-background rounded-lg border shadow-lg translate-x-[-50%] translate-y-[-50%] sm:max-w-lg",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<DialogClosePrimitive className="absolute top-4 right-4 rounded-xs ring-offset-background opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:pointer-events-none data-[state=open]:text-muted-foreground data-[state=open]:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none">
						<XIcon />
						<span className="sr-only">Close</span>
					</DialogClosePrimitive>
				)}
			</DialogContentPrimitive>
		</DialogPortalPrimitive>
	);
}

type DialogHeaderProps = DialogHeaderPrimitiveProps;

function DialogHeader({ className, ...props }: DialogHeaderProps) {
	return (
		<DialogHeaderPrimitive
			className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
			{...props}
		/>
	);
}

type DialogFooterProps = DialogFooterPrimitiveProps;

function DialogFooter({ className, ...props }: DialogFooterProps) {
	return (
		<DialogFooterPrimitive
			className={cn(
				"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		/>
	);
}

type DialogTitleProps = DialogTitlePrimitiveProps;

function DialogTitle({ className, ...props }: DialogTitleProps) {
	return (
		<DialogTitlePrimitive
			className={cn("text-lg leading-none font-semibold", className)}
			{...props}
		/>
	);
}

type DialogDescriptionProps = DialogDescriptionPrimitiveProps;

function DialogDescription({ className, ...props }: DialogDescriptionProps) {
	return (
		<DialogDescriptionPrimitive
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogTrigger,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription,
	type DialogProps,
	type DialogTriggerProps,
	type DialogCloseProps,
	type DialogContentProps,
	type DialogHeaderProps,
	type DialogFooterProps,
	type DialogTitleProps,
	type DialogDescriptionProps,
};
