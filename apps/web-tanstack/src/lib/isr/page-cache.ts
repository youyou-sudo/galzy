import { redisPageCache } from "@teyik0/furin/cache/redis";
import { getRedis } from "@web/lib/redis";

/**
 * ISR / SSG 页面缓存后端。
 *
 * furin 默认把 public 页面产物缓存在**进程内**：单实例够用，但重启即清空、
 * 多副本之间也不共享。线上要「ISR + CDN」两层缓存，服务端这层也应该落 Redis：
 * - 重启/滚动发布后热页面仍是命中态，不会瞬间全部回源；
 * - 多个 web 副本共享同一份页面缓存，失效只需要一条 `revalidatePath`。
 *
 * 连接配置与 API 后端一致：只认一条 `REDIS_URL`（Bun 内置客户端）。
 * Redis 未启用时返回 undefined（furin 回落到进程内缓存），本地开发不需要
 * Redis 也能跑，只是失效只在当前进程内生效。
 */
export function createPageCache() {
	const client = getRedis();
	if (!client) {
		console.warn(
			"[isr] Redis 未启用（REDIS_URL / REDIS_ENABLED）：ISR 页面缓存使用进程内实现（重启即失效、多副本不共享）",
		);
		return undefined;
	}
	try {
		return redisPageCache({
			client,
			namespace: "galzy:furin:pages",
			// 页面产物比会话/列表缓存命长：7 天足够覆盖一个发布周期
			retentionMs: 7 * 24 * 60 * 60 * 1000,
		});
	} catch (error) {
		console.error("[isr] 初始化 Redis 页面缓存失败，回落到进程内缓存：", error);
		return undefined;
	}
}
