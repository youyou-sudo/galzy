import { accounts, db, sessions, users, verifications } from '@api/db'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { APIError, type BetterAuthOptions, betterAuth } from 'better-auth'
import { admin, genericOAuth, openAPI } from 'better-auth/plugins'
import { localization } from 'better-auth-localization'
import { emailOtpPlugin } from './emailOtp-plugin'

const readKungalOAuthBody = <T>(body: unknown, status: number): T => {
  if (body === null || typeof body !== 'object') {
    throw new APIError('BAD_REQUEST', {
      message: `Kungal OAuth 返回了非 JSON 响应 (HTTP ${status})`,
    })
  }
  const obj = body as Record<string, unknown>

  // LEGACY: `code` 存在 ⇒ 旧信封
  if (typeof obj.code === 'number') {
    if (obj.code !== 0) {
      throw new APIError('BAD_REQUEST', {
        message: `Kungal OAuth 错误 ${obj.code}: ${String(obj.message ?? '')}`,
      })
    }
    return obj.data as T
  }

  // 标准格式 (RFC 6749)
  if (typeof obj.error === 'string') {
    throw new APIError('BAD_REQUEST', {
      message: `${String(obj.error)}: ${String(obj.error_description ?? '')}`,
    })
  }
  if (status >= 400) {
    throw new APIError('BAD_REQUEST', {
      message: `Kungal OAuth 返回 HTTP ${status}`,
    })
  }
  return obj as T
}

const _authConfig = {
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      galrc_user: users,
      galrc_session: sessions,
      galrc_account: accounts,
      galrc_verification: verifications,
    },
  }),
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
          providerId: 'kungal',
          clientId: process.env.KUNGAL_CLIENT_ID || '',
          clientSecret: process.env.KUNGAL_CLIENT_SECRET || '',
          redirectURI:
            process.env.WEB_HOST + '/api/auth/oauth2/callback/kungal',
          authorizationUrl: 'https://oauth.kungal.com/api/v1/oauth/authorize',
          tokenUrl: 'https://oauth.kungal.com/api/v1/oauth/token',
          scopes: ['openid', 'profile', 'email'],
          pkce: true,
          requireIssuerValidation: true,
          getToken: async ({ code, codeVerifier }) => {
            const redirecturl =
              process.env.WEB_HOST + '/api/auth/oauth2/callback/kungal'
            const res = await fetch(
              'https://oauth.kungal.com/api/v1/oauth/token',
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  grant_type: 'authorization_code',
                  code,
                  redirect_uri: redirecturl,
                  client_id: process.env.KUNGAL_CLIENT_ID || '',
                  client_secret: process.env.KUNGAL_CLIENT_SECRET || '',
                  code_verifier: codeVerifier,
                }),
              },
            )

            const json = await res.json()
            const tokenData = readKungalOAuthBody(json, res.status) as {
              access_token: string
              refresh_token: string
              expires_in: number
            }

            return {
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              accessTokenExpiresAt: new Date(
                Date.now() + tokenData.expires_in * 1000,
              ),
              raw: tokenData,
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
            const userInfo = readKungalOAuthBody(json, res.status) as {
              sub: string
              email: string
              name: string
              picture: string
            }

            return {
              id: userInfo.sub,
              email: userInfo.email,
              name: userInfo.name,
              image: userInfo.picture,
              emailVerified: true,
            }
          },
        },
        {
          providerId: 'linuxdo',
          clientId: process.env.LINUXDO_CLIENT_ID || '',
          clientSecret: process.env.LINUXDO_CLIENT_SECRET || '',
          authorizationUrl: 'https://connect.linux.do/oauth2/authorize',
          redirectURI:
            process.env.WEB_HOST + '/api/auth/oauth2/callback/linuxdo',
          tokenUrl: 'https://connect.linux.do/oauth2/token',
          scopes: ['openid', 'profile', 'email'],
          pkce: true,
          getToken: async ({ code, codeVerifier }) => {
            const redirecturl =
              process.env.WEB_HOST + '/api/auth/oauth2/callback/linuxdo'
            const res = await fetch('https://connect.linux.do/oauth2/token', {
              method: 'POST',
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirecturl,
                client_id: process.env.LINUXDO_CLIENT_ID || '',
                client_secret: process.env.LINUXDO_CLIENT_SECRET || '',
                ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
              }),
            })

            if (!res.ok) {
              const err = await res.json()
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
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      redirectURI: process.env.WEB_HOST + '/api/auth/callback/github',
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      redirectURI: process.env.WEB_HOST + '/api/auth/callback/discord',
      mapProfileToUser: (profile) => ({
        email: profile.email ?? `${profile.id}@discord.placeholder.local`,
      }),
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      redirectURI: process.env.WEB_HOST + '/api/auth/callback/twitter',
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
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['CF-Connecting-IP', 'X-Forwarded-For'],
      trustedProxies: ['::1', '127.0.0.1'],
    },
  },
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
