import { ApiError } from "@web/lib/elysia-error";
import { dispatchBff } from "@web/lib/bff/server";
import { Elysia } from "elysia";

/**
 * BFF transport endpoint.
 *
 * Furin has no "server functions", so the ported TanStack Start server
 * functions are exposed as one POST endpoint: the browser branch of each
 * isomorphic surface posts { data } here and the same handler runs inside a
 * normal Elysia request (cookies, client IP and auth see the real request).
 */
export const bffApi = new Elysia({ prefix: "/api" }).post(
	"/_bff/:id",
	{},
	async ({ params, request }) => {
		const contentType = request.headers.get("content-type") ?? "";
		const body = contentType.startsWith("multipart/form-data")
			? { data: await request.formData() }
			: await request.json().catch(() => null);
		try {
			const result = await dispatchBff(params.id, body);
			return Response.json(result === undefined ? null : result);
		} catch (error) {
			const status = error instanceof ApiError ? error.status : 500;
			const message =
				error instanceof Error && error.message ? error.message : "BFF request failed";
			return Response.json({ status, message }, { status });
		}
	},
);
