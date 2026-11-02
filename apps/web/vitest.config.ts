import { defineConfig } from "vitest/config";

/**
 * Vitest runs against the app sources with the same path aliases the Furin
 * build uses (tsconfig paths). Component tests opt into jsdom per file with
 * the @vitest-environment docblock.
 */
export default defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		include: ["src/**/*.test.{ts,tsx}"],
		globals: false,
	},
});
