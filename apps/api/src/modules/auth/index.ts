import cors from '@elysiajs/cors'
import swagger from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { auth } from './service'

const betterAuth = new Elysia({ name: 'better-auth' })
  .use(
    cors({
      origin: 'http://localhost:3000',
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

        return {
          user: session.user,
          session: session.session,
        }
      },
    },
  })

export const YouyouAuth = new Elysia()
  // .use(
  //   swagger(),
  // )
  .use(betterAuth)
