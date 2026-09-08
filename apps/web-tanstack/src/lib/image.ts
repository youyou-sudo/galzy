import { thumbHashToDataURL } from "thumbhash";
import { useEffect, useState } from "react";

export const DEFAULT_GAME_IMAGE_RATIO = 9 / 13;

const thumbHashCache = new Map<string, string | null>();
const thumbHashListeners = new Map<string, Set<(dataUrl: string | null) => void>>();
const decodeQueue: string[] = [];
/** fallback drain（无 Worker 路径）是否已排程 */
let decodeScheduled = false;
/** 虚拟滚动进行中置 true：暂停 Worker 派发 / 主线程 drain / 结果通知，
 * 滚动结束由 setThumbHashDecodePaused(false) 恢复。 */
let decodePaused = false;
/** 暂停期间解出的结果先攒在这里，恢复时统一通知（避免 setState 提交洒进滚动帧） */
const deferredResults: Array<{ value: string; dataUrl: string | null }> = [];
/** 已派发给 Worker、等待回复的 thumbhash key（防止 Worker 出错时丢失任务） */
const inFlightValues = new Set<string>();
/** fallback setTimeout 路径单片时间预算（rIC 的 deadline.timeRemaining 之外的兜底） */
const FALLBACK_SLICE_BUDGET_MS = 8;

/** Worker 单例：undefined = 未初始化，null = 不可用（SSR / 创建失败 / 运行出错） */
let worker: Worker | null | undefined;

function decodeThumbHash(value: string): Uint8Array[] {
	const normalized = value.trim();
	if (!normalized) return [];

	const candidates: Uint8Array[] = [];

	try {
		const base64 = normalized.replaceAll("-", "+").replaceAll("_", "/");
		const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
		const binary = atob(padded);
		candidates.push(
			Uint8Array.from(binary, (character) => character.charCodeAt(0)),
		);
	} catch {
		// Try the optional hexadecimal representation below.
	}

	if (/^[0-9a-f]+$/i.test(normalized) && normalized.length % 2 === 0) {
		candidates.push(
			Uint8Array.from({ length: normalized.length / 2 }, (_, index) =>
				Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16),
			),
		);
	}

	return candidates;
}

/** Decode a Kungal ThumbHash into a browser-ready placeholder data URL.
 * 命中缓存时同步返回；未命中会在调用线程同步解码（阻塞）——
 * 惰性路径请改用 useThumbHashDataUrl：解码进 Worker（不可用时退回主线程
 * idle 分片管线），完成后经缓存 + 订阅链通知。 */
export function getThumbHashDataUrl(thumbhash?: string | null): string | null {
	if (!thumbhash) return null;
	const value = thumbhash.trim();
	if (!value) return null;
	if (thumbHashCache.has(value)) return thumbHashCache.get(value) ?? null;

	const candidates = decodeThumbHash(value);
	if (candidates.length === 0) {
		thumbHashCache.set(value, null);
		return null;
	}

	for (const bytes of candidates) {
		try {
			const dataUrl = thumbHashToDataURL(bytes);
			thumbHashCache.set(value, dataUrl);
			return dataUrl;
		} catch {
			// Try the next supported encoding before falling back to the real image.
		}
	}

	thumbHashCache.set(value, null);
	return null;
}

/** 主线程同步解码（fallback 管线 / 显式调用用；含负结果缓存）。 */
function decodeThumbHashCached(value: string): string | null {
	const cached = thumbHashCache.get(value);
	if (cached !== undefined) return cached;

	let result: string | null = null;
	for (const bytes of decodeThumbHash(value)) {
		try {
			result = thumbHashToDataURL(bytes);
			break;
		} catch {
			// Try the next supported encoding before falling back to null.
		}
	}
	thumbHashCache.set(value, result);
	return result;
}

function scheduleIdleCallback(
	callback: (deadline: IdleDeadline | undefined) => void,
): void {
	if (typeof requestIdleCallback === "function") {
		requestIdleCallback((deadline) => callback(deadline), { timeout: 200 });
	} else {
		setTimeout(() => callback(undefined), 32);
	}
}

/** 写缓存 + 派发通知；滚动中先攒进 deferredResults，恢复时补发。 */
function resolveThumbHash(value: string, dataUrl: string | null): void {
	thumbHashCache.set(value, dataUrl);
	if (decodePaused) {
		deferredResults.push({ value, dataUrl });
		return;
	}
	notifyThumbHash(value, dataUrl);
}

function notifyThumbHash(value: string, dataUrl: string | null): void {
	const listeners = thumbHashListeners.get(value);
	if (!listeners) return;
	thumbHashListeners.delete(value);
	for (const listener of listeners) listener(dataUrl);
}

