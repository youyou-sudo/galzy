// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameCard } from "./card";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("GameCard.ThumbHashImage transition", () => {
	it("crossfades a blurred placeholder into a sharpening image", () => {
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

		const image = container.querySelector('img[alt="封面"]');
		const placeholder = container.querySelector(
			"img.galzy-thumbhash-placeholder",
		);
		expect(image).not.toBeNull();
		expect(placeholder).not.toBeNull();
		expect(image?.style.filter).toBe("blur(24px)");
		expect(placeholder?.style.filter).toBe("blur(0)");

		fireEvent.load(image!);

		expect(image?.style.filter).toBe("blur(0)");
		expect(placeholder?.style.filter).toBe("blur(24px)");
		expect(placeholder?.style.opacity).toBe("0");
		expect(placeholder?.style.transition).toBe(
			"filter 600ms ease-out, opacity 600ms ease-out",
		);
		expect(placeholder?.style.transitionDelay).toBe("0s");
	});
});
