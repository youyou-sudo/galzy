import * as React from "react";

import { cn } from "@web/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"px-3 py-1 w-full min-w-0 h-9 text-base bg-background/60 rounded-xl border border-input outline-none transition-colors duration-200 file:inline-flex file:h-6 file:text-sm file:font-medium file:text-foreground file:bg-transparent file:border-0 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:bg-input/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 md:text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
