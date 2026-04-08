import { betterAuth } from "better-auth";
import { adminClient } from "better-auth/client/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
	emailAndPassword: {
		enabled: true,
	},
	plugins: [tanstackStartCookies(), adminClient()],
});
