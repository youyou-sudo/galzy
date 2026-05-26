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
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({
          headers,
        })

        if (!session) return status(401)

        return session
      },
    },
    isAdmin: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({
          headers,
        })
        if (session?.user.role !== 'admin') return status('Unauthorized')
        return { user: session?.user, session }
      },
    },
  })
