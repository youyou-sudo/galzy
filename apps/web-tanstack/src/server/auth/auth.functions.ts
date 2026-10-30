import { bffFn } from "@web/lib/bff/fn";
import type * as impl from "./../impl/auth/auth.functions";

export const getSession = bffFn<typeof impl.getSession>("auth.auth.functions.getSession");
export const seedVerification = bffFn<typeof impl.seedVerification>("auth.auth.functions.seedVerification");
export const listAccounts = bffFn<typeof impl.listAccounts>("auth.auth.functions.listAccounts");
export const getAccountInfo = bffFn<typeof impl.getAccountInfo>("auth.auth.functions.getAccountInfo");
export const adminListUsers = bffFn<typeof impl.adminListUsers>("auth.auth.functions.adminListUsers");

export type * from "./../impl/auth/auth.functions";
