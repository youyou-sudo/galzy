import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import viteCompression from "vite-plugin-compression";

const BUILD_ID = process.env.BUILD_ID || `dev-${Date.now().toString(36)}`;

// vite-plugin-compression 在 configResolved 捕获顶层 build.outDir（此处最终
// 解析为 server 产物目录），在 TanStack Start 的 Vite 8 environments 构建管道
// 下其 closeBundle 永远不会覆盖 dist/client。改为在 client 环境构建的
// generateBundle 阶段直接 emit .gz/.br 预压缩产物。
function clientPrecompression(): Plugin {
	return {
		name: "galzy:client-precompression",
		apply: "build",
		enforce: "post",
		generateBundle(_options, bundle) {
			if (this.environment?.name !== "client") return;
			for (const file of Object.values(bundle)) {
				if (!/\.(js|mjs|json|css|html)$/i.test(file.fileName)) continue;
				const source = file.type === "chunk" ? file.code : file.source;
				const content =
					typeof source === "string"
						? Buffer.from(source, "utf8")
						: Buffer.from(source);
				// 与 vite-plugin-compression 默认阈值保持一致（1025 字节）
				if (content.length < 1025) continue;
				this.emitFile({
					type: "asset",
					fileName: `${file.fileName}.gz`,
					source: gzipSync(content, { level: 9 }),
				});
				this.emitFile({
					type: "asset",
					fileName: `${file.fileName}.br`,
					source: brotliCompressSync(content),
				});
			}
		},
	};
}

const config = defineConfig(({ command }) => {
	// 仅在构建期启用构建期专属插件；dev 保留原体验
	const isBuild = command === "build";
	return {
		resolve: {
			tsconfigPaths: true,
			dedupe: ["react", "react-dom"],
			alias: {
				// 路由 validateSearch 只需 zod 经典 API 子集：指向 classic/schemas.js
				// （具名导出可 tree-shake，避免整个 zod 主入口进客户端 bundle）
				"zod/schemas": fileURLToPath(
					new URL(
						"../../node_modules/zod/v4/classic/schemas.js",
						import.meta.url,
					),
				),
			},
		},
		// windows 端 dev 需关闭 ssr.noExternal
		ssr: {
			// rolldown 只接受 true / 数组，传 false 会直接报错；
			// 空数组等效于「不额外 noExternal」，即 Windows dev 需要的形态
			noExternal: process.platform === "win32" ? [] : true,
		},
		build: {
			ssrManifest: true,
			ssr: true,
			minify: "oxc",
			modulePreload: false,
			rolldownOptions: {
				treeshake: true,
			},
		},
		plugins: [
			{
				name: "galzy:build-id",
				resolveId(id) {
					if (id === "virtual:build-id") return "\0virtual:build-id";
				},
				load(id) {
					if (id === "\0virtual:build-id") {
						return `export const BUILD_ID = ${JSON.stringify(BUILD_ID)};`;
					}
				},
				buildEnd(error) {
					if (!error) {
						mkdirSync("dist", { recursive: true });
						writeFileSync("dist/.build-id", BUILD_ID);
					}
				},
			},
			devtools(),
			tailwindcss(),
			tanstackStart(),
			react(),
			viteCompression({ algorithm: "gzip", ext: ".gz" }),
			viteCompression({ algorithm: "brotliCompress", ext: ".br" }),
			clientPrecompression(),
			babel({ presets: [reactCompilerPreset()] }),
			// 路由代码分割：仅在构建期启用，保留 Windows 端 dev 体验；
			// dev 下由 tanstackStart() 内置的路由生成/分割管线负责，
			// 避免独立插件的双生成器叠加引起 dev 变慢与导航等待
			isBuild && tanstackRouter({ autoCodeSplitting: true }),
		],
	};
});

export default config;
