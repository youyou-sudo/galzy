import { useRouter, type RegisteredRouter } from "@tanstack/react-router";
import { isViewTransitionActive } from "@web/lib/view-transition";
import { useEffect, useRef } from "react";

/** VT 播放期间延后实际预取的兜底上限：超过仍判定活跃就强制放行，
 * 避免 rAF 被后台标签页节流时预取永久悬空。 */
const VT_DRAIN_TIMEOUT_MS = 1500;

/** 单调时钟（performance 不可用时退回 Date.now） */
function now(): number {
	if (
		typeof performance !== "undefined" &&
		typeof performance.now === "function"
	) {
		return performance.now();
	}
	return Date.now();
}

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
		/** VT 结束轮询的 rAF 句柄 */
		let frameHandle: number | undefined;

		const runOne = (index: number) => {
			if (cancelled) return;
			try {
				targetsRef.current[index]?.(router);
			} catch {
				// 预取失败静默忽略，不影响后续导航
			}
		};

		/** 真正执行 targets（staggerMs > 0 时按索引错峰） */
		const runTargets = () => {
			if (cancelled) return;
			if (staggerMs > 0) {
				targetsRef.current.forEach((_, index) => {
					timers.push(setTimeout(() => runOne(index), index * staggerMs));
				});
			} else {
				targetsRef.current.forEach((_, index) => runOne(index));
			}
		};

		/**
		 * VT 播放期间先不发预取：动态 import + loader 请求会与过渡动画抢主线程，
		 * 等动画结束再执行（用户无感）。逐帧轮询 isViewTransitionActive 到 false；
		 * 无 rAF（SSR/node）或超过兜底时限时直接执行，避免预取永久悬空。
		 */
		const run = () => {
			if (cancelled) return;
			if (
				typeof requestAnimationFrame !== "function" ||
				!isViewTransitionActive()
			) {
				runTargets();
				return;
			}
			const startedAt = now();
			const tick = () => {
				frameHandle = undefined;
				if (cancelled) return;
				if (
					isViewTransitionActive() &&
					now() - startedAt < VT_DRAIN_TIMEOUT_MS
				) {
					frameHandle = requestAnimationFrame(tick);
					return;
				}
				runTargets();
			};
			frameHandle = requestAnimationFrame(tick);
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
			if (frameHandle !== undefined) {
				if (typeof cancelAnimationFrame === "function") {
					cancelAnimationFrame(frameHandle);
				}
				frameHandle = undefined;
			}
		};
	}, [router, staggerMs]);
}
