import type { app } from '@api'
import { treaty } from '@elysiajs/eden'
import '@web/lib/env'

export const api = treaty<app>(
  `${process.env.API_HOST || 'localhost'}:${process.env.API_PORT || 3001}`)
