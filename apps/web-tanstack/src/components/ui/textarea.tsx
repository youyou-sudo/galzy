import * as React from "react";

import { cn } from "@web/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"flex px-3 py-2 w-full min-h-16 text-base bg-background/60 rounded-xl border border-input outline-none transition-colors duration-200 field-sizing-content placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:bg-input/50 disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 md:text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
