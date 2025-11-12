'use client'
import useForesight from '@web/hooks/useForesight'
import type { ForesightRegisterOptions } from 'js.foresight'
import type { LinkProps } from 'next/link'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ForesightLinkProps
  extends Omit<LinkProps, 'prefetch'>,
    Omit<ForesightRegisterOptions, 'element' | 'callback'> {
  children: React.ReactNode
  className?: string
}

export default function ForesightLink({
  children,
  className,
  ...props
}: ForesightLinkProps) {
  const router = useRouter() // import from "next/navigation" not "next/router"
  const { elementRef } = useForesight<HTMLAnchorElement>({
    callback: () => {
      router.prefetch(props.href.toString())
    },
    hitSlop: props.hitSlop,
    name: props.name,
    meta: props.meta,
    reactivateAfter: props.reactivateAfter,
  })

  return (
    <Link {...props} ref={elementRef} className={className}>
      {children}
    </Link>
  )
}
