import { brotliCompressSync, gzipSync } from "node:zlib";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";
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
			noExternal: isBuild
				? [
						"@tanstack/react-router",
						"@tanstack/react-router/ssr/server",
						"@tanstack/router-core",
					]
				: process.platform === "win32"
					? []
					: true,
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
			},
			devtools(),
			// 把 TanStack router manifest 里写死的 modulepreload fetchPriority:"low"
			// 改写为首屏 JS 应有的高优先级（详见插件内注释）。
			modulePreloadPriority(),
			tailwindcss(),
			tanstackStart(),
			// 生产服务端交给 Nitro（TanStack Start 官方 Hosting → Nitro 配方），
			// 不再自写 Bun server（旧的 server-prod.ts 已缩成二进制入口）。
			// 产物为 .output/{server,public}；bun run build:binary 再由它编成单文件二进制。
			// 静态资源（含 clientPrecompression 产出的 .gz/.br 预压缩副本）由 Nitro
			// 静态处理器按 Accept-Encoding 下发；/assets/** 带内容哈希，永久缓存。
			// SSR 文本响应的压缩交给前置 CDN，应用内不再做流式压缩。
			nitro({
				preset: "bun",
				// 第三方包为兼容 React Server Components 在模块顶层写 "use client"；
				// 本项目不是 RSC 应用，该指令没有语义，Rolldown 打包时丢弃是正确的，
				// 但每次构建都会刷屏 [MODULE_LEVEL_DIRECTIVE] 警告。只关这一项检查，
				// 其余 Rolldown 警告（循环依赖、未解析导入等）照常输出。
				rolldownConfig: {
					checks: {
						moduleLevelDirective: false,
					},
				},
				// /_build：客户端在标签页重新可见时轮询构建指纹，不一致就整页刷新
				// （避免部署后旧页面继续调用已不存在的 server function 哈希）。
				handlers: [
					{
						route: "/_build",
						method: "GET",
						handler: "./nitro/handlers/build-id.ts",
					},
				],
				routeRules: {
					"/assets/**": {
						headers: {
							"cache-control": "public, max-age=31536000, immutable",
						},
					},
				},
			}),
			react(),
			babel({ presets: [reactCompilerPreset()] }),
			// 路由代码分割：仅在构建期启用，保留 Windows 端 dev 体验；
			// dev 下由 tanstackStart() 内置的路由生成/分割管线负责，
			// 避免独立插件的双生成器叠加引起 dev 变慢与导航等待。
			// enableRouteGeneration: false —— 路由树仍由 tanstackStart() 生成
			// （它才会写入 Start 的 Register 模块声明）；独立插件的生成器会把
			// src/routeTree.gen.ts 覆盖成缺少 Start 声明的版本，每次构建都弄脏工作区。
			isBuild &&
				tanstackRouter({
					autoCodeSplitting: true,
					enableRouteGeneration: false,
				}),
			// 放在最后：产物定稿后再做 preload 标记兜底清理 + 预压缩，
			// 保证 .js 与 .gz/.br 三份内容一致
			clientPrecompression(),
		],
	};
});

export default config;
