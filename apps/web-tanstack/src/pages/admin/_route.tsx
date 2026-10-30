import { defineRoute } from "@teyik0/furin";
import { AdminShell } from "@web/components/admin/admin-shell";
import { redirect } from "@web/lib/nav";
import { getSession } from "@web/server/auth/auth.functions";

/**
 * 管理端目录布局（等价旧 `src/routes/admin/_authL.tsx`）。
 *
 * furin 没有 beforeLoad：目录自己的 `_route.tsx` 就是权限边界，
 * 判定失败直接 throw 一个 302（@web/lib/nav 的 redirect 会拼好 URL 并抛 Response）。
 * - 未登录 → `/auth/login?return_to=<当前后台路径>`
 * - 已登录但不是管理员 → 回站点首页（与旧实现一致）
 *
 * AdminShell（侧栏 + 顶栏 + ⌘K 命令面板）只在这里挂载一次：用户端 Header/Footer
 * 由 `pages/root.tsx` 的 AppChrome 依据 matches 跳过，不会重复渲染。
 */
export const route = defineRoute("/admin/_route")
	.config({ mode: "ssr" })
	.loader(async ({ request }) => {
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
