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

describe("GameCard.ThumbHashImage coarse placeholder unmount", () => {
	// card.tsx 在模块级一次性求值 matchMedia（coarse 快照），
	// 必须先注入 matchMedia 再 resetModules + 动态导入才能让新模块捕获 coarse=true。
	// jsdom 未实现 matchMedia，直接赋值到 window 上。
	async function renderWithCoarse(props: {
		alt: string;
		src: string;
		width: number;
		height: number;
		placeholderOnly?: boolean;
	}) {
		const coarseQuery = {
			matches: true,
			addEventListener: () => {},
			removeEventListener: () => {},
		};
		(window as { matchMedia?: unknown }).matchMedia = () => coarseQuery;
		vi.resetModules();
		const { GameCard } = await import("./card");
		vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
			false,
		);
		return render(<GameCard.ThumbHashImage {...props} />);
	}

	afterEach(() => {
		delete (window as { matchMedia?: unknown }).matchMedia;
	});

	it("coarse 指针下揭示完成后占位 img 从 DOM 卸载，真实图保留", async () => {
		const { container } = await renderWithCoarse({
			alt: "封面",
			height: 300,
			src: "https://example.com/cover.webp",
			width: 200,
		});

		const placeholder = container.querySelector<HTMLImageElement>(
			"img.galzy-thumbhash-placeholder",
		);
		// 触屏无 opacity 过渡，占位图直接终态
		expect(placeholder).not.toBeNull();
		expect(placeholder?.style.transition).toBe("");

		const image = container.querySelector<HTMLImageElement>('img[alt="封面"]');
		fireEvent.load(image!);

		// 触屏揭示为瞬时终态，占位图直接卸载减少常驻图层；真实图不受影响。
		expect(
			container.querySelector("img.galzy-thumbhash-placeholder"),
		).toBeNull();
		expect(container.querySelector('img[alt="封面"]')).not.toBeNull();
	});

	it("placeholderOnly（敏感未揭示态）下即使 coarse 占位图也保持常驻", async () => {
		const { container } = await renderWithCoarse({
			alt: "封面",
			height: 300,
			placeholderOnly: true,
			src: "https://example.com/cover.webp",
			width: 200,
		});

		// placeholderOnly 时占位图是唯一可见内容（真实图不渲染），永不卸载。
		expect(
			container.querySelector("img.galzy-thumbhash-placeholder"),
		).not.toBeNull();
		expect(container.querySelector('img[alt="封面"]')).toBeNull();
	});
});
