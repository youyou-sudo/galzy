import { registerHooks } from "node:module";

/**
 * 测试运行时只跑 redact（不落回真实 react）。
 *
 * 背景：vitest 默认把 node_modules 里的依赖 externalize，交给 Node 原生加载；
 * redact 只通过 Vite 插件（resolve.alias + 插件 resolveId）生效，所以 CJS
 * 依赖内部的 require 会拿到 node_modules 里的真实 react/react-dom，与 Vite
 * 模块图里的 redact 形成两套运行时：
 *   - 真实 react 的 hook 在 redact 渲染树里调用 → "Cannot read properties of
 *     null (reading 'useCallback')"
 *   - redact 的 hook 在真实 react-dom 渲染树里调用 → getDispatcher 报错
 *
 * 两道兜底（vitest.config.ts 里已全量内联 noExternal，依赖走 Vite）：
 * 1. 原生模块钩子：把 redact 插件实际别名的 specifier 的原生 require/import
 *    指回 Vite 侧的同一份模块实例（不手写别名表，specifier 列表取自插件自己
 *    的 alias 配置，插件升级后自动跟进）。
 * 2. 微任务同步排空：redact 的状态更新 / useEffect 走 queueMicrotask 批量提交，
 *    而 RTL 的 render、「fireEvent 后立即断言 DOM」这些生态惯例依赖真实
 *    react-dom 在 render / 事件派发结束时同步 flush。把 queueMicrotask 收敛成
 *    同步 FIFO 队列后，render()/fireEvent 返回时 DOM 已是终态。
 */

const INSTALLED = Symbol.for("galzy.vitest.redact-test-runtime");

if (!(globalThis as Record<symbol, unknown>)[INSTALLED]) {
	(globalThis as Record<symbol, unknown>)[INSTALLED] = true;
	await installRedactNativeBridge();
	installSyncMicrotasks();
}

/**
 * 原生 require()/import() 桥接。
 *
 * 原生 require 只能拿到 CJS 形状（module.exports），所以用 load 钩子返回一个
 * 转发到 globalThis 桥接表的虚拟 CJS 模块，值为 Vite 侧加载的 ESM 命名空间。
 * 由于 ESM 命名空间对象本身带全部具名导出，CJS 侧 require("react").useState
 * 等访问方式照常工作。
 */
async function installRedactNativeBridge(): Promise<void> {
	const { redact } = await import("@tanstack/redact/vite");
	const [redactPlugin] = redact() as unknown as [
		{
			configResolved: (config: { root: string }) => void;
			config: () => {
				environments?: {
					client?: { resolve?: { alias?: Record<string, string> } };
				};
			};
		},
	];

	// configResolved 把别名表解析成磁盘绝对路径（沿用插件的解析逻辑）；
	// config() 暴露插件覆盖的 specifier 列表。
	redactPlugin.configResolved({ root: process.cwd() });
	const aliasSpecifiers = Object.keys(
		redactPlugin.config().environments?.client?.resolve?.alias ?? {},
	);

	type ModuleNamespace = Record<string, unknown>;
	const bridge = Object.create(null) as Record<string, ModuleNamespace>;
	(globalThis as Record<string, unknown>).__REDACT_MODULE_BRIDGE__ = bridge;

	await Promise.all(
		aliasSpecifiers.map(async (specifier) => {
			// 变量形式的动态 import 由 vitest 模块运行器解析，会命中 redact 别名，
			// 拿到的正是应用源码 import 到的同一份模块实例。
			bridge[specifier] = (await import(
				/* @vite-ignore */ specifier
			)) as ModuleNamespace;
		}),
	);

	const BRIDGE_PREFIX = "redact-bridge:";
	const bridgeUrl = (specifier: string) =>
		BRIDGE_PREFIX + encodeURIComponent(specifier);

	registerHooks({
		resolve(specifier, context, nextResolve) {
			if (Object.hasOwn(bridge, specifier)) {
				return { url: bridgeUrl(specifier), shortCircuit: true };
			}
			return nextResolve(specifier, context);
		},
		load(url, context, nextLoad) {
			if (!url.startsWith(BRIDGE_PREFIX)) return nextLoad(url, context);
			const specifier = decodeURIComponent(url.slice(BRIDGE_PREFIX.length));
			return {
				format: "commonjs",
				shortCircuit: true,
				source: `module.exports = globalThis.__REDACT_MODULE_BRIDGE__[${JSON.stringify(specifier)}];`,
			};
		},
	});
}

/**
 * queueMicrotask → 同步 FIFO 队列。
 *
 * redact 的批处理收敛点都在 queueMicrotask 上：
 *   - reconcile.scheduleUpdate → queueMicrotask(flushPending)
 *   - reconcile.flushEffects → queueMicrotask(passive effects)
 * 测试里需要「调用返回即终态」：RTL 的 render() 不 await act（React 19 的 act
 * 是同步 flush 的），fireEvent 之后也普遍立即断言。同步排空期间新入队的回调
 * 在同一次排空中继续处理（不递归、保持 FIFO 顺序），等价于把 redact 的批量
 * 提交点提前到调用返回之前，与其「同步渲染」的设计一致。
 */
function installSyncMicrotasks(): void {
	const queue: Array<() => void> = [];
	let draining = false;
	const drain = () => {
		if (draining) return;
		draining = true;
		try {
			while (queue.length > 0) {
				const task = queue.shift()!;
				task();
			}
		} finally {
			draining = false;
		}
	};
	globalThis.queueMicrotask = (callback: () => void) => {
		queue.push(callback);
		drain();
	};
}