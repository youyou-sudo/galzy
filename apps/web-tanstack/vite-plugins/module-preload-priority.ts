import type { Plugin } from "vite";

/**
 * Module preload 优先级提权插件
 * ============================
 *
 * 根因：TanStack Router 的 router-core 在生成路由 chunk 的
 * `<link rel="modulepreload">` 时，把 fetchPriority 硬编码成了 `"low"`
 * （见 @tanstack/router-core/dist/esm/manifest.js 的 getScriptPreloadAttrs）：
 *
 *   function getScriptPreloadAttrs(manifest, link, assetCrossOrigin) {
 *     return { rel: "modulepreload", href, fetchPriority: "low", ... }
 *   }
 *
 * 于是首页 head 里上百条 modulepreload 全部是低优先级：Chrome 会把首屏 JS 的
 * 抓取排到图片（React 19 为 eager <img> 注入的 `<link rel="preload" as="image">`）
 * 之类的资源之后，关键 CSS/JS 反而被自己声明的 preload 拖慢。上游 1.171.x
 * 没有暴露配置项，只能在构建期改写该模块源码。
 *
 * 作用范围：id 命中 @tanstack/router-core 的 manifest 模块时改写其
 * `fetchPriority: "low"`。transform 钩子对 client / ssr 两个构建环境都会执行
 * （Vite 8 environment API 下默认逐环境调用），因此 SSR 产物与客户端 chunk
 * 都能拿到改写结果。
 *
 * 风险与取舍：
 * - 该改写是「全量提权」：router manifest 里所有路由依赖 chunk（含非首屏的
 *   懒加载 chunk）的 modulepreload 都会变成 high。在慢网/多 chunk 场景下会
 *   抬高带宽竞争，可能挤占真正的首屏字节。若需要更保守的策略，应改为只对
 *   entry/runtime chunk 提权（需要路由 manifest 信息，不能在此静态改写）。
 * - 直接改写第三方模块代码，绕过 sourcemap（该模块来自 node_modules，调试
 *   价值有限）；上游若改了实现，本插件会 this.warn 而不是静默失效。
 * - SSR 构建若把 node_modules externalize（如本仓库 Windows 下
 *   `ssr.noExternal: []`），manifest.js 不会经过 transform，插件会在
 *   buildEnd 告警提示。
 */

/** 插件名：与仓库内其它自定义插件保持 galzy: 前缀（日志里一眼可辨）。 */
const PLUGIN_NAME = "galzy:module-preload-priority";

/** 未改写时 Chromium 对 modulepreload 的默认优先级由浏览器决定，这里只负责
 *  把上游写死的 "low" 覆盖成目标值。 */
const LOW_PRIORITY_PATTERN = /(["']?fetchPriority["']?\s*:\s*)(["'])low\2/g;

/** 上游实现探针：manifest 模块里一定存在该函数名（压缩前）。 */
const UPSTREAM_PROBE = "getScriptPreloadAttrs";

export interface ModulePreloadPriorityOptions {
	/**
	 * 改写后的 fetchpriority 值。默认 `"high"`。
	 * 传 `"auto"` 等于移除上游的低优先级提示（浏览器默认策略），可用于 A/B
	 * 对比「全量 high」与「不加提示」两种策略的首屏表现。
	 */
	priority?: "high" | "auto";
}

/** 把不同包管理器（bun/pnpm/yarn）的路径分隔符与资源查询串归一化。 */
function normalizeId(id: string): string {
	return id.split("?")[0]!.split("#")[0]!.replace(/\\/g, "/");
}

/**
 * 是否为 @tanstack/router-core 的 manifest 模块。
 * 宽松匹配：不同包管理器下 id 前缀不同（.bun store / pnpm / 嵌套
 * node_modules），但文件末尾一定是 router-core 包内的 manifest 文件。
 */
function isRouterCoreManifest(id: string): boolean {
	const normalized = normalizeId(id);
	const isManifestFile = /(?:^|\/)manifest\.[cm]?[jt]s$/.test(normalized);
	if (!isManifestFile) return false;
	return (
		normalized.includes("/@tanstack/router-core/") ||
		normalized.includes("router-core")
	);
}

interface EnvironmentState {
	/** 是否见到过 manifest 模块（用于区分「没命中」与「没进 transform」）。 */
	sawManifest: boolean;
	/** 是否真的写入过改写。 */
	rewrote: boolean;
}

export function modulePreloadPriority(
	options: ModulePreloadPriorityOptions = {},
): Plugin {
	const priority = options.priority ?? "high";
	const states = new Map<string, EnvironmentState>();
	const envState = (name: string): EnvironmentState => {
		let state = states.get(name);
		if (!state) {
			state = { sawManifest: false, rewrote: false };
			states.set(name, state);
		}
		return state;
	};

	return {
		name: PLUGIN_NAME,
		// dev 下路由不通过生产 manifest 生成 modulepreload，无需改写；
		// 仅在 build 阶段介入（client 与 ssr 环境都会走到）。
		apply: "build",
		transform(code, id) {
			const environment = this.environment.name;
			const state = envState(environment);
			const matched = isRouterCoreManifest(id);
			// 兜底：上游可能重命名/搬移模块，只要代码里有 getScriptPreloadAttrs
			// 就说明这是同一段逻辑，命中即尝试改写（但不据此告警，避免误报）。
			const looksLikeUpstream = code.includes(UPSTREAM_PROBE);
			if (!matched && !looksLikeUpstream) return null;
			if (matched) state.sawManifest = true;

			const next = code.replace(
				LOW_PRIORITY_PATTERN,
				(_match, prefix: string, quote: string) =>
					`${prefix}${quote}${priority}${quote}`,
			);
			if (next === code) {
				// 命中了 manifest 模块但找不到硬编码 low：上游很可能改了实现，
				// 此处必须显式告警，避免 modulepreload 优先级静默回退。
				if (matched) {
					this.warn(
						`在 ${id} 中未找到 fetchPriority: "low"，` +
							`modulepreload 优先级未被改写。上游 @tanstack/router-core 可能已变更 ` +
							`${UPSTREAM_PROBE} 的实现，请核对插件匹配规则。`,
					);
				}
				return null;
			}

			state.rewrote = true;
			// 第三方模块不提供 sourcemap（只少了 manifest.js 一段映射，
			// 且该文件不在业务调试路径上）。
			return { code: next, map: null };
		},
		buildEnd() {
			const environment = this.environment.name;
			// 只对真正承载应用的构建环境告警，避免 css/scan 等环境误报。
			if (!/^(client|ssr|server)$/.test(environment)) return;
			const state = states.get(environment);
			if (state?.rewrote) return;
			// 见到了 manifest 模块却没改写：transform 里已经针对该模块告过警，
			// 这里不重复刷屏（但仍会在终端留下明确原因）。
			if (state?.sawManifest) return;
			this.warn(
				`${environment} 构建未命中 @tanstack/router-core 的 ` +
					`manifest 模块，modulepreload 的 fetchPriority 未被改写。` +
					(environment === "client"
						? `请确认 @tanstack/router-core 仍被打进客户端 bundle。`
						: `SSR 构建可能把 node_modules externalize 了（Windows 下 ` +
							`ssr.noExternal: [] 会如此）；需要把 @tanstack/react-router 与 ` +
							`@tanstack/router-core 加入 noExternal 才能生效。`),
			);
		},
	};
}

export default modulePreloadPriority;
