import { mkdirSync, writeFileSync } from "node:fs";
import { brotliCompressSync, gzipSync } from "node:zlib";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { redact } from "@tanstack/redact/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import viteCompression from "vite-plugin-compression";
import { modulePreloadPriority } from "./vite-plugins/module-preload-priority.ts";

const BUILD_ID = process.env.BUILD_ID || `dev-${Date.now().toString(36)}`;

/**
 * Vite 内部 preload 标记。动态 import 会被改写为
 * `__vitePreload(factory, __VITE_PRELOAD__)`，正常情况下由 Vite 在客户端构建的
 * generateBundle 阶段替换成依赖数组（或对孤立标记替换为 `void 0`）。
 *
 * 但当一个 chunk 由别的构建环境产出（TanStack Start 的 server-fn / cookies
 * 运行时混入客户端 chunk 时出现过）却又作为客户端资源下发时，标记会原样进入
 * 产物，浏览器执行即抛 `__VITE_PRELOAD__ is not defined`（生产事故）。
 */
const VITE_PRELOAD_MARKER = "__VITE_PRELOAD__";

/** 把产物里残留的 preload 标记就地归一化为 `void 0`。
 *  与 Vite 自己对孤立标记的处理一致：preload helper 内部是
 *  `if (deps && deps.length > 0)`，undefined 是受支持的取值。
 *  （导出仅为便于针对真实产物做回归验证。） */
export function normalizeLeakedPreloadMarker(
	warn: (message: string) => void,
	fileName: string,
	code: string,
): string {
	if (!code.includes(VITE_PRELOAD_MARKER)) return code;
	warn(
		`产物 ${fileName} 残留 ${VITE_PRELOAD_MARKER} 标记，已替换为 void 0；` +
			`请检查是否仍有 server-only 模块混入了客户端 chunk`,
	);
	return code.split(VITE_PRELOAD_MARKER).join("void 0");
}

// vite-plugin-compression 在 configResolved 捕获顶层 build.outDir（此处最终
// 解析为 server 产物目录），在 TanStack Start 的 Vite 8 environments 构建管道
// 下其 closeBundle 永远不会覆盖 dist/client。改为在 client 环境构建的
// generateBundle 阶段直接 emit .gz/.br 预压缩产物；同时兜底清理 Vite preload
// 标记，保证预压缩副本与原始产物同样干净（避免 CDN 下发到残留标记的旧副本）。
function clientPrecompression(): Plugin {
	return {
		name: "galzy:client-precompression",
		apply: "build",
		enforce: "post",
		generateBundle(_options, bundle) {
			// 所有环境先做标记归一化（服务端产物残留同样会 crash SSR）
			for (const file of Object.values(bundle)) {
				if (file.type === "chunk") {
					file.code = normalizeLeakedPreloadMarker(
						(message) => this.warn(message),
						file.fileName,
						file.code,
					);
				} else if (typeof file.source === "string") {
					file.source = normalizeLeakedPreloadMarker(
						(message) => this.warn(message),
						file.fileName,
						file.source,
					);
				}
			}

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
		},
		// windows 端 dev 需关闭 ssr.noExternal
		ssr: {
			// rolldown 只接受 true / 数组，传 false 会直接报错；
			// 空数组等效于「不额外 noExternal」，即 Windows dev 需要的形态。
			//
			// 构建期必须把 @tanstack/react-router 打进 SSR bundle：SSR 首屏 head 的
			// modulepreload 标签由它的 headContentUtils → router-core manifest.js 生成。
			// 若该包被 externalize，运行时会从 node_modules 读取未改写的
			// fetchPriority:"low"（module-preload-priority 插件只作用于被 bundle 的源码），
			// 构建期改写就会对 SSR HTML 失效。
			//
			// React → Redact 之后必须整包内联：redact 只通过 Vite 的 resolve.alias
			// 生效，被 externalize 的依赖由 Node 原生解析，会拿到 node_modules 里
			// 的真实 react，与渲染树里的 redact 形成两套 dispatcher，SSR 直接抛
			// "ReactSharedInternals.H is null"（实测 @tanstack/react-query 首屏即崩）。
			noExternal: isBuild ? [/.*/] : process.platform === "win32" ? [] : true,
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
			// 把 TanStack router manifest 里写死的 modulepreload fetchPriority:"low"
			// 改写为首屏 JS 应有的高优先级（详见插件内注释）。
			modulePreloadPriority(),
			tailwindcss(),
			tanstackStart(),
			react(),
			// React → Redact：把 react / react-dom / jsx-runtime / scheduler /
			// use-sync-external-store 等导入别名到 @tanstack/redact 的同步实现，
			// 应用源码 import 保持不变。默认 full 预设（除原生动画外全开）。
			redact(),
			viteCompression({ algorithm: "gzip", ext: ".gz" }),
			viteCompression({ algorithm: "brotliCompress", ext: ".br" }),
			babel({ presets: [reactCompilerPreset()] }),
			// 路由代码分割：仅在构建期启用，保留 Windows 端 dev 体验；
			// dev 下由 tanstackStart() 内置的路由生成/分割管线负责，
			// 避免独立插件的双生成器叠加引起 dev 变慢与导航等待
			isBuild && tanstackRouter({ autoCodeSplitting: true }),
			// 放在最后：产物定稿后再做 preload 标记兜底清理 + 预压缩，
			// 保证 .js 与 .gz/.br 三份内容一致
			clientPrecompression(),
		],
	};
});

export default config;
