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

/**
 * 带 HTTP 状态码的 API 错误。
 *
 * 注意：TanStack Start 的 server fn 错误协议（ShallowErrorPlugin）跨进程
 * 往返时只保留 `message`，`status` 在客户端不可用 —— 调用方不要依赖
 * `error.status`，仅使用 `error.message`。
 */
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * 将 Eden 错误转为可抛出的 ApiError。
 *
 * 不抛 redirect：server fn 中抛出的 redirect 会被 TanStack Start 以无
 * content-type 的 307 Response 原样透传，客户端 serverFnFetcher 随即触发
 * invariant() 失败（"Invariant failed"），真实错误被掩盖。
 */
export const elysiaErrorF = (error: unknown) => {
  if (!isEdenError(error)) return
  const msg = toMessage(error.value)
  throw new ApiError(error.status ?? 500, msg || 'Unknown error')
}
