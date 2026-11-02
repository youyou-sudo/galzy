import "@teyik0/furin/server-only";
import { ApiError } from "@web/lib/elysia-error";
import { bffRegistry } from "@web/server/registry";

/**
 * Server transport for BFF handlers: validate the payload with the same schema
 * the original server function declared, then run the handler.
 */
export async function dispatchBff(id: string, args: unknown): Promise<unknown> {
	const entry = bffRegistry[id];
	if (!entry) throw new ApiError(500, "Unknown BFF handler: " + id);

	const payload = (args ?? {}) as { data?: unknown };
	let data = payload.data;

	if (typeof entry.input === "function") {
		data = (entry.input as (value: unknown) => unknown)(data);
		return entry.handler({ data });
	}

	if (entry.input) {
		const schema = entry.input as {
			"~standard": {
				validate: (value: unknown) =>
					| { value?: unknown; issues?: readonly { message?: string; path?: readonly PropertyKey[] }[] }
					| Promise<{ value?: unknown; issues?: readonly { message?: string; path?: readonly PropertyKey[] }[] }>;
			};
		};
		const result = await schema["~standard"].validate(data);
		if (result.issues?.length) {
			const message = result.issues
				.map((issue) => {
					const path = issue.path?.join(".");
					return path ? path + ": " + (issue.message ?? "invalid") : (issue.message ?? "invalid");
				})
				.join("; ");
			throw new ApiError(400, message);
		}
		data = result.value;
	}

	return entry.handler({ data });
}
