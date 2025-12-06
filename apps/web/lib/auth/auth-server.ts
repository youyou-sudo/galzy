import 'server-only'
import 'lib/env'
import { createAuthClient } from 'better-auth/client'
import { adminClient } from 'better-auth/client/plugins'
import { headers } from 'next/headers'


export const BETTER_AUTH_URL = process.env.API_HOST ? `${process.env.API_HOST}:${process.env.API_PORT}` : 'http://localhost:3001'
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

      // Proxy auth-related cookies
      if (cookie) {
        const authCookies = cookie
          .split(';')
          .map((c) => c.trim())
          .filter(
            (c) =>
              c.startsWith(`${BETTER_AUTH_COOKIE_PREFIX}.`) ||
              c.startsWith(`__Secure-${BETTER_AUTH_COOKIE_PREFIX}.`),
          )
          .join('; ')

        if (authCookies) {
          context.headers.set('Cookie', authCookies)
        }
      }
    },
  },
})
