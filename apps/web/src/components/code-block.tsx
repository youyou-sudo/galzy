import { cn } from "@web/lib/utils";
import * as React from "react";

interface CodeProps extends React.HTMLAttributes<HTMLPreElement> {
	code: string;
}

function parseError(error: unknown) {
	if (!error) return null;

	if (typeof error === "object") return error;

	if (typeof error === "string") {
		try {
			return JSON.parse(error);
		} catch {
			return error;
		}
	}

	return error;
}

function extractErrorMessage(input: string) {
	const match = input.match(/error:\s*({[\s\S]*})\)?$/);

	if (match) {
		try {
			return JSON.parse(match[1]);
		} catch {
			return match[1];
		}
	}

	return input;
}

function formatError(input: unknown) {
	let parsed = input;

	if (typeof input === "string") {
		parsed = extractErrorMessage(input);
	}

	parsed = parseError(parsed);

	if (typeof parsed === "string") return parsed;

	try {
		return JSON.stringify(parsed, null, 2);
	} catch {
		return String(parsed);
	}
}

export function CodeBlock({ code, className, ...props }: CodeProps) {
	const formatted = React.useMemo(() => formatError(code), [code]);

	return (
		<div className="flex justify-center space-y-2">
			<div className="relative w-fit max-w-full">
				<code
					className={cn(
						"block overflow-auto p-3 mt-2 max-h-60 text-sm whitespace-pre align-bottom bg-muted rounded-lg",
						className,
					)}
					{...props}
				>
					{formatted}
				</code>
			</div>
		</div>
	);
}
