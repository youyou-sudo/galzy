/**
 * 生产入口：把 Nitro（bun preset）产物编译成单文件可执行程序。
 *
 * 编译由 scripts/build-binary.ts 完成：
 *   1. 脚本把 .output/public/** 逐个以 `with { type: "file" }` 引入（Bun 内嵌），
 *      生成 .assets.generated.ts；
 *   2. `bun build --compile --asset-naming="[dir]/[name].[ext]"` 保留目录结构，
 *      内嵌资源在二进制里的虚拟路径为 <root>/.output/public/...；
 *   3. Nitro 的静态资源处理器按 `__nitro_main__` 的 dirname + assets[id].path
 *      （即 ../public/<path>）读文件，所以这里在 import Nitro 入口之前把
 *      __nitro_main__ 固定成 <root>/.output/server/index.mjs —— node:fs 在 Bun
 *      可执行文件里可以直接读内嵌文件。
 *
 * 运行镜像里因此只有一个二进制：没有 Bun 运行时、node_modules、public 目录。
 * 镜像没有 shell/curl，所以 --healthcheck 由本程序自己实现。
 */

import { assetCount } from "./.assets.generated";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// ── 健康检查模式 ───────────────────────────────────────────────
// 供 Docker HEALTHCHECK 调用：请求本机 /api/health，成功退出 0，失败退出 1。
// 必须在 import Nitro 入口之前返回，否则会重复启动一个监听进程。
if (process.argv.includes("--healthcheck")) {
	const port = Number(process.env.PORT || 3000);
	const url = `http://127.0.0.1:${port}/api/health`;
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
		if (!res.ok || body.ok !== true) {
			console.error(`[healthcheck] ${url} -> ${res.status} ${res.statusText}`);
			process.exit(1);
		}
		console.log(`[healthcheck] ${url} -> ok`);
		process.exit(0);
	} catch (error) {
		console.error(`[healthcheck] ${url} -> ${(error as Error).message}`);
		process.exit(1);
	}
}

// ── 内嵌资源路径 ───────────────────────────────────────────────
// 二进制内 import.meta.url 形如 file:///$bunfs/root/server-prod.ts；
// 指向 .output/server/index.mjs 后，Nitro 解析出的 ../public/<path>
// 正好落在内嵌资源所在的 $bunfs 目录。
const rootDir = dirname(fileURLToPath(import.meta.url));
const nitroMain = pathToFileURL(
	join(rootDir, ".output", "server", "index.mjs"),
).href;

// Nitro 入口首行是 `globalThis.__nitro_main__ = import.meta.url`：这里用访问器
// 吞掉那次赋值，让静态资源路径始终解析到二进制内的虚拟目录。
Object.defineProperty(globalThis, "__nitro_main__", {
	configurable: true,
	get: () => nitroMain,
	set: () => {},
});

await import("./.output/server/index.mjs");

console.log(
	`[server] compiled binary · embedded assets: ${assetCount} · BUILD_ID: ${process.env.BUILD_ID || "dev"}`,
);
