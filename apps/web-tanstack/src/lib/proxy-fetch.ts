// Shared helper for the API passthrough routes (/api/auth/*, /api/upload).
//
// Two failure modes used to surface as 500 / broken responses:
//  1. The upstream fetch rejects (timeout via AbortSignal.timeout, or the
//     client disconnects while the request body is streaming) — the rejection
//     propagated out of the route handler and TanStack Start answered 500.
//  2. The client disconnects while the upstream response body is streaming —
//     the body stream errors with AbortError and Bun reports an unhandled
//     rejection for the in-flight response.
//
// This helper converts (1) into structured 502/504 responses and guards the
// response body against (2) so aborts close the stream cleanly instead of
// surfacing as server errors.

function isAbortError(e: unknown): boolean {
	if (e instanceof DOMException && e.name === "AbortError") return true;
	if (typeof e === "object" && e !== null && "name" in e) {
		const named = e as { name?: unknown };
		if (named.name === "AbortError") return true;
	}
	if (typeof e === "object" && e !== null && "cause" in e) {
		return isAbortError((e as { cause: unknown }).cause);
	}
	return false;
}

// AbortSignal.timeout rejects with TimeoutError, client disconnects with
// AbortError — both mean "the other end gave up", not an upstream failure.
function isTimeoutError(e: unknown): boolean {
	if (e instanceof DOMException && e.name === "TimeoutError") return true;
	if (typeof e === "object" && e !== null && "name" in e) {
		return (e as { name?: unknown }).name === "TimeoutError";
	}
	return false;
}

function guardAbortStream(body: ReadableStream | null): ReadableStream | null {
	if (!body) return body;
	const reader = body.getReader();
	let done = false;
	return new ReadableStream({
		async pull(controller) {
			if (done) return;
			try {
				const { done: d, value } = await reader.read();
				if (d) {
					done = true;
					try {
						controller.close();
					} catch {}
					return;
				}
				try {
					controller.enqueue(value);
				} catch {}
			} catch (e) {
				// Client disconnect / upstream abort — close quietly, no 500.
				if (!isAbortError(e)) console.error("[err] proxy stream error:", e);
				done = true;
				try {
					controller.close();
				} catch {}
			}
		},
		cancel() {
			done = true;
			reader.cancel().catch(() => {});
		},
	});
}

export async function proxyFetch(
	targetUrl: string,
	request: Request,
	timeoutMs: number,
): Promise<Response> {
	const headers = new Headers(request.headers);
	headers.delete("host");

	// Merge own timeout with the client's disconnect signal so an abandoned
	// request stops burning the upstream connection immediately.
	const timeout = AbortSignal.timeout(timeoutMs);
	const signal =
		request.signal && "any" in AbortSignal
			? AbortSignal.any([request.signal, timeout])
			: timeout;

	let res: Response;
	try {
		res = await fetch(targetUrl, {
			method: request.method,
			headers,
			redirect: "manual",
			signal,
			body:
				request.method !== "GET" && request.method !== "HEAD"
					? request.body
					: undefined,
		});
	} catch (e) {
		// Upstream timed out or the client disconnected mid-request.
		// 504 tells the client (and Cloudflare) the origin didn't answer
		// in time instead of an app-level 500.
		if (isAbortError(e) || isTimeoutError(e)) {
			return new Response("Gateway Timeout", { status: 504 });
		}
		console.error(
			"[err] proxy upstream error:",
			e instanceof Error ? e.message : String(e),
		);
		return new Response("Bad Gateway", { status: 502 });
	}

	return new Response(guardAbortStream(res.body), {
		status: res.status,
		statusText: res.statusText,
		headers: res.headers,
	});
}
