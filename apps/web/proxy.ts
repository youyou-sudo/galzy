import type { auth } from '@api/modules/auth/service'
import { betterFetch } from '@better-fetch/fetch'
import { type NextRequest, NextResponse } from 'next/server'

type Session = typeof auth.$Infer.Session

const allowedOrigins = new Set([
  'https://sg.saop.cc',
  'https://searchgal.homes',
  'https://galzy.eu.org',
])

export async function proxy(request: NextRequest) {
  const origin = request.headers.get('origin')
  const pathname = request.nextUrl.pathname

  const isAllowedOrigin = origin && allowedOrigins.has(origin)
  const isDashboardPath = pathname.startsWith('/dashboard')

  const res = NextResponse.next()
  if (isAllowedOrigin) {
    res.headers.set('Access-Control-Allow-Origin', origin!)
    res.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  if (!isDashboardPath) return res

  const baseURL =
    process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL
      : request.nextUrl.origin

  const sessionPromise = betterFetch<Session>('/api/auth/get-session', {
    baseURL,
    headers: {
      cookie: request.headers.get('cookie') || '',
    },
  })

  const { data: session } = await sessionPromise

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
