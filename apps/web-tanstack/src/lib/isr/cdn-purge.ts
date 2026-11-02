import { ISR_CDN_PURGE_CHANNEL, type IsrCdnPurgeMessage } from "@libs/isr";
import { getRedis } from "@web/lib/redis";

/**
 * CDN 缓存清理（`furin({ cachePurger })` 钩子）。
 *
 * furin 的 ISR 响应带 `Cache-Control: public, max-age=0, s-maxage=<revalidate>,
 * stale-while-revalidate=<revalidate>`：CDN 会在 s-maxage 内直接命中。
 * 数据更新时 `revalidatePath()` / `revalidateTag()` 删掉源站页面产物后，
 * 这里拿到**实际被清掉的 physical paths**，通过 Redis 频道转给 API 进程，
 * 由它用云厂商凭据清边缘缓存 —— web 侧因此不需要任何 CDN 配置，
 * 只保留一条 `REDIS_URL`（与 API 相同的约定）。
 *
 * 说明：Cloudflare 按 URL 精确清理（单批 30 条），带查询串的列表变体无法枚举，
 * 靠 `stale-while-revalidate` 窗口自愈，所以列表页 revalidate 不宜过大。
 */
export async function purgeCdnPaths(paths: readonly string[]): Promise<void> {
	if (paths.length === 0) return;
	const client = getRedis();
	if (!client) {
		console.warn("[isr] Redis 未启用：跳过 CDN 清理通知（仅源站失效）");
		return;
	}
	const message: IsrCdnPurgeMessage = { paths: [...paths] };
	try {
		await client.publish(ISR_CDN_PURGE_CHANNEL, JSON.stringify(message));
	} catch (error) {
		console.error("[isr] 发布 CDN 清理消息失败:", error);
	}
}
