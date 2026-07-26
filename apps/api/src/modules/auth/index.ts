import { auth } from '@api/modules/auth/service'
import cors from '@elysiajs/cors'
import { Elysia } from 'elysia'

const allowedOrigins = ['http://localhost:3001', `${process.env.WEB_HOST}`]

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
  .mount((request: Request) => {
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
          request = new Request(request, { headers })
        }
      } catch {
        /* 拿不到 IP 就用默认行为 */
      }
    }
    return auth.handler(request)
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
