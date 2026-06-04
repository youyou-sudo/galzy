import { auth } from '@api/modules/auth/service'
import cors from '@elysiajs/cors'
import { Elysia } from 'elysia'

const allowedOrigins = ['http://localhost:3001', `${process.env.WEB_HOST}`]

export const betterAuth = new Elysia({ name: 'better-auth' })
  .use(
    cors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  .mount(auth.handler)
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
