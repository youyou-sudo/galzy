import { cn } from "@/lib/utils";
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
		<div className="space-y-2 flex justify-center">
			<div className="relative w-fit max-w-full">
				<code
					className={cn(
						"mt-2 block max-h-60 overflow-auto rounded-lg align-bottom whitespace-pre p-3 text-sm bg-muted",
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
