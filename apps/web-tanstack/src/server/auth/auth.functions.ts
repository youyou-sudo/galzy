import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authServerClient } from './auth.server'

export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { data: session } = await authServerClient.getSession()
    return session
  },
)

export const seedVerification = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ email: z.email() }))
  .handler(async ({ data }) => {
    const { data: res, error } =
      await authServerClient.emailopt.seedverificationemail({
        email: data.email,
        type: 'email-verification',
      })
    return {
      status: res?.success,
      error: error,
    }
  })
