"use client";

import { cn } from "@web/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckIcon, CopyIcon } from "lucide-react";
import { AnimatePresence, type HTMLMotionProps, motion } from "motion/react";
import * as React from "react";

const buttonVariants = cva(
	"inline-flex shrink-0 justify-center items-center rounded-md outline-none transition-colors cursor-pointer focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:shrink-0 [&_svg]:pointer-events-none",
	{
		variants: {
			variant: {
				default:
					"text-primary-foreground bg-primary shadow-xs hover:bg-primary/90",
				muted: "text-muted-foreground bg-muted",
				destructive:
					"text-white bg-destructive shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
				outline:
					"bg-background border shadow-xs hover:text-accent-foreground hover:bg-accent dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
				secondary:
					"text-secondary-foreground bg-secondary shadow-xs hover:bg-secondary/80",
				ghost:
					"hover:text-accent-foreground hover:bg-accent dark:hover:bg-accent/50",
			},
			size: {
				default: "size-8 rounded-lg [&_svg]:size-4",
				sm: "size-6 [&_svg]:size-3",
				md: "size-10 rounded-lg [&_svg]:size-5",
				lg: "size-12 rounded-xl [&_svg]:size-6",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type CopyButtonProps = Omit<HTMLMotionProps<"button">, "children" | "onCopy"> &
	VariantProps<typeof buttonVariants> & {
		content?: string;
		delay?: number;
		onCopy?: (content: string) => void;
		isCopied?: boolean;
		onCopyChange?: (isCopied: boolean) => void;
	};

function CopyButton({
	content,
	className,
	size,
	variant,
	delay = 3000,
	onClick,
	onCopy,
	isCopied,
	onCopyChange,
	...props
}: CopyButtonProps) {
	const [localIsCopied, setLocalIsCopied] = React.useState(isCopied ?? false);
	const Icon = localIsCopied ? CheckIcon : CopyIcon;

	React.useEffect(() => {
		setLocalIsCopied(isCopied ?? false);
	}, [isCopied]);

	const handleIsCopied = React.useCallback(
		(isCopied: boolean) => {
			setLocalIsCopied(isCopied);
			onCopyChange?.(isCopied);
		},
		[onCopyChange],
	);

	const handleCopy = React.useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			if (isCopied) return;
			if (content) {
				navigator.clipboard
					.writeText(content)
					.then(() => {
						handleIsCopied(true);
						setTimeout(() => handleIsCopied(false), delay);
						onCopy?.(content);
					})
					.catch((error) => {
						console.error("Error copying command", error);
					});
			}
			onClick?.(e);
		},
		[isCopied, content, delay, onClick, onCopy, handleIsCopied],
	);

	return (
		<motion.button
			data-slot="copy-button"
			whileHover={{ scale: 1.05 }}
			whileTap={{ scale: 0.95 }}
			className={cn(buttonVariants({ variant, size }), className)}
			onClick={handleCopy}
			{...props}
		>
			<AnimatePresence mode="wait">
				<motion.span
					key={localIsCopied ? "check" : "copy"}
					data-slot="copy-button-icon"
					initial={{ scale: 0 }}
					animate={{ scale: 1 }}
					exit={{ scale: 0 }}
					transition={{ duration: 0.15 }}
				>
					<Icon />
				</motion.span>
			</AnimatePresence>
		</motion.button>
	);
}

export { CopyButton, buttonVariants, type CopyButtonProps };
