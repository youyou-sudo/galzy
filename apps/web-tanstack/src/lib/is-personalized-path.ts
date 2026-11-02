/**
 * 判断某个路径是否「因人而异」——只有这类页面才允许在根布局注入会话。
 *
 * 背景：用户视图（首页/列表/详情…）改为 ISR 后，HTML 会被写进服务端页面缓存
 * 并推给 CDN，**任何用户名/头像/权限都不能出现在缓存内容里**。所以根布局
 * 只在登录态相关的页面（后台、用户中心、登录注册、创建/编辑页）取会话；
 * 其余页面把登录态交给客户端查询（会话已有 Redis 加速，一次往返即可）。
 */
const PERSONALIZED_PREFIXES = ["/admin", "/user", "/auth"] as const;

const PERSONALIZED_PATTERNS: readonly RegExp[] = [
	/^\/topics\/create\/?$/,
	/^\/topics\/[^/]+\/edit\/?$/,
	/^\/introduction\/create\/?$/,
	/^\/introduction\/[^/]+\/edit\/?$/,
];

export function isPersonalizedPath(pathname: string): boolean {
	if (
		PERSONALIZED_PREFIXES.some(
			(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
		)
	) {
		return true;
	}
	return PERSONALIZED_PATTERNS.some((pattern) => pattern.test(pathname));
}
