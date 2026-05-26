import { dbConfig } from '@api/libs/config'
import { type BetterAuthOptions, betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { BunPostgresDialect } from 'kysely-bun-sql'

const dialect = new BunPostgresDialect(dbConfig)

const _authConfig = {
  database: dialect,
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
    'https://www.galzy.eu.org',
    'https://www.galzy.moe',
    'https://galzy.moe',
  ],

  basePath: '/auth',
} satisfies BetterAuthOptions

export const auth = betterAuth(_authConfig)
