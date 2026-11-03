/**
 * 判断某个路径是否「因人而异」——只有这类页面才在根布局服务端注入会话。
 *
 * 背景：页面一律 SSR、源站不做任何页面缓存（公开页由 CDN 边缘缓存），登录态随
 * 文档下发没有正确性风险；但公开页面（首页/列表/详情…）没必要为每个访客多打一次
 * 会话查询，否则 CDN 也会因 Set-Cookie 而无法缓存。所以根布局
 * 只在登录态相关的页面（后台、用户中心、登录注册、创建/编辑页）取会话，
 * 其余页面把登录态交给客户端查询。
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
