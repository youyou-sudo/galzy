import { useRouter, type RegisteredRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

/**
 * 首屏渲染完成后，浏览器空闲时预取路由（JS chunk + loader 数据）。
 * 之后导航命中路由缓存，体验如 SPA 般即时；预取发生在空闲时段，不阻塞首屏加载。
 * targets 在每次渲染时更新（ref 持有），effect 仅在挂载时注册一次，重复调用幂等。
 */
export function useIdlePreload(
	targets: ReadonlyArray<(router: RegisteredRouter) => void>,
) {
	const router = useRouter();
	const targetsRef = useRef(targets);
	targetsRef.current = targets;

	useEffect(() => {
		const run = () => {
			for (const target of targetsRef.current) {
				try {
					target(router);
				} catch {
					// 预取失败静默忽略，不影响后续导航
				}
			}
		};
		if (typeof requestIdleCallback === "function") {
			const handle = requestIdleCallback(run, { timeout: 2000 });
			return () => cancelIdleCallback(handle);
		}
		const handle = window.setTimeout(run, 300);
		return () => window.clearTimeout(handle);
	}, [router]);
}
