/**
 * ISR / CDN 缓存失效的跨进程契约（web ⇄ api 共用）。
 *
 * 两个进程只通过 **Redis 频道**通信，不引入额外环境变量、内部 HTTP 接口或共享密钥：
 *
 * ```
 * api 写操作 ──publish(galzy:isr:invalidate)──▶ web  ──revalidatePath/Tag──▶ 删页面缓存
 * web 失效结果 ──publish(galzy:isr:cdn-purge)──▶ api  ──Cloudflare──▶ 清 CDN URL
 * ```
 *
 * 这样 web 只需要一条 `REDIS_URL`（和 API 相同的连接配置），
 * Cloudflare 凭据 / 站点域名留在本来就有它们的 API 进程。
 */
export const ISR_INVALIDATE_CHANNEL = "galzy:isr:invalidate";
export const ISR_CDN_PURGE_CHANNEL = "galzy:isr:cdn-purge";

/** api → web：请失效这些页面（逻辑路径，不带域名）。 */
export interface IsrInvalidateMessage {
	paths?: string[];
	tags?: string[];
	/** layout 会连带失效该路径下的子页面 */
	type?: "page" | "layout";
}

/** web → api：这些 URL（physical path）已经失效，请从 CDN 清掉。 */
export interface IsrCdnPurgeMessage {
	paths: string[];
}
