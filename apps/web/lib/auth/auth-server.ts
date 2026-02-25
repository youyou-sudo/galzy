import 'server-only'
import 'lib/env'
import { createAuthClient } from 'better-auth/client'
import { adminClient } from 'better-auth/client/plugins'
import { headers } from 'next/headers'

export const BETTER_AUTH_URL = process.env.API_HOST
  ? `${process.env.API_HOST}`
  : 'http://localhost:3001'
export const BETTER_AUTH_BASE_PATH = '/auth'
export const BETTER_AUTH_COOKIE_PREFIX = 'better-auth' // <- default prefix
/**
 * Better Auth client for Server-side
 */
export const authServerClient = createAuthClient({
  plugins: [adminClient()],
  baseURL: BETTER_AUTH_URL,
  basePath: BETTER_AUTH_BASE_PATH,
  fetchOptions: {
    baseURL: BETTER_AUTH_URL + BETTER_AUTH_BASE_PATH,
    onRequest: async (context) => {
      const headersList = await headers()
      const cookie = headersList.get('Cookie')

      if (cookie) {
        const cookiePattern = new RegExp(
          `(^|; )(${BETTER_AUTH_COOKIE_PREFIX}\\.[^ ;]+|__Secure-${BETTER_AUTH_COOKIE_PREFIX}\\.[^ ;]+)`,
          'g'
        )
        const matches = cookie.match(cookiePattern)

        if (matches) {
          const authCookies = matches
            .map(m => m.replace(/^; /, ''))
            .join('; ')

          context.headers.set('Cookie', authCookies)
        }
      }
    },
  },
})
