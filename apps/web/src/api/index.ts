import { Elysia } from "elysia";
import { bffApi } from "./bff";
import { gameApi } from "./game";
import { proxyApi } from "./proxy";
import { publicApi } from "./public";
import { searchApi } from "./search";

/**
 * All non-page HTTP routes. Composed before Furin so Elysia matches them
 * first; Furin's catch-all page fallback runs afterwards.
 */
export const api = new Elysia()
	.use(proxyApi)
	.use(publicApi)
	.use(bffApi)
	.use(searchApi)
	.use(gameApi);
