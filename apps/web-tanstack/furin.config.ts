import { defineConfig } from "@teyik0/furin/config";
import tailwind from "bun-plugin-tailwind";

export default defineConfig({
	rootDir: ".",
	pagesDir: "src/pages",
	serverEntry: "src/server.ts",
	reactCompiler: true,
	plugins: [{ ...tailwind, buildOnly: true }],
});
