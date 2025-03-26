"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineCodeProps extends React.HTMLAttributes<HTMLElement> {
  code: string;
  showCopyButton?: boolean;
}

export function Code({
  code,
  showCopyButton = true,
  className,
  ...props
}: InlineCodeProps) {
  const [copied, setCopied] = React.useState(false);
  const [showCopy, setShowCopy] = React.useState(false);

  const copyToClipboard = React.useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <span
      className={cn(
        "relative inline-flex items-center font-mono text-sm bg-muted px-1.5 py-0.5 rounded border border-border",
        className
      )}
      onMouseEnter={() => setShowCopy(true)}
      onMouseLeave={() => setShowCopy(false)}
      {...props}
    >
      <code>{code}</code>
      {showCopyButton && showCopy && (
        <button
          onClick={copyToClipboard}
          className="ml-1.5 p-0.5 rounded hover:bg-muted-foreground/10 focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      )}
    </span>
  );
}
