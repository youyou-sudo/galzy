import "@teyik0/furin/server-only";
import { defineBff, defineBffNoInput } from "@web/lib/bff/define";
import * as z from "zod/mini";
import { authServerClient } from "@web/server/auth/auth.server";

export const getSession = defineBffNoInput(async () => {
    try {
      const { data: session } = await authServerClient.getSession();
      return session;
    } catch {
      // Network errors already caught by safeFetch in auth.server.ts,
      // but catch any unexpected errors here so SSR doesn't crash.
      return null;
    }
  },);

export const seedVerification = defineBff(z.object({ email: z.email() }), async ({ data }) => {
		const { data: res, error } =
			await authServerClient.emailopt.seedverificationemail({
				email: data.email,
				type: "email-verification",
			});
		return {
			status: res?.success,
			error: error,
		};
	});

export const listAccounts = defineBffNoInput(async () => {
		const { data: res, error } = await authServerClient.listAccounts();
		return {
			data: res,
			error: error,
		};
	},);

export const getAccountInfo = defineBff(z.object({
			accountId: z.string(),
		}), async ({ data }) => {
		const { data: res, error } = await authServerClient.accountInfo({
			query: { accountId: data.accountId },
		});
		return {
			data: res,
			error: error,
		};
	});

export const adminListUsers = defineBff(z.object({
			limit: z.optional(z.number()),
			offset: z.optional(z.number()),
			searchValue: z.optional(z.string()),
		}), async ({ data }) => {
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
	});
