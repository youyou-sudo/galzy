import { TanStackDevtools } from "@tanstack/react-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import TanStackQueryDevtools from "@web/integrations/tanstack-query/devtools";

/**
 * TanStack 开发者工具（仅开发环境）。
 *
 * 由 `src/routes/__root.tsx` 在 `import.meta.env.DEV` 条件下以 React.lazy 动态导入：
 * 生产构建时该条件被静态求值为 false，分支连同这里的三个 devtools 包一起被
 * tree-shake，不进入客户端产物（之前是 __root 静态 import，生产 bundle 也带着）。
 * 面板位置 / 插件名与改造前的全站渲染完全一致。
 */
export default function Devtools() {
	return (
		<TanStackDevtools
			config={{
				position: "bottom-right",
			}}
			plugins={[
				{
					name: "Tanstack Router",
					render: <TanStackRouterDevtoolsPanel />,
				},
				TanStackQueryDevtools,
			]}
		/>
	);
}
