import { useRouter, type RegisteredRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

/**
 * 首屏渲染完成后，浏览器空闲时预取路由（JS chunk + loader 数据）。
 * 之后导航命中路由缓存，体验如 SPA 般即时；预取发生在空闲时段，不阻塞首屏加载。
 * targets 在每次渲染时更新（ref 持有），effect 仅在挂载时注册一次，重复调用幂等。
 *
 * staggerMs > 0 时错峰执行：每隔 staggerMs 发一个预取，避免详情页 5 个 tab
 * 同时 preloadRoute 抢占返回列表所需的主线程/网络。卸载时取消剩余任务。
 * 省流模式（navigator.saveData）下直接跳过全部预取。
 */
export function useIdlePreload(
	targets: ReadonlyArray<(router: RegisteredRouter) => void>,
	options?: { staggerMs?: number },
) {
	const router = useRouter();
	const targetsRef = useRef(targets);
	targetsRef.current = targets;
	const staggerMs = options?.staggerMs ?? 0;

	useEffect(() => {
		// 省流模式：跳过一切预取
		try {
			if (
				typeof navigator !== "undefined" &&
				(navigator as Navigator & { connection?: { saveData?: boolean } })
					.connection?.saveData
			) {
				return;
			}
		} catch {
			// navigator 不可用时继续正常预取
		}

		let cancelled = false;
		const timers: Array<ReturnType<typeof setTimeout>> = [];
		let idleHandle: number | undefined;

		const runOne = (index: number) => {
			if (cancelled) return;
			try {
				targetsRef.current[index]?.(router);
			} catch {
				// 预取失败静默忽略，不影响后续导航
			}
		};

		const run = () => {
			if (cancelled) return;
			if (staggerMs > 0) {
				targetsRef.current.forEach((_, index) => {
					timers.push(setTimeout(() => runOne(index), index * staggerMs));
				});
			} else {
				targetsRef.current.forEach((_, index) => runOne(index));
			}
		};

		if (typeof requestIdleCallback === "function") {
			idleHandle = requestIdleCallback(run, { timeout: 2000 });
		} else {
			timers.push(setTimeout(run, 300));
		}
		return () => {
			cancelled = true;
			for (const t of timers) clearTimeout(t);
			if (idleHandle !== undefined) cancelIdleCallback(idleHandle);
		};
	}, [router, staggerMs]);
}
