import { createAuthClient } from "better-auth/client";
import { getRequestHeader } from "@tanstack/react-start/server";
import { adminClient } from "better-auth/client/plugins";

const BETTER_AUTH_URL = process.env.API_HOST || "http://localhost:3001";
const BETTER_AUTH_BASE_PATH = "/auth";
const BETTER_AUTH_COOKIE_PREFIX = "better-auth";

export const authServerClient = createAuthClient({
	plugins: [adminClient()],
	baseURL: BETTER_AUTH_URL,
	basePath: BETTER_AUTH_BASE_PATH,
	fetchOptions: {
		baseURL: BETTER_AUTH_URL + BETTER_AUTH_BASE_PATH,
		onRequest: async (context) => {
			const cookie = await getRequestHeader("Cookie");

			if (cookie) {
				const cookiePattern = new RegExp(
					`(^|; )(${BETTER_AUTH_COOKIE_PREFIX}\\.[^ ;]+|__Secure-${BETTER_AUTH_COOKIE_PREFIX}\\.[^ ;]+)`,
					"g",
				);
				const matches = cookie.match(cookiePattern);

				if (matches) {
					const authCookies = matches
						.map((m) => m.replace(/^; /, ""))
						.join("; ");

					context.headers.set("Cookie", authCookies);
				}
			}
		},
	},
});
