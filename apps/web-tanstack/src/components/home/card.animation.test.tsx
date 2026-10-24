// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameCard } from "./card";

// jsdom 无 canvas 实现，thumbHashToDataURL 必然抛错且解码走异步兜底管线，
// 占位 dataURL 永远不会同步就绪 —— mock 为同步固定值，聚焦揭示动画断言。
// 个别用例要验证「没有 thumbhash 占位」的兜底，通过 hoisted 开关临时置 null。
const thumbhashMock = vi.hoisted(() => ({
	value: "data:image/webp;base64,XakJ" as string | null,
}));

vi.mock("@web/lib/image", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@web/lib/image")>();
	return {
		...actual,
		useThumbHashDataUrl: () => thumbhashMock.value,
	};
});

afterEach(() => {
	thumbhashMock.value = "data:image/webp;base64,XakJ";
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

describe("GameCard.ThumbHashImage revealed-src cache", () => {
	it("重挂命中揭示缓存：首帧无骨架、无缩放动画，但 ThumbHash 占位保留到本次真图加载", () => {
		vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
			false,
		);
		const src = "https://example.com/cached-cover.webp";
		const first = render(
			<GameCard.ThumbHashImage alt="缓存" height={300} src={src} width={200} />,
		);
		fireEvent.load(
			first.container.querySelector<HTMLImageElement>('img[alt="缓存"]')!,
		);
		first.unmount();

		// 重挂（模拟虚拟列表重挂/路由返回）：同一 src 命中已揭示缓存 ——
		// 终态样式直出（无骨架、无缩放动画），但缓存不代表当前 document 里
		// 这张图已经解码可上屏：位图就绪前必须用 thumbhash 占位兜住，否则
		// 路由返回时整屏封面会先空白一段。
		const { container } = render(
			<GameCard.ThumbHashImage alt="缓存" height={300} src={src} width={200} />,
		);
		expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
		const placeholder = container.querySelector<HTMLImageElement>(
			"img.galzy-thumbhash-placeholder",
		);
		expect(placeholder).not.toBeNull();
		expect(placeholder?.style.opacity).toBe("1");
		const image = container.querySelector<HTMLImageElement>('img[alt="缓存"]');
		expect(image?.style.transform).toBe("scale(1)");

		// 本次挂载的真图加载完成后，占位才淡出（桌面保留 320ms 淡出）。
		fireEvent.load(image!);
		expect(
			container.querySelector<HTMLImageElement>(
				"img.galzy-thumbhash-placeholder",
			)?.style.opacity,
		).toBe("0");
	});

	it("缓存命中但该图没有 ThumbHash：位图就绪前用骨架兜住空白", () => {
		thumbhashMock.value = null;
		vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
			false,
		);
		const src = "https://example.com/cached-no-thumbhash.webp";
		const first = render(
			<GameCard.ThumbHashImage
				alt="无占位"
				height={300}
				src={src}
				width={200}
			/>,
		);
		fireEvent.load(
			first.container.querySelector<HTMLImageElement>('img[alt="无占位"]')!,
		);
		first.unmount();

		const { container } = render(
			<GameCard.ThumbHashImage
				alt="无占位"
				height={300}
				src={src}
				width={200}
			/>,
		);
		expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
		fireEvent.load(
			container.querySelector<HTMLImageElement>('img[alt="无占位"]')!,
		);
		expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
	});

	it("已揭示缓存命中后重挂再失败：仍回退 No-Image 而非停留破图", () => {
		vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
			false,
		);
		const src = "https://example.com/expired-cover.webp";
		const first = render(
			<GameCard.ThumbHashImage alt="过期" height={300} src={src} width={200} />,
		);
		fireEvent.load(
			first.container.querySelector<HTMLImageElement>('img[alt="过期"]')!,
		);
		first.unmount();

		// 重挂命中揭示缓存（首帧直出），但此次真实图加载失败（如 CDN 缓存过期）：
		// failed 不能被缓存抑制，必须回退 No-Image 占位。
		const { container } = render(
			<GameCard.ThumbHashImage alt="过期" height={300} src={src} width={200} />,
		);
		fireEvent.error(
			container.querySelector<HTMLImageElement>('img[alt="过期"]')!,
		);
		const image = container.querySelector<HTMLImageElement>('img[alt="过期"]');
		expect(image?.getAttribute("src")).toContain("No-Image-Placeholder");
	});

	it("URL A→B 时不沿用旧 URL 的 loaded 状态", () => {
		vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
			false,
		);
		const { container, rerender } = render(
			<GameCard.ThumbHashImage
				alt="切换"
				height={300}
				src="https://example.com/url-a.webp"
				width={200}
			/>,
		);
		fireEvent.load(
			container.querySelector<HTMLImageElement>('img[alt="切换"]')!,
		);
		expect(
			container.querySelector<HTMLImageElement>(
				"img.galzy-thumbhash-placeholder",
			)?.style.opacity,
		).toBe("0");

		rerender(
			<GameCard.ThumbHashImage
				alt="切换"
				height={300}
				src="https://example.com/url-b.webp"
				width={200}
			/>,
		);
		// 新 URL 未缓存：回到骨架 + 占位 + 未揭示初始态。
		expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
		expect(
			container.querySelector<HTMLImageElement>(
				"img.galzy-thumbhash-placeholder",
			)?.style.opacity,
		).toBe("1");
		expect(
			container.querySelector<HTMLImageElement>('img[alt="切换"]')?.style
				.transform,
		).toBe("scale(1.04)");
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
