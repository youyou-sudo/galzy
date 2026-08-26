import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_IMAGE_RATIO, getImageRatio } from "./image";

describe("getImageRatio", () => {
	it("uses the intrinsic image dimensions", () => {
		expect(getImageRatio(300, 400)).toBe(0.75);
	});

	it("falls back when dimensions are unavailable or invalid", () => {
		expect(getImageRatio(null, 400)).toBe(DEFAULT_GAME_IMAGE_RATIO);
		expect(getImageRatio(300, 0)).toBe(DEFAULT_GAME_IMAGE_RATIO);
		expect(getImageRatio(Number.NaN, 400)).toBe(DEFAULT_GAME_IMAGE_RATIO);
		expect(getImageRatio(null, null, 2 / 3)).toBe(2 / 3);
	});
});
