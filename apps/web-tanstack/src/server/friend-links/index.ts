import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib/elysia-error";
import type { FriendLink } from "@web/lib/friend-links";

/**
 * 公开：前台友情链接列表（按 sortOrder 升序，由 API 排序）。
 *
 * 空值兜底 []，让前台始终拿到可 map 的数组，不必到处判空。
 */
export const getFriendLinks = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data, error } = await api["friend-links"].get();
		elysiaErrorF(error);
		return (data ?? []) as unknown as FriendLink[];
	},
);
