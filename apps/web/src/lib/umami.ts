/**
 * Umami 统计脚本配置。
 *
 * 迁移到 Furin 时旧的根文档（TanStack）里的
 * `scripts: [{ src: process.env.UMAMI_SCRIPT_URL, 'data-website-id': ... }]`
 * 被一并删掉了，前端从此不再上报任何 pageview / 广告点击事件。
 * 这里按运行期环境变量恢复，并由根布局写进 `<head>`。
 *
 * 规则：
 * - 只在生产环境注入：开发模式（`bun --hot`）下不上报，避免本地访问污染线上数据；
 * - 两个变量缺一不可（缺站点 id 时 umami 会丢弃事件）。
 */
export type UmamiScript = {
	scriptUrl: string;
	websiteId: string;
};

export function umamiScript(
	env: Record<string, string | undefined> = process.env,
): UmamiScript | null {
	if (env.NODE_ENV !== "production") return null;
	const scriptUrl = env.UMAMI_SCRIPT_URL?.trim();
	const websiteId = env.UMAMI_DATA_WEBSITE_ID?.trim();
	if (!scriptUrl || !websiteId) return null;
	return { scriptUrl, websiteId };
}
