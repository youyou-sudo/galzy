import { emailOtpClientPlugin } from "@api/modules/auth/emailOtp-plugin/client";
import type { BetterAuthPlugin } from "better-auth";
import { adminClient } from "better-auth/client/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const betterPlugins = [
	adminClient(),
	tanstackStartCookies(),
	emailOtpClientPlugin(),
] as const satisfies BetterAuthPlugin[];
