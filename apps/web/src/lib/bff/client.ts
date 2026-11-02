import { ApiError } from "@web/lib/elysia-error";
import type { BffErrorBody } from "./protocol";

/**
 * Browser transport for BFF handlers. Same-origin, cookie-authenticated, JSON.
 * The body envelope mirrors TanStack Start's { data } server-fn payload so
 * existing call sites are unchanged.
 */
export async function callBff(id: string, args: unknown): Promise<unknown> {
	const payload = (args ?? {}) as { data?: unknown };
	const isForm = typeof FormData !== "undefined" && payload.data instanceof FormData;
	const response = await fetch("/api/_bff/" + encodeURIComponent(id), {
		method: "POST",
		credentials: "same-origin",
		headers: isForm ? undefined : { "content-type": "application/json" },
		body: isForm ? (payload.data as FormData) : JSON.stringify({ data: payload.data }),
	});

	if (response.ok) {
		const text = await response.text();
		return text ? JSON.parse(text) : null;
	}

	let message = response.statusText || "Request failed";
	let status = response.status;
	try {
		const body = (await response.json()) as BffErrorBody;
		if (body?.message) message = body.message;
		if (body?.status) status = body.status;
	} catch {
		/* non-JSON error body */
	}
	throw new ApiError(status, message);
}
