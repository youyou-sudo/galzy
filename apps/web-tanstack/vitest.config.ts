import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

/**
 * vitest 配置：在 vite.config.ts 的基础上补齐测试运行时的差异。
 *
 * redact 只通过 Vite 插件生效（resolve.alias + 插件 resolveId），而 vitest
 * 默认把 node_modules 里的依赖 externalize 成 Node 原生加载，Vite 的别名
 * 对它们不生效 → @testing-library/react / react-photo-view 等拿到真实
 * react/react-dom，与 Vite 模块图里的 redact 形成两套运行时。
 *
 * ssr.noExternal 全量内联让依赖都经过 Vite 模块图（用数组/正则形式：vite.config.ts
 * 与 redact 插件本身也会产出 noExternal 数组，数组合并后仍是全量；布尔形式在
 * 部分合并路径下会被数组覆盖，不可靠）。CJS 依赖内部的 require("react") 仍由
 * Node 解析，交给 vitest.setup.ts 里的原生模块钩子兜底。
 */
export default defineConfig(async (env) => {
	// vite.config.ts 是函数形态（defineConfig(({ command }) => ...)），
	// 以 dev（serve）语义求值：测试不需要构建期专属插件。
	const base = await viteConfig({ command: "serve", mode: env.mode });

	return mergeConfig(base, {
		ssr: { noExternal: [/.*/] },
		test: {
			setupFiles: ["./vitest.setup.ts"],
		},
	});
});
