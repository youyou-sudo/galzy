import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authServerClient } from './auth.server'

export const getSession = createServerFn({ method: 'GET' })
  .inputValidator(z.object({}))
  .handler(async () => {
    const { data: session } = await authServerClient.getSession()

    return session
  })

export const ensureSession = createServerFn({ method: 'GET' })
  .inputValidator(z.object({}))
  .handler(async () => {
    const { data: session } = await authServerClient.getSession()

    if (!session) {
      throw new Error('Unauthorized')
    }

    return session
  })
