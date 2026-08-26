import { useRouter, type RegisteredRouter } from "@tanstack/react-router";
import { useEffect, useRef, type RefObject } from "react";

/** 全局并发上限：整屏卡片同时进入视口时避免瞬时打爆 server function RPC */
const MAX_CONCURRENT = 4;

interface QueueEntry {
	run: () => void;
	cancelled: boolean;
	/** 并发名额是否已归还（完成时正常归还 / 取消时提前归还，二选一） */
	slotReleased: boolean;
}

let active = 0;
const waiting: QueueEntry[] = [];

function pump() {
	while (waiting.length > 0 && active < MAX_CONCURRENT) {
		const entry = waiting.shift();
		if (entry && !entry.cancelled) entry.run();
	}
}

function releaseSlot(entry: QueueEntry) {
	if (entry.slotReleased) return;
	entry.slotReleased = true;
	if (active > 0) active--;
	pump();
}

/**
 * 带取消的预取调度，返回 cancel 函数：
 * - 排队中取消 → 直接出队，请求不会发起
 * - 进行中取消 → 立即归还并发名额，让位给新进入视口的条目；
 *   底层请求自然收尾并把数据写入路由缓存（router 无公开的单预取中止 API，
 *   且半途丢弃已传输数据纯属浪费），只是不再占用调度额度
 */
function schedule(task: () => Promise<unknown>): () => void {
	const entry: QueueEntry = {
		run: () => {},
		cancelled: false,
		slotReleased: false,
	};

	entry.run = () => {
		active++;
		Promise.resolve()
			.then(() => {
				if (!entry.cancelled) return task();
			})
			.catch(() => {})
			.finally(() => releaseSlot(entry));
	};

	if (active < MAX_CONCURRENT) entry.run();
	else waiting.push(entry);

	return () => {
		if (entry.cancelled) return;
		entry.cancelled = true;
		const idx = waiting.indexOf(entry);
		if (idx >= 0) waiting.splice(idx, 1);
		else releaseSlot(entry);
	};
}

/**
 * 链接进入视口时预取路由（JS chunk + loader 数据），Next.js <Link> 的等价行为。
 * 网格中从未请求过的条目在滚入视口前完成预热，点击直接命中路由缓存秒开。
 * - rootMargin 提前 200px 开始，滚动场景下点击前大概率已就绪
 * - 离开视口且预取未完成 → 立即取消（排队中不出队不发、进行中让出名额），
 *   释放浏览器加载能力给后面出现在窗口里的条目；重新进入视口会再次预取
 * - 仅运行 loader，不触发路由 onEnter，view/下载计数不受影响
 */
export function useViewportPreload(
	ref: RefObject<HTMLElement | null>,
	makeTask: (
		router: RegisteredRouter,
	) => (() => Promise<unknown>) | undefined,
) {
	const router = useRouter();
	const makeTaskRef = useRef(makeTask);
	makeTaskRef.current = makeTask;

	useEffect(() => {
		const el = ref.current;
		if (!el || typeof IntersectionObserver === "undefined") return;
		let cancelPreload: (() => void) | null = null;

		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						if (cancelPreload) continue;
						try {
							const task = makeTaskRef.current(router);
							if (task) cancelPreload = schedule(task);
							else io.disconnect();
						} catch {
							// 预取失败静默忽略，不影响后续导航
						}
					} else if (cancelPreload) {
						cancelPreload();
						cancelPreload = null;
					}
				}
			},
			{ rootMargin: "200px" },
		);

		io.observe(el);
		return () => {
			cancelPreload?.();
			io.disconnect();
		};
	}, [router, ref]);
}
