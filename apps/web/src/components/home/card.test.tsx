import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameCard } from "./card";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("GameCard.ThumbHashImage", () => {
	it("keeps its initial markup identical when reduced motion is enabled", () => {
		const props = {
			alt: "封面",
			height: 300,
			src: "https://example.com/cover.webp",
			width: 200,
		};

		const serverMarkup = renderToString(<GameCard.ThumbHashImage {...props} />);
		vi.stubGlobal("window", {
			matchMedia: () => ({ matches: true }),
		});
		const clientMarkup = renderToString(<GameCard.ThumbHashImage {...props} />);

		expect(clientMarkup).toBe(serverMarkup);
	});
});
