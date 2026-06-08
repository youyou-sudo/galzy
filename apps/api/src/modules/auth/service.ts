// import { dbConfig } from '@api/libs/config'

import { getKvTime, setKv } from '@api/libs'
import { emailServer } from '@api/libs/seedMail'
import { type BetterAuthOptions, betterAuth } from 'better-auth'
// import { BunPostgresDialect } from 'kysely-bun-sql'
import { admin, emailOTP, genericOAuth, openAPI } from 'better-auth/plugins'
import { localization } from 'better-auth-localization'
import { status } from 'elysia'
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
    // emailOTP({
    //   overrideDefaultEmailVerification: true,
    //   disableSignUp: true,
    //   async sendVerificationOTP({ email, otp, type }) {
    //     const otpTtl = await getKvTime(email)

    //     console.log(otpTtl)
    //     if (otpTtl && otpTtl < 0)
    //       throw status(429, `请求过于频繁，请 ${otpTtl}s 后再试`)

    //     if (type === 'sign-in') return
    //     if (type === 'email-verification') {
    //       // Send the OTP for email verification
    //       // void (await emailServer.send({
    //       //   from: '紫缘社 <verify@outbound.galzy.moe>',
    //       //   to: email,
    //       //   subject: '紫缘社注册验证码喵～',
    //       //   text: `您的验证码是 ${otp} 喵～，有效期 5 分钟喵，请不要告诉别人喵～`,
    //       // }))
    //       await setKv(email, email, 60)
    //     }
    //   },
    // }),
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
      ],
    }),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
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
