export const DEFAULT_GAME_IMAGE_RATIO = 9 / 13;

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
