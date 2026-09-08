// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameCard } from "./card";

// jsdom 无 canvas 实现，thumbHashToDataURL 必然抛错且解码走异步兜底管线，
// 占位 dataURL 永远不会同步就绪 —— mock 为同步固定值，聚焦揭示动画断言。
vi.mock("@web/lib/image", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@web/lib/image")>();
	return {
		...actual,
		useThumbHashDataUrl: () => "data:image/webp;base64,XakJ",
	};
});

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

		// 真实图不参与模糊动画；占位图无 filter（object-cover 放大天然模糊）。
		expect(image?.style.filter).toBe("");
		expect(placeholder?.style.filter).toBe("");

		fireEvent.load(image!);

		// 加载完成后真实图仅做 transform 缩放，占位图仅做 opacity 淡出。
		expect(image?.style.transform).toBe("scale(1)");
		expect(placeholder?.style.opacity).toBe("0");
		expect(placeholder?.style.transform).toBe("");
		expect(placeholder?.style.transition).toBe("opacity 320ms ease-out");
		expect(placeholder?.style.transitionDelay).toBe("0s");
	});
});
