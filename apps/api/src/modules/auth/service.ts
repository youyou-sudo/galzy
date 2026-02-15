import { dbConfig } from '@api/libs/config'
import { type BetterAuthOptions, betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { Pool } from 'pg'

const authConfig = {
  database: new Pool(dbConfig),
  user: {
    modelName: 'galrc_user',
  },
  session: {
    modelName: 'galrc_session',
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  account: {
    modelName: 'galrc_account',
  },
  verification: {
    modelName: 'galrc_verification',
  },
  plugins: [admin()],
  emailAndPassword: {
    enabled: true,
  },
  basePath: '/auth',
} satisfies BetterAuthOptions

export const auth = betterAuth(authConfig) as ReturnType<
  typeof betterAuth<typeof authConfig>
>
