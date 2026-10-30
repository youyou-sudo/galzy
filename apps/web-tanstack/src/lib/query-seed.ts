import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Seed the query cache from server loader data during render.
 *
 * TanStack Start dehydrated the request-scoped query cache into the document
 * and hydrated it on the client. Furin serializes loader data as props, so
 * pages re-seed the same cache keys before their children render. Running in a
 * useState initializer keeps it once-per-mount on both server and client,
 * before any useQuery in the subtree mounts.
 */
export function useSeedQueries(seeds: Array<[readonly unknown[], unknown]>) {
	const queryClient = useQueryClient();
	useState(() => {
		for (const [key, data] of seeds) {
			if (data !== undefined) queryClient.setQueryData(key, data);
		}
		return true;
	});
}
