import { idlePrefetchAllowed } from "@web/hooks/use-viewport-preload";
import { type RegisteredRouter, useRouter } from "@web/lib/nav";
import { isViewTransitionActive } from "@web/lib/view-transition";
import { useEffect, useRef } from "react";

/**
 * 整页空闲预取预算：一次文档内最多预取这么多个路由。
 * 首页有 5 个「更多…」入口、详情页有 6 个 tab（下载/详情/攻略/讨论/统计/系列），
 * 叠加起来仍会占满浏览器同源连接池，给点击导航造成排队（实测首页一次 16 条
 * `?_furin=data` 中 5 条来自这里）。预算按整页计，所以取「详情页 tab 数 + 1」，
 * 让 6 个 tab 全都能预热、首页仍有一格余量；预算在文档生命周期内共享，
 * 滚动/懒加载不会重置。
 */
const IDLE_PRELOAD_BUDGET = 7;
let idlePrefetchBudget = IDLE_PRELOAD_BUDGET;

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
 * staggerMs > 0 时错峰执行：每隔 staggerMs 发一个预取，避免详情页 6 个 tab
 * 同时 prefetch 抢占返回列表所需的主线程/网络。卸载时取消剩余任务。
 * 另外做了三层节流，避免「预取把页面拖住」：
 * - 等 `load` 事件之后再找空闲（首屏图片/字体下完之前不抢连接）；
 * - 省流/弱网（saveData、2g）不预取；
 * - 整页预算 `IDLE_PRELOAD_BUDGET`，超出就不再自动预取；
 * - `bun --hot` 开发模式（按需编译，预取会阻塞调试）直接跳过。
 */
export function useIdlePreload(
	targets: ReadonlyArray<(router: RegisteredRouter) => void>,
	options?: { staggerMs?: number },
) {
	const router = useRouter();
	const routerRef = useRef(router);
	// 只更新 ref，不进 effect 依赖：router 每次导航都会换引用，
	// 作为依赖会让 effect 重跑、重新调度整页空闲预取。
	useEffect(() => {
		routerRef.current = router;
	}, [router]);
	const targetsRef = useRef(targets);
	targetsRef.current = targets;
	const staggerMs = options?.staggerMs ?? 0;

	useEffect(() => {
		// 策略关闭 / 省流 / 弱网 / 开发模式：跳过一切空闲预取
		if (!idlePrefetchAllowed()) return;

		let cancelled = false;
		const timers: Array<ReturnType<typeof setTimeout>> = [];
		let idleHandle: number | undefined;
		/** VT 结束轮询的 rAF 句柄 */
		let frameHandle: number | undefined;

		const runOne = (index: number) => {
			if (cancelled) return;
			try {
				targetsRef.current[index]?.(routerRef.current);
			} catch {
				// 预取失败静默忽略，不影响后续导航
			}
		};

		/** 真正执行 targets（staggerMs > 0 时按索引错峰） */
		const runTargets = () => {
			if (cancelled) return;
			// 后台标签页、预算耗尽时不预取
			if (
				(typeof document !== "undefined" &&
					document.visibilityState === "hidden") ||
				idlePrefetchBudget <= 0
			) {
				return;
			}
			const allowed = Math.min(idlePrefetchBudget, targetsRef.current.length);
			idlePrefetchBudget -= allowed;
			const targets = targetsRef.current.slice(0, allowed);
			if (staggerMs > 0) {
				targets.forEach((_, index) => {
					timers.push(setTimeout(() => runOne(index), index * staggerMs));
				});
			} else {
				for (const [index] of targets.entries()) runOne(index);
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

		/** 等首屏资源全部就绪（load）之后再进入空闲调度，避免和图片抢连接 */
		const scheduleWhenIdle = () => {
			if (cancelled) return;
			if (typeof requestIdleCallback === "function") {
				idleHandle = requestIdleCallback(run, { timeout: 3000 });
			} else {
				timers.push(setTimeout(run, 800));
			}
		};

		if (typeof document !== "undefined" && document.readyState !== "complete") {
			const onLoad = () => scheduleWhenIdle();
			window.addEventListener("load", onLoad, { once: true });
			return () => {
				cancelled = true;
				window.removeEventListener("load", onLoad);
				for (const t of timers) clearTimeout(t);
			};
		}
		scheduleWhenIdle();

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
		// router 走 ref，故意不进依赖：否则每次导航都会重新注册预取调度
	}, [staggerMs]);
}
