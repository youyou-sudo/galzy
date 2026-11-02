import { defineRoute } from "@teyik0/furin";
import { AdminShell } from "@web/components/admin/admin-shell";
import { redirect } from "@web/lib/nav";
import { isSpaDataRequest } from "@web/lib/spa-request";
import { getSession } from "@web/server/auth/auth.functions";

/**
 * 管理端目录布局（等价旧 `src/routes/admin/_authL.tsx`）。
 *
 * furin 没有 beforeLoad：目录自己的 `_route.tsx` 就是权限边界，
 * 判定失败直接 throw 一个 302（@web/lib/nav 的 redirect 会拼好 URL 并抛 Response）。
 * - 未登录 → `/auth/login?return_to=<当前后台路径>`
 * - 已登录但不是管理员 → 回站点首页（与旧实现一致）
 *
 * ## 为什么 SPA 切页不再做服务端鉴权
 *
 * furin 的站内导航会把**整条 loader 链**重跑一遍（root → `_route` → 页面），
 * 而 `getSession()` 是 `web → API → Better Auth → DB` 的一次完整往返。
 * 后台有 11 个页面，如果每次点侧栏都校验一次会话，切换页面就永远要等一个
 * 接口耗时，这正是「后台不像 SPA」的根因之一。
 *
 * 因此这里只在**文档请求**（首屏 / 刷新 / 直链 / 前进后退）上判定：
 * 未登录直链依旧在服务端 302，不会闪一下后台界面；站内切页由
 * `AdminShell` 的客户端会话兜底（会话过期时跳登录），而每个后台接口本身
 * 还有 `isAdmin` 宏做最终防线——页面壳不含任何敏感数据。
 *
 * AdminShell（侧栏 + 顶栏 + ⌘K 命令面板）只在这里挂载一次：用户端 Header/Footer
 * 由 `pages/root.tsx` 的 AppChrome 依据 matches 跳过，不会重复渲染。
 */
export const route = defineRoute("/admin/_route")
	.config({ mode: "ssr" })
	.loader(async ({ request }) => {
		if (isSpaDataRequest(request)) return {};

		const session = await getSession();
		if (!session) {
			throw redirect({
				to: "/auth/login",
				search: { return_to: new URL(request.url).pathname },
			});
		}
		if ((session.user as { role?: string | null }).role !== "admin") {
			throw redirect({ to: "/" });
		}
		return {};
	})
	.layout(({ children }) => <AdminShell>{children}</AdminShell>);
