import { furin } from "@teyik0/furin";
import { enterRequestContext } from "@web/lib/request-context";
import { api } from "@web/api";
import { Elysia } from "elysia";

const port = Number(process.env.PORT ?? 3000);

/**
 * Container healthcheck entry used by the Dockerfile (the runtime image has no
 * shell or curl). Mirrors the previous Nitro binary healthcheck contract,
 * including Dokploy existing "healthcheck" spelling.
 */
const HEALTHCHECK =
  process.argv.includes("--healthcheck") || process.argv.includes("healthcheck");

if (HEALTHCHECK) {
  const response = await fetch(
    "http://127.0.0.1:" + String(port) + "/api/health",
  ).catch(() => null);
  process.exit(response?.ok ? 0 : 1);
}

/**
 * Furin server entry: Elysia owns HTTP, Furin owns pages.
 *
 * The onRequest hook captures the request in AsyncLocalStorage before any
 * loader runs, so BFF handlers can read cookies / client IP exactly like the
 * TanStack Start request context did.
 */
const app = new Elysia()
	.onRequest(({ request }) => {
		enterRequestContext(request);
	})
	.use(api)
	.use(await furin({ pagesDir: "./src/pages" }));

if (import.meta.main) {
	app.listen({ port, hostname: process.env.HOST ?? "0.0.0.0" });
	console.log("[web] furin server listening on http://localhost:" + String(app.server?.port));
}

export type App = typeof app;
export default app;