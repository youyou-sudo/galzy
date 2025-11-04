import React from "react"
import { cn } from "@web/lib/utils"

export const Typography = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("space-y-2", className)} {...props} />,
)
Typography.displayName = "Typography"

export const TypographyH1 = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h1 ref={ref} className={cn("scroll-m-20 text-2xl tracking-tight lg:text-3xl", className)} {...props} />
  ),
)
TypographyH1.displayName = "TypographyH1"

export const TypographyH2 = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn(
        "mt-1 scroll-m-20 text-xl font-semibold tracking-tight transition-colors first:mt-0",
        className,
      )}
      {...props}
    />
  ),
)
TypographyH2.displayName = "TypographyH2"

export const TypographyH3 = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("mt-3 scroll-m-20 text-lg font-semibold tracking-tight", className)} {...props} />
  ),
)
TypographyH3.displayName = "TypographyH3"

export const TypographyH4 = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h4 ref={ref} className={cn("mt-6 scroll-m-20 text-base font-semibold tracking-tight", className)} {...props} />
  ),
)
TypographyH4.displayName = "TypographyH4"

export const TypographyP = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("leading-3 not-first:mt-6", className)} {...props} />
  ),
)
TypographyP.displayName = "TypographyP"

export const TypographyBlockquote = React.forwardRef<HTMLQuoteElement, React.HTMLAttributes<HTMLQuoteElement>>(
  ({ className, ...props }, ref) => (
    <blockquote
      ref={ref}
      className={cn("mt-6 border-l-2 pl-6 italic text-slate-700 dark:text-slate-300", className)}
      {...props}
    />
  ),
)
TypographyBlockquote.displayName = "TypographyBlockquote"

export const TypographyInlineCode = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <code
      ref={ref}
      className={cn(
        "relative rounded bg-slate-100 dark:bg-slate-800 px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-slate-900 dark:text-slate-50",
        className,
      )}
      {...props}
    />
  ),
)
TypographyInlineCode.displayName = "TypographyInlineCode"

export const TypographyLead = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-xl text-slate-700 dark:text-slate-300", className)} {...props} />
  ),
)
TypographyLead.displayName = "TypographyLead"

export const TypographyLarge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("text-lg font-semibold", className)} {...props} />,
)
TypographyLarge.displayName = "TypographyLarge"

export const TypographySmall = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm font-medium leading-none", className)} {...props} />
  ),
)
TypographySmall.displayName = "TypographySmall"

export const TypographyMuted = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-slate-500 dark:text-slate-400", className)} {...props} />
  ),
)
TypographyMuted.displayName = "TypographyMuted"

export const TypographyTableHeader = React.forwardRef<HTMLTableCellElement, React.HTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "px-4 py-2 text-left font-semibold text-slate-900 dark:text-slate-50 bg-slate-50 dark:bg-slate-900",
        className,
      )}
      {...props}
    />
  ),
)
TypographyTableHeader.displayName = "TypographyTableHeader"

export const TypographyTableCell = React.forwardRef<HTMLTableCellElement, React.HTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("px-4 py-2 text-sm text-slate-700 dark:text-slate-300", className)} {...props} />
  ),
)
TypographyTableCell.displayName = "TypographyTableCell"
