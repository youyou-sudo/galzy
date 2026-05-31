import { createServerFn } from '@tanstack/react-start'
import { authServerClient } from './auth.server'

export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { data: session } = await authServerClient.getSession()
    if (!session) {
      throw new Error('未登陆喵～')
    }
    return session
  },
)
