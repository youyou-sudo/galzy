import { RedisClient, redis } from "bun";

/**
 * Web 端 Redis 连接（与 API 后端保持同一套约定）：
 * - 只认一个 `REDIS_URL`（Bun 内置客户端自动读取，写法同 `apps/api/src/libs/redis`）；
 * - 生产默认启用；本地开发默认禁用（ISR 缓存用进程内实现），
 *   需要调试时设 `REDIS_ENABLED=true`；
 * - 订阅要走独立连接（Redis 进入 subscribe 模式后不能再跑普通命令）。
 */
const isProduction = process.env.NODE_ENV === "production";

export const redisEnabled =
	process.env.REDIS_ENABLED !== undefined
		? process.env.REDIS_ENABLED === "true"
		: isProduction && Boolean(process.env.REDIS_URL);

/** 普通命令用的客户端（Bun 默认客户端，按 REDIS_URL 连接）。 */
export function getRedis(): RedisClient | null {
	return redisEnabled ? redis : null;
}

/** 订阅用的独立连接；调用方负责在进程退出时关闭。 */
export function createRedisSubscriber(): RedisClient | null {
	const url = process.env.REDIS_URL;
	if (!redisEnabled || !url) return null;
	return new RedisClient(url);
}
