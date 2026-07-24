import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { authServerClient } from "./auth.server";

export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data: session } = await authServerClient.getSession();
		return session;
	},
);

export const seedVerification = createServerFn({ method: "GET" })
	.validator(z.object({ email: z.email() }))
	.handler(async ({ data }) => {
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

export const listAccounts = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data: res, error } = await authServerClient.listAccounts();
		return {
			data: res,
			error: error,
		};
	},
);

export const getAccountInfo = createServerFn({ method: "GET" })
	.validator(
		z.object({
			accountId: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const { data: res, error } = await authServerClient.accountInfo({
			query: { accountId: data.accountId },
		});
		return {
			data: res,
			error: error,
		};
	});

export const adminListUsers = createServerFn({ method: "GET" })
	.validator(
		z.object({
			limit: z.optional(z.number()),
			offset: z.optional(z.number()),
			searchValue: z.optional(z.string()),
		}),
	)
	.handler(async ({ data }) => {
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
