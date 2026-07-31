import { auth } from '@api/modules/auth/service'
import cors from '@elysiajs/cors'
import { Elysia } from 'elysia'

const allowedOrigins: (string | RegExp)[] = ['http://localhost:3001']
if (process.env.WEB_HOST) {
  allowedOrigins.push(process.env.WEB_HOST)
}

let bunServer: {
  requestIP: (req: Request) => { address: string } | null
} | null = null

export const betterAuth = new Elysia({ name: 'better-auth' })
  .use(
    cors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  .onRequest(({ server }) => {
    if (!bunServer && server) bunServer = server
  })
  .onRequest(async ({ request }) => {
    // Inject client IP for Better Auth rate limiting / audit
    let authRequest = request
    if (
      bunServer &&
      'requestIP' in bunServer &&
      typeof bunServer.requestIP === 'function'
    ) {
      try {
        const ipInfo = (
          bunServer.requestIP as (req: Request) => { address: string } | null
        )(request)
        if (ipInfo?.address) {
          const headers = new Headers(request.headers)
          headers.set('x-forwarded-for', ipInfo.address)
          authRequest = new Request(request, { headers })
        }
      } catch {
        /* 拿不到 IP 就用默认行为 */
      }
    }

    // Only intercept /auth/* paths; short-circuit with Better Auth's handler.
    // Non-auth requests fall through to Elysia's native route matching.
    // Previously this used .mount() which registered ALL /* as a catch-all
    // route — Better Auth returns 404 for non-auth paths, and because it
    // returns a Response (doesn't throw), Elysia would silently serve that
    // 404 with zero log output when a more-specific route failed to match.
    const url = new URL(authRequest.url)
    if (url.pathname.startsWith('/auth/') || url.pathname === '/auth') {
      return auth.handler(authRequest)
    }
  })
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })
        if (!session) throw status(401, '请先登录喵～')
        return session
      },
    },
    isAdmin: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })
        if (!session || session === null) throw status(401, '请先登录喵～')
        if (session.user.role !== 'admin')
          throw status(403, '该用户不具有管理员权限喵～')

        return session
      },
    },
  })
