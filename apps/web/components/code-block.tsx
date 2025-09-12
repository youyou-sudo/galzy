'use client'

import { cn } from '@web/lib/utils'
import { Check, Copy } from 'lucide-react'
import * as React from 'react'

interface CodeProps extends React.HTMLAttributes<HTMLPreElement> {
  language?: string
  code: string
  showLineNumbers?: boolean
  showCopyButton?: boolean
}

export function CodeBlock({
  language,
  code,
  showLineNumbers = true,
  showCopyButton = true,
  className,
  ...props
}: CodeProps) {
  const [copied, setCopied] = React.useState(false)

  const copyToClipboard = React.useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  const lines = code.split('\n')

  return (
    <div className="relative group">
      <pre
        className={cn(
          'p-4 rounded-lg bg-muted overflow-x-auto text-sm font-mono',
          showLineNumbers && 'pl-12',
          className,
        )}
        {...props}
      >
        {language && (
          <div className="absolute top-3 right-3 text-xs text-muted-foreground px-2 py-1 rounded bg-muted-foreground/10">
            {language}
          </div>
        )}
        {showLineNumbers && (
          <div className="absolute left-4 top-4 select-none text-muted-foreground">
            {lines.map((_, i) => (
              <div key={i} className="text-right pr-3">
                {i + 1}
              </div>
            ))}
          </div>
        )}
        <code>{code}</code>
      </pre>
      {showCopyButton && (
        <button
          onClick={copyToClipboard}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-md bg-muted-foreground/10 hover:bg-muted-foreground/20"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  )
}
