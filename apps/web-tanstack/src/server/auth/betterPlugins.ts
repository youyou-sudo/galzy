import { emailOtpClientPlugin } from '@api/modules/auth/emailOtp-plugin/client'
import type { BetterAuthPlugin } from 'better-auth'
import { adminClient, genericOAuthClient } from 'better-auth/client/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

export const betterPlugins = [
  adminClient(),
  tanstackStartCookies(),
  genericOAuthClient(),
  emailOtpClientPlugin(),
] as const satisfies BetterAuthPlugin[]
