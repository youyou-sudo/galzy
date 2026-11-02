import { type AdSlotPayload, TOP_AD_SLOT_KEY } from "@web/lib/adverts";
import { isSpaDataRequest } from "@web/lib/spa-request";
import { getAdSlot } from "@web/server/adverts";

/**
 * 请求路径（取不到就返回空串，交给调用方的业务规则处理）。
 *
 * 根布局的 loader 在 SSR / SPA 导航取数时都跑在服务端，`request` 正常存在；
 * 这里仍然兜一层，避免将来某个执行环境没注入 request 时把整页拖挂。
 */
function requestPathname(request: Request | undefined): string {
	if (!request) return "";
	try {
		return new URL(request.url).pathname;
	} catch {
		return "";
	}
}

/**
 * 根布局的顶部广告位取数（`pages/root.tsx` 的 loader 调用）。
 *
 * 广告位数据必须在根布局取：只有 SSR 首帧就带着广告，才不会有「先空一块、
 * JS 跑完再补上」的布局跳动；也不会因为浏览器侧对 `/api/_bff/adverts.*` 的请求
 * 被广告拦截扩展 / 代理挡掉而整块消失（重构前由 `__root.tsx` 的 `beforeLoad`
 * 预取保证，迁移到 Furin 时漏掉了这一步）。
 *
 * 三条降级规则：
 * - 后台 `/admin/**` 不渲染广告位，直接跳过这次 API 调用；
 * - SPA 切页（`?_furin=data`）不再取数：广告位在首屏文档请求时已经进了 query
 *   缓存，每次切页重新请求会把导航拖慢一个「web → API → DB」往返；
 * - 广告只是装饰位：接口异常一律吞掉返回 null，绝不能让整页 500。
 *
 * ISR 页面的根布局 loader 拿不到 `request`（缓存渲染不应依赖请求），
 * 所以额外接受 `pathname`（loader ctx 的 `path`）。
 */
export async function loadTopAdSlot(
	request?: Request,
	pathname?: string,
): Promise<AdSlotPayload | null> {
	const path = pathname ?? requestPathname(request);
	if (path.startsWith("/admin")) return null;
	if (isSpaDataRequest(request)) return null;
	try {
		return await getAdSlot({ data: { key: TOP_AD_SLOT_KEY } });
	} catch {
		return null;
	}
}
