import type { app } from '@api'
import { treaty } from '@elysiajs/eden'

const apiHost = process.env.API_HOST || 'http://localhost:3001'

export const api = treaty<app>(apiHost, {
  fetch: {
    credentials: 'include',
  },
})
