import { redirect } from "@tanstack/react-router";

// Eden Treaty error shape: { status: number, value: unknown }
interface EdenError {
  status: number
  value: unknown
}

const isEdenError = (e: unknown): e is EdenError =>
  e !== null && typeof e === 'object' && 'status' in e && 'value' in e

const toMessage = (v: unknown): string => {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && 'message' in v) return String((v as Record<string, unknown>).message)
  return JSON.stringify(v)
}

export const elysiaErrorF = (error: unknown) => {
  if (!isEdenError(error)) return
  const msg = toMessage(error.value)
  switch (error.status) {
    case 400:
    case 401:
      throw redirect({ to: '/auth/login' })
    case 403:
      throw { status: error.status, message: msg }
    case 429:
      throw { status: error.status, message: msg }
    case 500:
    case 502:
      throw { status: error.status, message: msg }
    default:
      throw { status: error.status ?? 500, message: msg || 'Unknown error' }
  }
}
