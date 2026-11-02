import "@teyik0/furin/server-only";
import { getRequestHeader } from "@web/lib/request-context";
import { authServerClient } from "./auth.server";

/**
 * 服务端会话读取（带进程内短缓存 + 并行请求合并）。
 *
 * ## 为什么需要它
 *
 * 后台与列表页的服务端取数路径里有不少「顺带查一下会话」：`getTopics` /
 * `getTopic` 要 userId、`getFileList` 要判断管理员、后台 `_route` 守卫要判角色。
 * 这些函数在**同一次页面访问**里会被调用很多次（首屏 loader + 视口预取每条
 * 详情页各一次），如果每次都 `web → API → get-session`，登录用户一次刷新就会
 * 打出十几次会话请求；cookieCache 过期时每次还是数据库查询（远端库 250~500ms），
 * 并发下很容易把连接池打满，页面整体变慢 —— 匿名用户没有会话 cookie，直接短路，
 * 所以只有登录用户能感受到。
 *
 * ## 语义
 *
 * - 没有 better-auth cookie：直接判定未登录，**不发请求**；
 * - 15s 内同一份 cookie 复用结果（会话撤销/角色变更最多延迟 15s，接口侧仍有
 *   `isAdmin` 等二次校验；登录/登出会换 cookie，缓存键随之失效）；
 * - 同一 cookie 的并发请求合并成一次（single-flight），避免预取风暴同时打 DB；
 * - 失败不缓存（下一请求重试），异常统一降级为 null。
 */
type ServerSession = NonNullable<
	Awaited<ReturnType<typeof authServerClient.getSession>>["data"]
>;

const CACHE_TTL_MS = 15_000;
const MAX_ENTRIES = 512;

type CacheEntry = { expiresAt: number; session: ServerSession | null };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ServerSession | null>>();

/** 只保留 better-auth 的 cookie：会话结果只取决于这几个值。 */
function sessionCookieKey(): string | null {
	const cookie = getRequestHeader("Cookie");
	if (!cookie) return null;
	const matched = cookie.match(/(?:^|; )((?:__Secure-)?better-auth\.[^;]+)/g);
	if (!matched) return null;
	return matched.map((item) => item.replace(/^; /, "")).join("; ");
}

function readCache(key: string): ServerSession | null | undefined {
	const entry = cache.get(key);
	if (!entry) return undefined;
	if (entry.expiresAt <= Date.now()) {
		cache.delete(key);
		return undefined;
	}
	return entry.session;
}

function writeCache(key: string, session: ServerSession | null): void {
	cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, session });
	if (cache.size <= MAX_ENTRIES) return;
	// Map 保持插入顺序：淘汰最旧的一条即可
	const oldest = cache.keys().next().value;
	if (oldest !== undefined) cache.delete(oldest);
}

/**
 * 读取当前请求的会话（未登录返回 null）。
 *
 * 服务端 BFF / loader 请优先用它，而不是直接 `authServerClient.getSession()`。
 */
export async function getServerSession(): Promise<ServerSession | null> {
	const key = sessionCookieKey();
	if (!key) return null;

	const cached = readCache(key);
	if (cached !== undefined) return cached;

	const running = inflight.get(key);
	if (running) return running;

	const pending = (async () => {
		try {
			const { data } = await authServerClient.getSession();
			return data ?? null;
		} catch {
			// 网络异常/上游 5xx：按未登录处理，别把整页拖挂
			return null;
		}
	})()
		.then((session) => {
			writeCache(key, session);
			return session;
		})
		.finally(() => {
			inflight.delete(key);
		});

	inflight.set(key, pending);
	return pending;
}
