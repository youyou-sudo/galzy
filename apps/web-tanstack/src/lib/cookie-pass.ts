import { getRequestHeader } from "./request-context";

/**
 * Forward the browser cookie header to the API (BFF pattern).
 * Reads the request captured by the Elysia onRequest hook instead of
 * TanStack Start's request context.
 */
export const cookiePass = () => ({
	fetch: {
		headers: {
			cookie: getRequestHeader("Cookie") || "",
		},
	},
});
