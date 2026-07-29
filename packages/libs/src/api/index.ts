import type { app } from '@api'
import { treaty } from '@elysiajs/eden'

const apiHost = process.env.API_HOST || 'http://localhost:3001'

const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 60_000)

const withTimeout: typeof fetch = ((input, init) => {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  // AbortSignal.any may not exist in older runtimes; fall back to timeout-only
  const signal = init?.signal && 'any' in AbortSignal
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
