import { thumbHashToDataURL } from "thumbhash";

export const DEFAULT_GAME_IMAGE_RATIO = 9 / 13;

const thumbHashCache = new Map<string, string | null>();

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

/** Decode a Kungal ThumbHash into a browser-ready placeholder data URL. */
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
