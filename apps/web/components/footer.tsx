import { cn } from '@web/lib/utils'
import Link from 'next/link'
import type React from 'react'

interface FooterProps {
  className?: string
  children?: React.ReactNode
}

export function Footer({ className, children }: FooterProps) {
  const startYear = 2022
  const currentYear = new Date().getFullYear()
  const years = currentYear - startYear
  return (
    <footer
      className={cn(
        ' border-t border-border px-6 py-4 text-center text-sm text-muted-foreground',
        className,
      )}
    >
      {children || (
        <div className="flex flex-col gap-2 items-center">
          <p>
            &copy;
            {years > 0 ? `${startYear}-${currentYear}` : `${startYear}`} Galzy
          </p>
          <div className="flex gap-4 justify-center">
            <Link prefetch={false} href="#" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link
              href="friend-links"
              prefetch={false}
              className="hover:text-foreground transition-colors"
            >
              友情链接
            </Link>
            <Link
              href="https://icp.gov.moe/?keyword=20222332"
              target="_blank"
              className="hover:text-foreground transition-colors"
            >
              萌ICP备20222332号
            </Link>
          </div>
        </div>
      )}
    </footer>
  )
}
