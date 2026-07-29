import type { app } from '@api'
import { treaty } from '@elysiajs/eden'

const apiHost = process.env.API_HOST || 'http://localhost:3001'

const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 30_000)

// Wrap fetch with a timeout AND network error catching.
// Network errors (AbortError, connection refused, DNS failure) are converted
// to synthetic error Responses so Eden Treaty returns structured { data, error }
// instead of throwing an unhandled rejection that crashes the SSR pipeline.
const withTimeout: typeof fetch = (async (input, init) => {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  // Merge request-level signal (e.g. from SSR abort) with our timeout
  const signal =
    init?.signal && 'any' in AbortSignal
      ? AbortSignal.any([init.signal, timeout])
      : timeout
  try {
    return await fetch(input, { ...init, signal })
  } catch (e) {
    // Convert network/abort errors to structured error responses
    // so Eden Treaty can parse them as { data: null, error: { status, value } }
    const message = e instanceof Error ? e.message : String(e)
    const isAbort = e instanceof DOMException && e.name === 'AbortError'
    return new Response(
      JSON.stringify({
        message: isAbort ? 'Request timed out' : 'Backend unreachable',
        detail: message,
      }),
      {
        status: isAbort ? 504 : 502,
        headers: { 'content-type': 'application/json' },
      },
    )
  }
}) as typeof fetch

export const api = treaty<app>(apiHost, {
  fetcher: withTimeout,
  fetch: {
    credentials: 'include',
  },
})
