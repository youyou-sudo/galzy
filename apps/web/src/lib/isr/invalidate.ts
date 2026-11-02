import { ISR_INVALIDATE_CHANNEL, type IsrInvalidateMessage } from "@libs/isr";
import { revalidatePath, revalidateTag } from "@teyik0/furin";
import { createRedisSubscriber } from "@web/lib/redis";

/**
 * 订阅缓存失效频道（`galzy:isr:invalidate`）。
 *
 * API 的数据写操作成功后 publish 一条消息到这里，web 侧调用 furin 的
 * `revalidatePath()` / `revalidateTag()`：
 * - 删掉 Redis 里的 ISR 页面产物（下一次请求重新生成）；
 * - 触发 `cachePurger`（`isr/cdn-purge.ts`），把实际失效的 URL 通过
 *   `galzy:isr:cdn-purge` 频道转给 API 去清 CDN。
 *
 * 只用一条 `REDIS_URL`，不需要内部 HTTP 接口 / 共享密钥。
 *
 * 返回取消订阅函数；进程退出时由调用方关闭连接。
 */
export async function startIsrInvalidation(): Promise<() => void> {
	const client = createRedisSubscriber();
	if (!client) {
		console.warn(
			"[isr] Redis 未启用：不订阅缓存失效频道（页面只能按 revalidate TTL 更新）",
		);
		return () => {};
	}

	try {
		await client.subscribe(ISR_INVALIDATE_CHANNEL, (message) => {
			void handleInvalidate(message);
		});
		console.log(`[isr] 已订阅缓存失效频道 ${ISR_INVALIDATE_CHANNEL}`);
	} catch (error) {
		console.error("[isr] 订阅缓存失效频道失败:", error);
		return () => {};
	}

	return () => {
		void client
			.unsubscribe(ISR_INVALIDATE_CHANNEL)
			.catch(() => {})
			.finally(() => {
				client.close();
			});
	};
}

async function handleInvalidate(raw: string): Promise<void> {
	try {
		const message = JSON.parse(raw) as IsrInvalidateMessage;
		const type = message.type === "layout" ? "layout" : "page";
		for (const path of message.paths ?? []) {
			if (path) await revalidatePath(path, type);
		}
		if (message.tags !== undefined && message.tags.length > 0) {
			await revalidateTag(message.tags);
		}
	} catch (error) {
		console.error("[isr] 处理缓存失效消息失败:", error);
	}
}
