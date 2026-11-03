import "@teyik0/furin/server-only";
import { getRequestHeader, getRequestScoped } from "@web/lib/request-context";
import { authServerClient } from "./auth.server";

/**
 * 服务端会话读取（**仅当前请求内**的请求合并，不做任何跨请求缓存）。
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
 * - 合并只发生在**当前请求**内：同一次请求里同一份 cookie 只查一次
 *   （并发调用共享同一个 Promise，串行调用直接复用结果）；请求结束随 store
 *   丢弃，下一次请求重新校验（会话撤销/角色变更立即生效，没有 TTL 缓存）；
 * - 失败统一降级为 null，不留在请求内（下一次调用重试）。
 */
type ServerSession = NonNullable<
	Awaited<ReturnType<typeof authServerClient.getSession>>["data"]
>;

type SessionFlights = Map<string, Promise<ServerSession | null>>;

const SESSION_FLIGHTS = Symbol("galzy.server-session.flights");

/** 只保留 better-auth 的 cookie：会话结果只取决于这几个值。 */
function sessionCookieKey(): string | null {
	const cookie = getRequestHeader("Cookie");
	if (!cookie) return null;
	const matched = cookie.match(/(?:^|; )((?:__Secure-)?better-auth\.[^;]+)/g);
	if (!matched) return null;
	return matched.map((item) => item.replace(/^; /, "")).join("; ");
}

function sessionFlights(): SessionFlights {
	// 挂在请求上下文上：请求结束即丢弃，绝不跨请求缓存
	return getRequestScoped(SESSION_FLIGHTS, () => new Map());
}

/**
 * 读取当前请求的会话（未登录返回 null）。
 *
 * 服务端 BFF / loader 请优先用它，而不是直接 `authServerClient.getSession()`。
 */
export async function getServerSession(): Promise<ServerSession | null> {
	const key = sessionCookieKey();
	if (!key) return null;

	const flights = sessionFlights();
	const running = flights.get(key);
	if (running) return running;

	const pending = (async () => {
		try {
			const { data } = await authServerClient.getSession();
			return data ?? null;
		} catch {
			// 网络异常/上游 5xx：按未登录处理，别把整页拖挂；
			// 失败不留在请求内，下一次调用重试
			flights.delete(key);
			return null;
		}
	})();

	flights.set(key, pending);
	return pending;
}
