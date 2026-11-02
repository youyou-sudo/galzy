import "@teyik0/furin/server-only";
import { defineBff, defineBffNoInput } from "@web/lib/bff/define";
import { authServerClient } from "@web/server/auth/auth.server";
import { getServerSession } from "@web/server/auth/server-session";
import * as z from "zod/mini";

/**
 * 当前会话（未登录返回 null）。
 *
 * 走 `getServerSession()`：15s 进程内缓存 + 并行合并。这个 BFF 在后台守卫、
 * 登录页 loader、用户中心等处被频繁调用，登录用户一次页面加载会触发多次，
 * 不做缓存的话每次都是 web → API → DB 的会话查询。
 */
export const getSession = defineBffNoInput(async () => {
	return await getServerSession();
});

export const seedVerification = defineBff(
	z.object({ email: z.email() }),
	async ({ data }) => {
		const { data: res, error } =
			await authServerClient.emailopt.seedverificationemail({
				email: data.email,
				type: "email-verification",
			});
		return {
			status: res?.success,
			error: error,
		};
	},
);

export const listAccounts = defineBffNoInput(async () => {
	const { data: res, error } = await authServerClient.listAccounts();
	return {
		data: res,
		error: error,
	};
});

export const getAccountInfo = defineBff(
	z.object({
		accountId: z.string(),
	}),
	async ({ data }) => {
		const { data: res, error } = await authServerClient.accountInfo({
			query: { accountId: data.accountId },
		});
		return {
			data: res,
			error: error,
		};
	},
);

export const adminListUsers = defineBff(
	z.object({
		limit: z.optional(z.number()),
		offset: z.optional(z.number()),
		searchValue: z.optional(z.string()),
	}),
	async ({ data }) => {
		const res = await authServerClient.admin.listUsers({
			query: {
				limit: data.limit ?? 15,
				offset: data.offset ?? 0,
				searchValue: data.searchValue,
				sortBy: "createdAt",
				sortDirection: "desc",
			},
		});
		if (res.error) throw new Error(res.error.message || "获取用户列表失败");
		return res.data;
	},
);
