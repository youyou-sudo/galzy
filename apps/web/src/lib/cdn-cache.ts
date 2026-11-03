import { isPersonalizedPath } from "@web/lib/is-personalized-path";

/**
 * 公开页面的 CDN 缓存策略。
 *
 * 源站**不做任何页面缓存**：每个请求都实时 SSR（数据直连 DB / Meilisearch）。
 * 但公开页面的内容在两次数据更新之间是固定的，所以允许 CDN（Cloudflare）
 * 在边缘缓存 HTML：
 *
 * ```
 * Cache-Control: public, max-age=0, s-maxage=<N>, stale-while-revalidate=<N>
 * ```
 *
 * - `s-maxage`：CDN 缓存时长；过期后回源（源站仍然实时渲染）。
 * - `stale-while-revalidate`：后台异步回源，用户不等待。
 * - `max-age=0`：浏览器不缓存，避免用户看到旧页面。
 *
 * 数据更新时由 API 调 Cloudflare purge API 主动清 URL（见
 * `apps/api/src/libs/cloudflare-cache.ts`）；列表页的查询串变体无法枚举，
 * 依赖较短的 s-maxage 自愈。
 *
 * 实时 / 个性化页面（评论、后台、用户中心、登录、创建编辑）返回 `no-store`，
 * 不进 CDN —— 由 {@link isCdnBypassed} 判定。
 */
export type CdnCacheRule = {
  /** CDN 缓存秒数。 */
  sMaxAge: number;
  /** 过期后允许继续返回旧副本、后台回源的秒数。 */
  staleWhileRevalidate: number;
};

const rule = (sMaxAge: number, staleWhileRevalidate = sMaxAge): CdnCacheRule => ({
  sMaxAge,
  staleWhileRevalidate,
});

const EXACT_RULES: Readonly<Record<string, CdnCacheRule>> = {
  "/": rule(60),
  "/games": rule(60, 120),
  "/search": rule(60, 120),
  "/tags": rule(120, 120),
  "/collections": rule(120, 120),
  "/producer": rule(300),
  "/topics": rule(60, 120),
  "/friend-links": rule(300),
  "/contact": rule(3600),
  "/tools": rule(3600),
  "/tools/plate": rule(3600),
  "/openapi": rule(3600),
};

function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

/** 明确不进 CDN 的路径：接口、框架端点、个性化页、评论（实时）。 */
export function isCdnBypassed(pathname: string): boolean {
  const path = normalize(pathname);
  if (path === "/api" || path.startsWith("/api/")) return true;
  if (path === "/_furin" || path.startsWith("/_furin/")) return true;
  if (isPersonalizedPath(path)) return true;
  // 评论页签由 loader 直取评论，属于实时内容，不能进 CDN。
  if (path.endsWith("/comment")) return true;
  // 错误页/静态资源不是可缓存页面。
  if (path === "/error" || path === "/not-found") return true;
  if (path.includes(".")) return true;
  return false;
}

/**
 * 返回该路径的 CDN 缓存规则；`null` 表示不进 CDN（保持 furin 的 `no-store`）。
 */
export function cdnCacheRuleFor(pathname: string): CdnCacheRule | null {
  const path = normalize(pathname);
  if (isCdnBypassed(path)) return null;

  const exact = EXACT_RULES[path];
  if (exact) return exact;

  // 标签分类 / 标签详情
  if (/^\/tags\/category\/[^/]+$/.test(path)) return rule(300);
  if (/^\/tags\/[^/]+$/.test(path)) return rule(300);
  // 合集详情
  if (/^\/collections\/[^/]+$/.test(path)) return rule(300);
  // 厂商详情
  if (/^\/producer\/[^/]+$/.test(path)) return rule(300);
  // 论坛主题详情
  if (/^\/topics\/[^/]+$/.test(path)) return rule(120);
  // 游戏详情页签：/[id]、/[id]/introduction(/[articleId])、/[id]/relations、/[id]/translate
  if (/^\/[^/]+$/.test(path)) return rule(300);
  if (/^\/[^/]+\/(introduction|relations|translate)(\/.*)?$/.test(path)) {
    return rule(300);
  }

  return null;
}

/**
 * 把 furin 的 `no-store` 文档响应改写为 CDN 可缓存的响应头。
 *
 * 只处理 200 的 GET/HEAD 文档请求：
 * - `?_furin=data` 是站内切页数据请求，不是文档，保持 no-store；
 * - 带 `Set-Cookie` 的响应（个性化/会话）不进共享缓存；
 * - 其余按 {@link cdnCacheRuleFor} 设置 `Cache-Control`。
 */
export function applyCdnCacheHeaders(
  request: Request,
  response: Response,
): Response {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return response;
  if (response.status !== 200) return response;

  const url = new URL(request.url);
  if (url.searchParams.has("_furin")) return response;
  if (response.headers.has("set-cookie")) return response;

  const cacheRule = cdnCacheRuleFor(url.pathname);
  if (!cacheRule) return response;

  const headers = new Headers(response.headers);
  headers.set(
    "cache-control",
    `public, max-age=0, s-maxage=${cacheRule.sMaxAge}, stale-while-revalidate=${cacheRule.staleWhileRevalidate}`,
  );
  headers.set("cdn-cache-control", `max-age=${cacheRule.sMaxAge}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
