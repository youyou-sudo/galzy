import { dbConfig } from '@api/libs/config'
import { betterAuth, type BetterAuthOptions } from "better-auth";
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
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://galzy.eu.org',
  ],

  basePath: '/auth',
} satisfies BetterAuthOptions

export const auth = betterAuth(authConfig) as ReturnType<
  typeof betterAuth<typeof authConfig>
>
