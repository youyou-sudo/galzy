import type { APP } from '@api'
import { treaty } from '@elysiajs/eden'
import '@web/lib/env'

export const api = treaty<APP>(
  `${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || 3001}`)
