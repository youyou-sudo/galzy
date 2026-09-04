import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { installViewTransitionTracker } from "./lib/view-transition";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const context = getContext();

	installViewTransitionTracker();

	const router = createTanStackRouter({
		routeTree,

		context,

		scrollRestoration: true,
		// 路由导航包裹在 document.startViewTransition() 中；配合页面内共享元素
		// （游戏封面/标题的 view-transition-name）实现封面「飞入详情页」的共享元素过渡
		defaultViewTransition: true,
		defaultPreload: "intent",
		// 预加载(悬停/空闲)产生的 loader 数据在 30s 内点击直接复用，实现秒开；
		// view/下载计数不依赖 loader(见 onEnter)，预加载不会污染统计
		defaultPreloadStaleTime: 30_000,
		// loader 等待超过 100ms 立即渲染 pendingComponent 骨架屏（默认 1000ms），
		// 快速点击时旧页面不再冻结等待，体验接近 SPA 即时切换
		defaultPendingMs: 100,
		defaultPendingMinMs: 100,
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient: context.queryClient,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
