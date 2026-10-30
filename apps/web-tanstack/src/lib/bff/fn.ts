import { createIsomorphicFn } from "@teyik0/furin";
import { callBff } from "./client";

/**
 * Isomorphic surface for one BFF handler.
 *
 * - Server (SSR loaders, server components): dispatch in-process through the
 *   registry - no HTTP hop.
 * - Browser: POST to /api/_bff/:id, which runs the same handler inside an
 *   Elysia request (so cookies are forwarded exactly like before).
 *
 * The server branch imports the registry lazily, which is what lets Furin's
 * strip plugin remove every server-only module from the browser bundle.
 */
export function bffFn<T extends (args: any) => Promise<any>>(id: string): T {
	const impl = createIsomorphicFn()
		.server(async (args: Parameters<T>[0]) => {
			const { dispatchBff } = await import("./server");
			return (await dispatchBff(id, args)) as Awaited<ReturnType<T>>;
		})
		.client(async (args: Parameters<T>[0]) => {
			return (await callBff(id, args)) as Awaited<ReturnType<T>>;
		});
	return impl as unknown as T;
}
