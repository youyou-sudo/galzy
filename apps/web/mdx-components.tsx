import {
  TypographyBlockquote,
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyInlineCode,
  TypographyP,
  TypographyTableCell,
  TypographyTableHeader,
} from '@web/components/ui/typography'
import type { MDXComponents } from 'mdx/types'

export const mdxComponents: MDXComponents = {
  h1: ({ children }) => <TypographyH1>{children}</TypographyH1>,
  h2: ({ children }) => <TypographyH2>{children}</TypographyH2>,
  h3: ({ children }) => <TypographyH3>{children}</TypographyH3>,
  h4: ({ children }) => <TypographyH4>{children}</TypographyH4>,
  p: ({ children }) => <TypographyP>{children}</TypographyP>,
  blockquote: ({ children }) => (
    <TypographyBlockquote>{children}</TypographyBlockquote>
  ),
  code: ({ children }) => (
    <TypographyInlineCode>{children}</TypographyInlineCode>
  ),
  pre: ({ children }) => (
    <pre className="rounded-lg p-4 overflow-x-auto border border-slate-200 dark:border-slate-700">
      {children}
    </pre>
  ),
  ul: ({ children }) => (
    <ul className="my-6 ml-6 list-disc [&>li]:mt-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-6 ml-6 list-decimal [&>li]:mt-2">{children}</ol>
  ),
  li: ({ children }) => <li className="text-sm">{children}</li>,
  table: ({ children }) => (
    <div className="my-6 w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-slate-200 dark:border-slate-700">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <TypographyTableHeader>{children}</TypographyTableHeader>
  ),
  td: ({ children }) => <TypographyTableCell>{children}</TypographyTableCell>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="font-medium text-blue-600 underline dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img
      src={src || '/placeholder.svg'}
      alt={alt || ''}
      className="rounded-lg border border-slate-200 dark:border-slate-700 my-6 w-full"
    />
  ),
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...mdxComponents,
    ...components,
  }
}
