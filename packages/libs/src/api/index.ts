import type { app } from '@api'
import { treaty } from '@elysiajs/eden'

const apiHost = process.env.API_HOST || 'http://localhost:3001'

const withTimeout: typeof fetch = ((input, init) => {
  const timeout = AbortSignal.timeout(
    Number(process.env.FETCH_TIMEOUT_MS ?? 60_000),
  )
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout

  return fetch(input, { ...init, signal })
}) as typeof fetch

export const api = treaty<app>(apiHost, {
  fetcher: withTimeout,
  fetch: {
    credentials: 'include',
  },
})
