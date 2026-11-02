import { getClientIp } from "./request-context";

// Forward the client IP to the API for per-IP rate limiting (BFF pattern,
// same as cookiePass). Cloudflare sets CF-Connecting-IP; other proxies fall
// back to the first X-Forwarded-For entry. Empty string means the API falls
// back to the socket address (await server.requestIP).
export const ipPass = () => ({
	fetch: {
		headers: {
			"x-client-ip": getClientIp(),
		},
	},
});
