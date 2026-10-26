import * as React from "react";

import { cn } from "@web/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		<label
			data-slot="label"
			className={cn(
				"flex gap-2 items-center text-sm leading-none font-medium select-none group-data-[disabled=true]:opacity-50 group-data-[disabled=true]:pointer-events-none peer-disabled:opacity-50 peer-disabled:cursor-not-allowed",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
