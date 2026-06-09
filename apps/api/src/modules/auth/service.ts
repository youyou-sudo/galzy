// import { dbConfig } from '@api/libs/config'

import { APIError, type BetterAuthOptions, betterAuth } from 'better-auth'
// import { BunPostgresDialect } from 'kysely-bun-sql'
import { admin, genericOAuth, openAPI } from 'better-auth/plugins'
import { localization } from 'better-auth-localization'
import { Pool } from 'pg'
import { emailOtpPlugin } from './emailOtp-plugin'

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
    emailOtpPlugin(),
    genericOAuth({
      config: [
        {
          providerId: 'kun-oauth',
          clientId: process.env.KUN_CLIENT_ID || '',
          clientSecret: process.env.KUN_CLIENT_SECRET || '',
          authorizationUrl: 'https://oauth.kungal.com/api/v1/oauth/authorize',
          tokenUrl: 'https://oauth.kungal.com/api/v1/oauth/token',
          scopes: ['openid', 'profile', 'email'],
          pkce: true,
          getToken: async ({ code, redirectURI, codeVerifier }) => {
            const res = await fetch(
              'https://oauth.kungal.com/api/v1/oauth/token',
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  grant_type: 'authorization_code',
                  code,
                  redirect_uri: redirectURI,
                  client_id: process.env.KUN_CLIENT_ID || '',
                  client_secret: process.env.KUN_CLIENT_SECRET || '',
                  code_verifier: codeVerifier,
                }),
              },
            )

            const json = await res.json()

            if (json.code !== 0) {
              throw new Error(json.message)
            }

            return {
              accessToken: json.data.access_token,
              refreshToken: json.data.refresh_token,
              accessTokenExpiresAt: new Date(
                Date.now() + json.data.expires_in * 1000,
              ),
              raw: json.data,
            }
          },

          getUserInfo: async (tokens) => {
            const res = await fetch(
              'https://oauth.kungal.com/api/v1/oauth/userinfo',
              {
                headers: {
                  Authorization: `Bearer ${tokens.accessToken}`,
                },
              },
            )

            const json = await res.json()

            if (json.code !== 0) {
              throw new Error(json.message)
            }

            return {
              id: json.data.sub,
              email: json.data.email,
              name: json.data.name,
              image: json.data.picture,
              emailVerified: true,
            }
          },
        },
        {
          providerId: 'linuxdo',
          clientId: process.env.LINUXDO_CLIENT_ID || '',
          clientSecret: process.env.LINUXDO_CLIENT_SECRET || '',
          authorizationUrl: 'https://connect.linux.do/oauth2/authorize',
          tokenUrl: 'https://connect.linux.do/oauth2/token',
          scopes: ['openid', 'profile', 'email'],
          pkce: true,
          getToken: async ({ code, redirectURI, codeVerifier }) => {
            const res = await fetch('https://connect.linux.do/oauth2/token', {
              method: 'POST',
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectURI,
                client_id: process.env.LINUXDO_CLIENT_ID || '',
                client_secret: process.env.LINUXDO_CLIENT_SECRET || '',
                ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
              }),
            })

            if (!res.ok) {
              const err = await res.json()
              console.log(err)
              throw new APIError('BAD_REQUEST', {
                message: err.error || 'OAuth token 获取失败',
              })
            }

            const json = await res.json()

            return {
              accessToken: json.access_token,
              refreshToken: json.refresh_token,
              accessTokenExpiresAt: new Date(
                Date.now() + json.expires_in * 1000,
              ),
              raw: json,
            }
          },
          getUserInfo: async (tokens) => {
            const res = await fetch('https://connect.linux.do/api/user', {
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            })

            if (!res.ok) {
              const err = await res.json()
              throw new Error(
                err.error_description || err.error || '用户信息请求失败',
              )
            }

            const json = await res.json()

            return {
              id: json.sub,
              email: json.email,
              name: json.name || json.username || json.login,
              image: json.avatar_url,
              emailVerified: true,
            }
          },
        },
      ],
    }),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      redirectURI: process.env.WEB_HOST + '/api/auth/callback/github',
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      redirectURI: process.env.WEB_HOST + '/api/auth/callback/discord',
      mapProfileToUser: (profile) => ({
        email: profile.email ?? `${profile.id}@discord.placeholder.local`,
      }),
    },
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
  getPaths: (prefix = '/auth') =>
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
