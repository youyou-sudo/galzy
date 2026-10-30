/**
 * 极简 CDP（Chrome DevTools Protocol）客户端 —— 只用 Bun 内置 WebSocket。
 *
 * 目的：不引入 playwright / puppeteer，直接驱动本机 msedge / chrome 的
 * --remote-debugging-port，实现页面截图与 DOM 抓取。
 *
 * 仅实现 parity 工具需要的部分：导航、等待、截图、求值、事件订阅。
 */

export type Json = unknown

type Pending = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
  method: string
}

type EventHandler = (params: Record<string, unknown>) => void

/** 单条 CDP 命令失败（协议错误或超时）。 */
export class CdpError extends Error {
  method: string
  code?: number
  constructor(method: string, message: string, code?: number) {
    super('CDP ' + method + ' 失败: ' + message)
    this.name = 'CdpError'
    this.method = method
    this.code = code
  }
}

export class CdpClient {
  private ws: WebSocket
  private seq = 0
  private pending = new Map<number, Pending>()
  private handlers = new Map<string, Set<EventHandler>>()
  private closed = false
  private closeReason = ''

  private constructor(ws: WebSocket) {
    this.ws = ws
    ws.addEventListener('message', (event: MessageEvent) => {
      this.onMessage(typeof event.data === 'string' ? event.data : '')
    })
    ws.addEventListener('close', () => {
      this.closed = true
      this.closeReason = '连接关闭'
      for (const [id, p] of this.pending) {
        clearTimeout(p.timer)
        p.reject(new CdpError(p.method, '连接已关闭'))
        this.pending.delete(id)
      }
    })
  }

  /** 建立到某个 target 的 WebSocket 连接。 */
  static async connect(wsUrl: string, timeoutMs = 20000): Promise<CdpClient> {
    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        try {
          ws.close()
        } catch {
          /* ignore */
        }
        reject(new Error('连接 CDP WebSocket 超时: ' + wsUrl))
      }, timeoutMs)
      ws.addEventListener(
        'open',
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true },
      )
      ws.addEventListener(
        'error',
        (event: Event & { message?: string }) => {
          clearTimeout(timer)
          reject(new Error('连接 CDP WebSocket 失败: ' + (event?.message ?? wsUrl)))
        },
        { once: true },
      )
    })
    return new CdpClient(ws)
  }

  private onMessage(raw: string): void {
    if (!raw) return
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }
    const id = msg.id
    if (typeof id === 'number') {
      const pending = this.pending.get(id)
      if (!pending) return
      this.pending.delete(id)
      clearTimeout(pending.timer)
      const error = msg.error as { message?: string; code?: number } | undefined
      if (error) {
        pending.reject(new CdpError(pending.method, error.message ?? 'unknown', error.code))
      } else {
        pending.resolve(msg.result)
      }
      return
    }
    const method = msg.method
    if (typeof method === 'string') {
      const set = this.handlers.get(method)
      if (!set) return
      const params = (msg.params ?? {}) as Record<string, unknown>
      for (const handler of set) {
        try {
          handler(params)
        } catch {
          /* 事件回调中的异常不能影响协议流 */
        }
      }
    }
  }

  /** 发送一条命令并等待结果。 */
  send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 30000,
  ): Promise<T> {
    if (this.closed) {
      return Promise.reject(new CdpError(method, '连接已关闭 ' + this.closeReason))
    }
    const id = ++this.seq
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new CdpError(method, '等待结果超时（' + timeoutMs + 'ms）'))
      }, timeoutMs)
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
        method,
      })
      try {
        this.ws.send(JSON.stringify({ id, method, params }))
      } catch (error) {
        this.pending.delete(id)
        clearTimeout(timer)
        reject(new CdpError(method, String(error)))
      }
    })
  }

  /** 订阅一个 CDP 事件，返回取消订阅函数。 */
  on(method: string, handler: EventHandler): () => void {
    let set = this.handlers.get(method)
    if (!set) {
      set = new Set()
      this.handlers.set(method, set)
    }
    set.add(handler)
    return () => {
      set?.delete(handler)
    }
  }

  /** 等待一个 CDP 事件（可带条件与超时）。 */
  waitFor(
    method: string,
    options: { predicate?: (params: Record<string, unknown>) => boolean; timeoutMs?: number } = {},
  ): Promise<Record<string, unknown>> {
    const timeoutMs = options.timeoutMs ?? 30000
    return new Promise((resolve, reject) => {
      let off = () => {}
      const timer = setTimeout(() => {
        off()
        reject(new CdpError(method, '等待事件超时（' + timeoutMs + 'ms）'))
      }, timeoutMs)
      off = this.on(method, (params) => {
        if (options.predicate && !options.predicate(params)) return
        clearTimeout(timer)
        off()
        resolve(params)
      })
    })
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    try {
      this.ws.close()
    } catch {
      /* ignore */
    }
  }
}

/** 轮询 HTTP 端点直到可用（启动浏览器后等待调试端口就绪）。 */
export async function waitForEndpoint(
  url: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? 20000
  const intervalMs = options.intervalMs ?? 100
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (response.ok) return await response.json()
      lastError = new Error('HTTP ' + response.status)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error('等待端点 ' + url + ' 超时: ' + String(lastError))
}

export type PageTarget = {
  id: string
  type: string
  url: string
  title: string
  webSocketDebuggerUrl: string
}

/** 列出浏览器当前 target，返回第一个 page 类型的可控 target。 */
export async function findPageTarget(port: number): Promise<PageTarget> {
  const list = (await waitForEndpoint('http://127.0.0.1:' + port + '/json/list', {
    timeoutMs: 30000,
  })) as PageTarget[]
  const page = list.find((target) => target.type === 'page' && target.webSocketDebuggerUrl)
  if (!page) throw new Error('没有找到可用的 page target（headless 浏览器未就绪）')
  return page
}
