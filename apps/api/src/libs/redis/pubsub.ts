import {
  ISR_CDN_PURGE_CHANNEL,
  ISR_INVALIDATE_CHANNEL,
  type IsrCdnPurgeMessage,
  type IsrInvalidateMessage,
} from '@libs/isr'
import { RedisClient, redis } from 'bun'
import { purgeCdnUrls } from '../isr-cdn'

/**
 * ISR / CDN 缓存的跨进程通道（与 web 端共用，见 `packages/libs/src/isr.ts`）。
 *
 * - `publishIsrInvalidation()`：数据写完后告诉 web「这些页面/标签失效了」；
 *   web 删掉 Redis 里的 ISR 页面产物，并把实际失效的 URL 回到
 *   `ISR_CDN_PURGE_CHANNEL`；
 * - `startIsrCdnPurgeSubscriber()`：订阅上面回到的 URL，用 Cloudflare 凭据清边缘。
 *
 * 只依赖一条 `REDIS_URL`（Bun 内置客户端会自动读取该变量），和 API
 * 其它 Redis 用法一致。
 */
export async function publishIsrInvalidation(
  message: IsrInvalidateMessage,
): Promise<boolean> {
  try {
    const receivers = await redis.publish(
      ISR_INVALIDATE_CHANNEL,
      JSON.stringify(message),
    )
    return receivers > 0
  } catch (error) {
    console.error('[isr] 发布缓存失效消息失败:', error)
    return false
  }
}

let subscriber: RedisClient | null = null

/** 启动 CDN 清理订阅（API 进程启动时调用一次）；返回取消订阅函数。 */
export async function startIsrCdnPurgeSubscriber(): Promise<() => void> {
  const url = process.env.REDIS_URL
  if (!url) {
    console.warn('[isr] 未配置 REDIS_URL：不订阅 CDN 清理频道')
    return () => {}
  }
  if (subscriber !== null) return () => {}

  const client = new RedisClient(url)
  subscriber = client
  try {
    await client.subscribe(ISR_CDN_PURGE_CHANNEL, (message) => {
      void handleCdnPurge(message)
    })
    console.log(`[isr] 已订阅 CDN 清理频道 ${ISR_CDN_PURGE_CHANNEL}`)
  } catch (error) {
    console.error('[isr] 订阅 CDN 清理频道失败:', error)
    subscriber = null
    client.close()
    return () => {}
  }

  return () => {
    subscriber = null
    void client
      .unsubscribe(ISR_CDN_PURGE_CHANNEL)
      .catch(() => {})
      .finally(() => {
        client.close()
      })
  }
}

async function handleCdnPurge(raw: string): Promise<void> {
  try {
    const message = JSON.parse(raw) as IsrCdnPurgeMessage
    if (Array.isArray(message.paths) && message.paths.length > 0) {
      await purgeCdnUrls(message.paths)
    }
  } catch (error) {
    console.error('[isr] 处理 CDN 清理消息失败:', error)
  }
}
