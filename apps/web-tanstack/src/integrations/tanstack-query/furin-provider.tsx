import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { type ReactNode, useState } from "react";

const defaultOptions = {
	queries: {
		gcTime: 60_000,
		staleTime: 30_000,
	},
} as const;

const PERSIST_PREFIXES = new Set([
	"gameDetail",
	"gameTags",
	"gameList",
	"homeCollections",
	"totalCount",
	"hotGames",
	"topics",
	"topic",
	"comments",
	"searchTags",
]);

const PERSIST_MAX_AGE = 30 * 60 * 1000;
const QUERY_CACHE_KEY = "galzy:query-cache";

/** Only successful, whitelisted public queries are persisted (same rule as before). */
export function shouldPersistQuery(query: {
	queryKey: readonly unknown[];
	state?: { status?: string };
}) {
	return PERSIST_PREFIXES.has(String(query.queryKey[0])) && query.state?.status === "success";
}

function createPersister(storage: Storage) {
	return {
		persistClient: async (client: unknown) => {
			try {
				storage.setItem(QUERY_CACHE_KEY, JSON.stringify(client));
			} catch {
				/* quota exceeded */
			}
		},
		restoreClient: async () => {
			try {
				const raw = storage.getItem(QUERY_CACHE_KEY);
				return raw ? JSON.parse(raw) : undefined;
			} catch {
				return undefined;
			}
		},
		removeClient: async () => {
			try {
				storage.removeItem(QUERY_CACHE_KEY);
			} catch {
				/* ignore */
			}
		},
	};
}

export function createAppQueryClient(): QueryClient {
	return new QueryClient({ defaultOptions });
}

export default function QueryProvider({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => {
		const client = createAppQueryClient();
		if (typeof window !== "undefined") {
			const [unsubscribe, restorePromise] = persistQueryClient({
				queryClient: client,
				persister: createPersister(window.localStorage),
				maxAge: PERSIST_MAX_AGE,
				buster: (window as { __BUILD_ID__?: string }).__BUILD_ID__ ?? "",
				dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
			});
			restorePromise.catch(() => unsubscribe());
		}
		return client;
	});
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
