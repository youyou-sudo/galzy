import { getKvTime, setKv } from '@api/libs'
import { emailServer } from '@api/libs/seedMail'
import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'

export const emailOtpPlugin = () =>
  ({
    id: 'emailOtpPlugin',
    endpoints: {
      seedVerificationEmail: createAuthEndpoint(
        '/emailopt/seedverificationemail',
        {
          method: 'POST',
          body: z.object({
            email: z.email(),
            type: z.enum(['sign-in', 'email-verification', 'reset-password']),
          }),
        },
        async (ctx) => {
          const { email, type } = ctx.body
          const kvKey = `${type}-${email}`
          const ttl = await getKvTime(kvKey)
          if (ttl && ttl > 0) {
            throw new APIError('TOO_MANY_REQUESTS', {
              message: `请求过于频繁，请 ${ttl}s 后再试`,
            })
          }

          const otp = Math.floor(100000 + Math.random() * 900000).toString()

          await ctx.context.internalAdapter.deleteVerificationByIdentifier(
            kvKey,
          )

          await ctx.context.internalAdapter.createVerificationValue({
            identifier: kvKey,
            value: String(otp),
            expiresAt: new Date(Date.now() + 300 * 1000),
          })

          await setKv(kvKey, '1', 60)

          const user = await ctx.context.internalAdapter.findUserByEmail(email)
          if (!user) {
            throw new APIError('BAD_REQUEST', {
              message: '用户没找到喵～',
            })
          }
          if (user.user.emailVerified) {
            throw new APIError('BAD_REQUEST', {
              message: '用户验证过了喵～',
            })
          }
          // 发送邮件
          await emailServer.send({
            from: '紫缘社 <verify@outbound.galzy.moe>',
            to: email,
            subject: '紫缘社注册验证码喵～',
            text: `您的验证码是 ${otp} 喵～，有效期 5 分钟喵，请不要告诉别人喵～`,
          })

          return ctx.json({ success: true })
        },
      ),
      verificationEmail: createAuthEndpoint(
        '/emailopt/emailverificationtop',
        {
          method: 'POST',
          body: z.object({
            email: z.email(),
            type: z.enum(['sign-in', 'email-verification', 'reset-password']),
            otp: z.string(),
          }),
        },
        async (ctx) => {
          const { email, type, otp } = ctx.body

          const kvKey = `${type}-${email}`

          const isValid =
            await ctx.context.internalAdapter.findVerificationValue(kvKey)

          if (isValid?.value !== otp) {
            throw new APIError('BAD_REQUEST', {
              message: '这个 OTP 不太对喵～',
            })
          }
          if (!isValid) {
            throw new APIError('BAD_REQUEST', {
              message: '这个 OTP 不太对喵～',
            })
          }
          if (isValid?.expiresAt < new Date()) {
            await ctx.context.internalAdapter.deleteVerificationByIdentifier(
              kvKey,
            )
            throw new APIError('BAD_REQUEST', {
              message: '这个 OTP 过期了喵～',
            })
          }

          const user = await ctx.context.internalAdapter.findUserByEmail(email)
          if (!user) {
            throw new APIError('BAD_REQUEST', {
              message: '没找到这个邮箱的用户喵～',
            })
          }

          await ctx.context.internalAdapter.consumeVerificationValue(kvKey)
          const updatedUser = await ctx.context.internalAdapter.updateUser(
            user.user.id,
            {
              email,
              emailVerified: true,
            },
          )
          await ctx.context.options.emailVerification?.afterEmailVerification?.(
            updatedUser,
            ctx.request,
          )
          const session = await ctx.context.internalAdapter.createSession(
            updatedUser.id,
          )
          await setSessionCookie(ctx, {
            session,
            user: updatedUser,
          })
          return ctx.json({
            status: true,
            token: session.token,
            user: updatedUser,
          })
        },
      ),
    },
  }) satisfies BetterAuthPlugin
