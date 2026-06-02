// import { dbConfig } from '@api/libs/config'
import { type BetterAuthOptions, betterAuth } from 'better-auth'
// import { BunPostgresDialect } from 'kysely-bun-sql'
import { admin, openAPI } from 'better-auth/plugins'
import { localization } from 'better-auth-localization'
import { Pool } from 'pg'

// const dialect = new BunPostgresDialect(dbConfig)
//
const dialect = new Pool({
  connectionString: process.env.DATABASE_URL,
})

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
  plugins: [
    admin(),
    openAPI(),
    localization({
      defaultLocale: 'zh-Hans', // Use built-in Chinese translations
      fallbackLocale: 'default', // Fallback to English
    }),
  ],
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

let _schema: ReturnType<typeof auth.api.generateOpenAPISchema>
const getSchema = async () => (_schema ??= auth.api.generateOpenAPISchema())
export const OpenAPI = {
  getPaths: (prefix = '/auth/api') =>
    getSchema().then(({ paths }) => {
      const reference: typeof paths = Object.create(null)
      for (const path of Object.keys(paths)) {
        const key = prefix + path
        reference[key] = paths[path]
        for (const method of Object.keys(paths[path])) {
          const operation = (reference[key] as any)[method]
          operation.tags = ['Better Auth']
        }
      }
      return reference
    }) as Promise<any>,
  components: getSchema().then(({ components }) => components) as Promise<any>,
} as const
