import { authServerClient } from '@web/lib/auth/auth-server'
import { type NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  const session = await authServerClient.getSession()

  if (!session.data) {
    const from = request.nextUrl.pathname + request.nextUrl.search

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', from)

    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
