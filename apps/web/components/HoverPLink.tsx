'use client'

import Link, { type LinkProps } from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

interface HoverPrefetchLinkProps
  extends Omit<LinkProps, 'href'>,
    React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children: React.ReactNode
}

export default function HoverPrefetchLink({
  href,
  children,
  ...rest
}: HoverPrefetchLinkProps) {
  const router = useRouter()

  const handleMouseEnter = useCallback(async () => {
    try {
      await router.prefetch(href.toString())
    } catch (e) {
      console.error('Prefetch failed for', href, e)
    }
  }, [href, router])

  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={handleMouseEnter}
      {...rest}
    >
      {children}
    </Link>
  )
}
