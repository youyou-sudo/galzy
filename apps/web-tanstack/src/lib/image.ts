import { thumbHashToDataURL } from "thumbhash";
import { useEffect, useState } from "react";

export const DEFAULT_GAME_IMAGE_RATIO = 9 / 13;

const thumbHashCache = new Map<string, string | null>();
const thumbHashListeners = new Map<string, Set<(dataUrl: string | null) => void>>();
const decodeQueue: string[] = [];
let decodeScheduled = false;

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
 * 命中缓存时同步返回；未命中会在 render 体内同步解码（阻塞）——
 * 新组件请改用 useThumbHashDataUrl，把解码挪到 idle 回调。 */
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

function decodeAndNotify(value: string): void {
	const dataUrl = decodeThumbHashCached(value);
	const listeners = thumbHashListeners.get(value);
	if (!listeners) return;
	thumbHashListeners.delete(value);
	for (const listener of listeners) listener(dataUrl);
}

function queueThumbHashDecode(value: string): void {
	if (!thumbHashListeners.has(value)) {
		thumbHashListeners.set(value, new Set());
		decodeQueue.push(value);
	}
	if (decodeScheduled) return;
	decodeScheduled = true;

	const drain = (deadline: IdleDeadline | undefined) => {
		while (decodeQueue.length > 0) {
			const next = decodeQueue.shift();
			if (next === undefined) break;
			decodeAndNotify(next);
			// 一帧内只花剩余预算，超时则把余量让给下一帧 idle，避免长任务。
			if (
				deadline &&
				decodeQueue.length > 0 &&
				deadline.timeRemaining() <= 1
			) {
				scheduleIdleCallback(drain);
				return;
			}
		}
		decodeScheduled = false;
	};

	scheduleIdleCallback(drain);
}

function subscribeThumbHash(
	value: string,
	listener: (dataUrl: string | null) => void,
): () => void {
	if (thumbHashCache.has(value)) {
		listener(thumbHashCache.get(value) ?? null);
		return () => {};
	}
	queueThumbHashDecode(value);
	const listeners = thumbHashListeners.get(value);
	listeners?.add(listener);
	return () => {
		listeners?.delete(listener);
	};
}

/** ThumbHash 占位 data URL 的 React hook。
 * 缓存命中 → 同步返回（不产生额外渲染）；未命中 → 先返回 null
 *（占位层此时渲染骨架底），解码安排在 requestIdleCallback（fallback setTimeout）
 * 中分批执行，完成后通过 state 更新。避免 24 个新 key 在「加载更多」时
 * 于 render 体内同步 canvas 绘制 + PNG 编码造成数十 ms 阻塞。 */
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
