import type { auth } from '@api/modules/auth/service'
import { betterFetch } from '@better-fetch/fetch'
import { type NextRequest, NextResponse } from 'next/server'

type Session = typeof auth.$Infer.Session

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isDashboardPath = pathname.startsWith('/dashboard')

  if (!isDashboardPath) {
    return NextResponse.next()
  }

  const baseURL =
    process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL
      : request.nextUrl.origin

  const { data: session } = await betterFetch<Session>('/api/auth/get-session', {
    baseURL,
    headers: {
      cookie: request.headers.get('cookie') || '',
    },
  })

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
