"use client";

import { useQuery } from "@tanstack/react-query";
import { AUTH_QUERY_KEY } from "@web/lib/auth-session-key";
import { elysiaErrorF } from "@web/lib/elysia-error";
import { authClient } from "@web/server/auth/auth-client";

/**
 * 读取当前会话（未登录为 null）。
 *
 * 所有需要会话的组件都应该用它，而不是各自 `authClient.getSession()`：
 * 同一个 key 只会有一次在途请求，也不会因为组件数量增加会话请求数量。
 */
export function useAuthSession() {
	return useQuery({
		queryKey: AUTH_QUERY_KEY,
		queryFn: async () => {
			const { data, error } = await authClient.getSession();
			elysiaErrorF(error);
			return data ?? null;
		},
		// 会话由根布局 seed、登录/登出显式 invalidate，页面内不必反复重取
		staleTime: 60_000,
	});
}
