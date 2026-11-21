import "@teyik0/furin/server-only";
import { api } from "@libs";
import { elysiaErrorF } from "@web/lib";
import { defineBff, defineBffNoInput } from "@web/lib/bff/define";
import { cookiePass } from "@web/lib/cookie-pass";
import { authServerClient } from "@web/server/auth/auth.server";
import { getServerSession } from "@web/server/auth/server-session";
import * as z from "zod/mini";

/**
 * 当前会话（未登录返回 null）。
 *
 * 走 `getServerSession()`：当前请求内合并（不跨请求缓存）。这个 BFF 在后台
 * 守卫、登录页 loader、用户中心等处被频繁调用，登录用户一次页面加载会触发
 * 多次，不合并的话每次都是 web → API → DB 的会话查询。
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

/**
 * 后台用户列表。
 *
 * 不能走 Better Auth 的 admin.listUsers：它的 filter 只能命中 galrc_user 的列，
 * 而「邮箱注册 / 第三方登录」要看 galrc_account.providerId，所以改由 API 直查
 * 数据库（GET /users/admin）。
 */
export const adminListUsers = defineBff(
	z.object({
		limit: z.optional(z.number()),
		offset: z.optional(z.number()),
		searchValue: z.optional(z.string()),
		/** 搜索字段：email=邮箱，name=用户名 */
		searchField: z.optional(z.enum(["email", "name"])),
		/** 不传=全部，active=正常，banned=已封禁 */
		status: z.optional(z.enum(["active", "banned"])),
		/** 不传=全部，email=邮箱账号，third-party=第三方账号 */
		authMethod: z.optional(z.enum(["email", "third-party"])),
	}),
	async ({ data }) => {
		const { data: res, error } = await api.users.admin.get({
			query: {
				limit: data.limit ?? 15,
				offset: data.offset ?? 0,
				searchValue: data.searchValue,
				searchField: data.searchField,
				status: data.status,
				authMethod: data.authMethod,
			},
			...cookiePass(),
		});
		elysiaErrorF(error);
		return res;
	},
);
