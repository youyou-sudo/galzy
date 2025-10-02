import type { auth } from '@api/modules/auth/service'
import { betterFetch } from '@better-fetch/fetch'
import { type NextRequest, NextResponse } from 'next/server'

type Session = typeof auth.$Infer.Session

const allowedOrigins = [
  'https://sg.saop.cc',
  'https://searchgal.homes',
  'https://galzy.eu.org',
]

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || ''

  // ====== 处理 CORS ======
  let response: NextResponse | null = null
  if (allowedOrigins.includes(origin)) {
    response = NextResponse.next()
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  // ====== 鉴权逻辑  ======
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const { data: session } = await betterFetch<Session>(
      '/api/auth/get-session',
      {
        baseURL: request.nextUrl.origin,
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      },
    )

    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response ?? NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
  ],
}
