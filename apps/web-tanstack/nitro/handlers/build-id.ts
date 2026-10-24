import { BUILD_ID } from "virtual:build-id";

/**
 * GET /_build — 构建指纹端点。
 *
 * 客户端（见 src/routes/__root.tsx 里的内联脚本）在标签页重新可见时轮询它：
 * buildId 与页面里的 window.__BUILD_ID__ 不一致就整页刷新，避免部署后旧页面
 * 继续调用已不存在的 server function 哈希。
 *
 * 返回构建期常量（与页面同一个 virtual:build-id 模块），不读运行时 env：
 * 两者必然一致，即使部署平台只在运行期注入 BUILD_ID 也不会误判成"新版本"。
 *
 * 旧的自写 Bun 服务器在 fetch 里手写这个分支；改用 Nitro 后由这条 handler 提供，
 * 在 vite.config.ts 的 nitro({ handlers }) 注册，不进入 TanStack Router 路由树。
 */
export default () =>
	Response.json(
		{ buildId: BUILD_ID },
		{ headers: { "cache-control": "no-store" } },
	);
