import "@teyik0/furin/server-only";
import { defineBff } from "@web/lib/bff/define";
import { api } from "@libs";
import { cookiePass } from "@web/lib/cookie-pass";
import { elysiaErrorF } from "@web/lib/elysia-error";
import type { FriendLink } from "@web/lib/friend-links";
import * as z from "zod/mini";

/**
 * 后台：友情链接管理 BFF。
 *
 * 读接口也带 cookiePass——GET /friend-links 虽是公开接口，但后台与其他管理页
 * 保持一致，统一转发当前会话的 Cookie，避免将来收紧权限时漏改。
 */
export const adminGetFriendLinks = defineBff(z.object({}), async () => {
		const { data, error } = await api["friend-links"].get(cookiePass());
		elysiaErrorF(error);
		return (data ?? []) as unknown as FriendLink[];
	});

export const adminCreateFriendLink = defineBff(z.object({
			title: z.string().check(z.minLength(1)),
			href: z.string().check(z.minLength(1)),
			avatar: z.optional(z.string()),
			description: z.optional(z.string()),
			sortOrder: z.optional(z.number()),
		}), async ({ data }) => {
		const { data: created, error } = await api["friend-links"].post(
			data,
			cookiePass(),
		);
		elysiaErrorF(error);
		return (created ?? null) as unknown as FriendLink | null;
	});

export const adminUpdateFriendLink = defineBff(z.object({
			id: z.number(),
			title: z.optional(z.string().check(z.minLength(1))),
			href: z.optional(z.string().check(z.minLength(1))),
			avatar: z.optional(z.string()),
			description: z.optional(z.string()),
			sortOrder: z.optional(z.number()),
		}), async ({ data }) => {
		const { id, ...rest } = data;
		const { data: updated, error } = await api["friend-links"]({
			id: String(id),
		}).put(rest, cookiePass());
		elysiaErrorF(error);
		return (updated ?? null) as unknown as FriendLink | null;
	});

export const adminDeleteFriendLink = defineBff(z.object({ id: z.number() }), async ({ data }) => {
		const { data: res, error } = await api["friend-links"]({
			id: String(data.id),
		}).delete(undefined, cookiePass());
		elysiaErrorF(error);
		return { success: res?.success ?? true };
	});

export const adminReorderFriendLinks = defineBff(z.object({ ids: z.array(z.number()) }), async ({ data }) => {
		const { data: res, error } = await api["friend-links"].reorder.put(
			{ ids: data.ids },
			cookiePass(),
		);
		elysiaErrorF(error);
		return { success: res?.success ?? true };
	});
