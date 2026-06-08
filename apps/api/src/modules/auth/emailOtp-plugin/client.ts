import type { BetterAuthClientPlugin } from 'better-auth/client'
import type { emailOtpPlugin } from './index' // make sure to import the server plugin as a type

type EmailOtpPlugin = typeof emailOtpPlugin

export const emailOtpClientPlugin = () => {
  return {
    id: 'emailOtpPlugin',
    $InferServerPlugin: {} as ReturnType<EmailOtpPlugin>,
  } satisfies BetterAuthClientPlugin
}
