import { auth } from '@api/modules/auth/service'
import cors from '@elysiajs/cors'
import { Elysia } from 'elysia'

const allowedOrigins = ['http://localhost:3000', `${process.env.WEB_HOST}`]

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
  .derive(async ({ request: { headers } }) => {
    const session = await auth.api.getSession({ headers })

    return {
      auth: session,
    }
  })
  .macro({
    auth: {
      async resolve({ status, auth }) {
        if (!auth) return status(401, '请先登录喵～')
        return auth
      },
    },
    isAdmin: {
      async resolve({ status, auth }) {
        if (!auth) return status(401, '请先登录喵～')
        if (auth.user.role !== 'admin')
          return status(403, '该用户不具有管理员权限喵～')

        return auth
      },
    },
  })
