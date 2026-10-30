import { emailOtpClientPlugin } from "@api/modules/auth/emailOtp-plugin/client";
import type { BetterAuthPlugin } from "better-auth";
import { adminClient } from "better-auth/client/plugins";

export const betterPlugins = [adminClient(), emailOtpClientPlugin()] as const satisfies BetterAuthPlugin[];