function getWorker(): Worker | null {
	if (worker !== undefined) return worker;
	worker = null;
	if (typeof window === "undefined" || typeof Worker === "undefined") {
		return worker;
	}
	try {
		const instance = new Worker(
			new URL("./thumbhash.worker.ts", import.meta.url),
			{ type: "module" },
		);
		instance.onmessage = (
			event: MessageEvent<{ value: string; dataUrl: string | null }>,
		) => {
			const { value, dataUrl } = event.data;
			inFlightValues.delete(value);
			resolveThumbHash(value, dataUrl);
		};
		instance.onerror = () => {
			// Worker 加载/运行失败（CSP、极老引擎等）：标记不可用并永久回退，
			// 把在途任务退回主线程分片管线，本会话不再尝试建 Worker。
			worker = null;
			try {
				instance.terminate();
			} catch {
				// Ignore
			}
			for (const value of inFlightValues) decodeQueue.push(value);
			inFlightValues.clear();
			scheduleFallbackDrain();
		};
		worker = instance;
	} catch {
		worker = null;
	}
	return worker;
}

/** 主线程 fallback drain：rIC 用 deadline 预算，setTimeout 用 8ms 计时预算，
 * 超出即让出主线程，杜绝「整队一次跑完」的 20–60ms 尖刺。 */
function drainFallback(deadline: IdleDeadline | undefined): void {
	if (decodePaused) {
		// 滚动中：放弃本片，恢复时由 setThumbHashDecodePaused 重新调度
		decodeScheduled = false;
		return;
	}
	const startedAt = performance.now();
	while (decodeQueue.length > 0) {
		const value = decodeQueue.shift();
		if (value === undefined) break;
		resolveThumbHash(value, decodeThumbHashCached(value));
		if (decodeQueue.length > 0) {
			const shouldYield = deadline
				? deadline.timeRemaining() <= 1
				: performance.now() - startedAt >= FALLBACK_SLICE_BUDGET_MS;
			if (shouldYield) {
				decodeScheduled = false;
				scheduleFallbackDrain();
				return;
			}
		}
	}
	decodeScheduled = false;
}

function scheduleFallbackDrain(): void {
	if (decodeScheduled) return;
	decodeScheduled = true;
	scheduleIdleCallback(drainFallback);
}

/** 派发调度：Worker 可用 → 整队 postMessage（主线程侧零计算，无帧预算问题）；
 * 不可用 → 主线程 idle 分片管线。滚动中不派发，恢复时补跑。 */
function schedulePump(): void {
	if (decodePaused) return;
	const activeWorker = getWorker();
	if (activeWorker) {
		while (decodeQueue.length > 0) {
			const value = decodeQueue.shift();
			if (value === undefined) break;
			inFlightValues.add(value);
			activeWorker.postMessage({ value, candidates: decodeThumbHash(value) });
		}
		return;
	}
	scheduleFallbackDrain();
}

function enqueueThumbHashDecode(value: string): void {
	// listeners 条目在任务解出前一直存在：同时充当「排队/在途」去重标记
	if (thumbHashListeners.has(value)) return;
	thumbHashListeners.set(value, new Set());
	decodeQueue.push(value);
	schedulePump();
}

/** 虚拟滚动信号（games/index.tsx 传入 virtualizer.isScrolling）：
 * true 期间解码暂停、结果暂存；false 时补发暂存结果并恢复调度。 */
export function setThumbHashDecodePaused(paused: boolean): void {
	if (decodePaused === paused) return;
	decodePaused = paused;
	if (paused) return;

	const results = deferredResults.splice(0);
	for (const { value, dataUrl } of results) notifyThumbHash(value, dataUrl);
	schedulePump();
}

function subscribeThumbHash(
	value: string,
	listener: (dataUrl: string | null) => void,
): () => void {
	if (thumbHashCache.has(value)) {
		listener(thumbHashCache.get(value) ?? null);
		return () => {};
	}
	enqueueThumbHashDecode(value);
	const listeners = thumbHashListeners.get(value);
	listeners?.add(listener);
	return () => {
		listeners?.delete(listener);
	};
}

/** ThumbHash 占位 data URL 的 React hook。
 * 缓存命中 → 同步返回（不产生额外渲染）；未命中 → 先返回 null
 *（占位层此时渲染骨架底），解码优先派发给 Web Worker（IDCT + PNG 编码
 * 完全移出主线程），Worker 不可用时回退主线程 requestIdleCallback /
 * setTimeout（8ms 分片）管线，完成后通过 state 更新。
 * 虚拟滚动进行中（setThumbHashDecodePaused）解码与通知整体挂起。 */
export function useThumbHashDataUrl(
	thumbhash?: string | null,
): string | null {
	const [dataUrl, setDataUrl] = useState<string | null>(() => {
		if (!thumbhash) return null;
		return thumbHashCache.get(thumbhash.trim()) ?? null;
	});

	useEffect(() => {
		const value = thumbhash?.trim();
		if (!value) {
			setDataUrl(null);
			return;
		}
		if (thumbHashCache.has(value)) {
			setDataUrl(thumbHashCache.get(value) ?? null);
			return;
		}
		setDataUrl(null);
		return subscribeThumbHash(value, setDataUrl);
	}, [thumbhash]);

	return dataUrl;
}

/** Return a safe CSS aspect ratio from an image's intrinsic dimensions. */
export function getImageRatio(
	width?: number | null,
	height?: number | null,
	fallback = DEFAULT_GAME_IMAGE_RATIO,
): number {
	if (
		typeof width !== "number" ||
		!Number.isFinite(width) ||
		width <= 0 ||
		typeof height !== "number" ||
		!Number.isFinite(height) ||
		height <= 0
	) {
		return fallback;
	}

	return width / height;
}
