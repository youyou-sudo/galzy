// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameCard } from "./card";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("GameCard.ThumbHashImage transition", () => {
	it("crossfades a statically-blurred placeholder into an unblurred image using only cheap opacity/transform", () => {
		vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
			false,
		);
		const { container } = render(
			<GameCard.ThumbHashImage
				alt="封面"
				height={300}
				src="https://example.com/cover.webp"
				thumbhash="XakJJYI/WFWSaGZ1d/ZXdnlw5gdn"
				width={200}
			/>,
		);

		const image = container.querySelector<HTMLImageElement>('img[alt="封面"]');
		const placeholder = container.querySelector<HTMLImageElement>(
			"img.galzy-thumbhash-placeholder",
		);
		expect(image).not.toBeNull();
		expect(placeholder).not.toBeNull();

		// 真实图不参与模糊动画；占位图保留静态模糊。
		expect(image?.style.filter).toBe("");
		expect(placeholder?.style.filter).toBe("blur(24px)");

		fireEvent.load(image!);

		// 加载完成后真实图仅做 transform 缩放，占位图仅做 opacity 淡出。
		expect(image?.style.transform).toBe("scale(1)");
		expect(placeholder?.style.opacity).toBe("0");
		expect(placeholder?.style.transform).toBe("");
		expect(placeholder?.style.transition).toBe("opacity 500ms ease-out");
		expect(placeholder?.style.transitionDelay).toBe("0s");
	});
});
