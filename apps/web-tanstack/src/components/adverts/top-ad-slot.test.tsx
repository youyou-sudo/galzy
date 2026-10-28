// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import type {
	AdMobileMode,
	AdSlotPayload,
	PublicAdvert,
} from "@web/lib/adverts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdSlotView } from "./top-ad-slot";

const trackAdvertMock = vi.hoisted(() =>
	vi.fn(async () => ({ success: true })),
);

vi.mock("@web/server/adverts", () => ({
	adSlotQueryOptions: (key: string) => ({
		queryKey: ["adverts", "slot", key],
		queryFn: async () => null,
	}),
	trackAdvert: trackAdvertMock,
}));

type MockEntry = { isIntersecting: boolean };
const observers: Array<{ cb: (entries: MockEntry[]) => void }> = [];

class MockIntersectionObserver {
	cb: (entries: MockEntry[]) => void;
	constructor(cb: (entries: MockEntry[]) => void) {
		this.cb = cb;
		observers.push({ cb });
	}
	observe() {}
	unobserve() {}
	disconnect() {}
}

beforeEach(() => {
	observers.length = 0;
	trackAdvertMock.mockClear();
	vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function ad(id: number, overrides: Partial<PublicAdvert> = {}): PublicAdvert {
	return {
		id,
		name: `ad${id}`,
		image: `https://cdn.example.com/ad-${id}.webp`,
		href: `https://example.com/${id}`,
		device: "all",
		...overrides,
	};
}

function payload(overrides: {
	desktop?: PublicAdvert[];
	mobile?: PublicAdvert[];
	mobileMode?: AdMobileMode;
	carouselInterval?: number;
	maxItems?: number;
}): AdSlotPayload {
	return {
		slot: {
			key: "home_top",
			name: "首页顶部横幅",
			maxItems: overrides.maxItems ?? 2,
			mobileMode: overrides.mobileMode ?? "carousel",
			carouselInterval: overrides.carouselInterval ?? 5,
		},
		desktop: overrides.desktop ?? [],
		mobile: overrides.mobile ?? [],
	};
}

describe("AdSlotView", () => {
	it("没有在投素材时整块不渲染", () => {
		const { container } = render(<AdSlotView payload={payload({})} />);

		expect(container.firstChild).toBeNull();
	});

	it("桌面端只有 1 条时保持整宽，不套两列网格", () => {
		render(<AdSlotView payload={payload({ desktop: [ad(1)] })} />);

		const desktop = screen.getByTestId("advert-desktop");
		expect(within(desktop).getAllByRole("link")).toHaveLength(1);
		expect(desktop.querySelector('[class*="grid-cols-2"]')).toBeNull();
	});

	it("桌面端 2 条时左右各占一半", () => {
		render(<AdSlotView payload={payload({ desktop: [ad(1), ad(2)] })} />);

		const desktop = screen.getByTestId("advert-desktop");
		expect(within(desktop).getAllByRole("link")).toHaveLength(2);
		expect(desktop.querySelector('[class*="grid-cols-2"]')).not.toBeNull();
	});

	it("广告位配置了更多展示位时，返回的素材全部渲染", () => {
		render(
			<AdSlotView
				payload={payload({ desktop: [ad(1), ad(2), ad(3)], maxItems: 4 })}
			/>,
		);

		expect(
			within(screen.getByTestId("advert-desktop")).getAllByRole("link"),
		).toHaveLength(3);
	});

	it("手机端轮播：2 条素材出 2 个圆点，点击第二个圆点切换当前项", () => {
		render(
			<AdSlotView
				payload={payload({ desktop: [ad(1), ad(2)], mobile: [ad(1), ad(2)] })}
			/>,
		);

		const mobile = screen.getByTestId("advert-mobile");
		expect(within(mobile).getAllByTestId("advert-mobile-slide")).toHaveLength(
			2,
		);

		const dots = within(mobile).getAllByRole("button", {
			name: /查看第 \d 条广告/,
		});
		expect(dots).toHaveLength(2);
		expect(dots[0].getAttribute("aria-current")).toBe("true");

		fireEvent.click(dots[1]);

		expect(dots[1].getAttribute("aria-current")).toBe("true");
		expect(dots[0].getAttribute("aria-current")).toBeNull();
	});

	it("手机端只有 1 条素材时不出圆点", () => {
		render(
			<AdSlotView payload={payload({ desktop: [ad(1)], mobile: [ad(1)] })} />,
		);

		const mobile = screen.getByTestId("advert-mobile");
		expect(within(mobile).getAllByTestId("advert-mobile-slide")).toHaveLength(
			1,
		);
		expect(
			within(mobile).queryAllByRole("button", { name: /查看第 \d 条广告/ }),
		).toHaveLength(0);
	});

	it("广告位配置 mobileMode=stack 时手机端竖向堆叠", () => {
		render(
			<AdSlotView
				payload={payload({
					desktop: [ad(1)],
					mobile: [ad(1), ad(2)],
					mobileMode: "stack",
				})}
			/>,
		);

		const mobile = screen.getByTestId("advert-mobile");
		expect(within(mobile).getAllByRole("link")).toHaveLength(2);
		expect(within(mobile).queryAllByTestId("advert-mobile-slide")).toHaveLength(
			0,
		);
		expect(
			within(mobile).queryAllByRole("button", { name: /查看第 \d 条广告/ }),
		).toHaveLength(0);
	});

	it("广告位配置 mobileMode=hidden 时手机端整块不渲染，桌面端不受影响", () => {
		render(
			<AdSlotView
				payload={payload({
					desktop: [ad(1)],
					mobile: [ad(1)],
					mobileMode: "hidden",
				})}
			/>,
		);

		expect(screen.queryByTestId("advert-mobile")).toBeNull();
		expect(screen.getByTestId("advert-desktop")).toBeTruthy();
	});

	it("只有手机端素材时，桌面分支不渲染但手机分支正常", () => {
		render(<AdSlotView payload={payload({ mobile: [ad(1)] })} />);

		expect(screen.queryByTestId("advert-desktop")).toBeNull();
		expect(screen.getByTestId("advert-mobile")).toBeTruthy();
	});

	it("素材的链接、图片与 umami 埋点字段来自广告数据", () => {
		render(<AdSlotView payload={payload({ desktop: [ad(3)] })} />);

		const link = within(screen.getByTestId("advert-desktop")).getByRole("link");
		expect(link.getAttribute("href")).toBe("https://example.com/3");
		expect(link.getAttribute("target")).toBe("_blank");
		expect(link.getAttribute("rel")).toBe("noopener noreferrer");
		expect(link.getAttribute("data-umami-event-name")).toBe("ad3");
		expect(link.getAttribute("data-umami-event-position")).toBe("Banner-ad3");

		const image = link.querySelector("img");
		expect(image?.getAttribute("src")).toBe(
			"https://cdn.example.com/ad-3.webp",
		);
		expect(image?.getAttribute("alt")).toBe("ad3 广告图片");
		expect(image?.getAttribute("loading")).toBe("lazy");
	});

	it("素材可见 1s 后上报一次曝光，点击后上报点击", () => {
		vi.useFakeTimers();
		render(<AdSlotView payload={payload({ desktop: [ad(1)] })} />);

		expect(observers).toHaveLength(1);
		act(() => {
			observers[0].cb([{ isIntersecting: true }]);
		});
		act(() => {
			vi.advanceTimersByTime(1000);
		});

		expect(trackAdvertMock).toHaveBeenCalledWith({
			data: { id: 1, type: "impression" },
		});

		const link = within(screen.getByTestId("advert-desktop")).getByRole("link");
		act(() => {
			fireEvent.click(link);
		});

		expect(trackAdvertMock).toHaveBeenCalledWith({
			data: { id: 1, type: "click" },
		});
	});

	it("素材不可见时取消计时，不会误报曝光", () => {
		vi.useFakeTimers();
		render(<AdSlotView payload={payload({ desktop: [ad(1)] })} />);

		act(() => {
			observers[0].cb([{ isIntersecting: true }]);
			observers[0].cb([{ isIntersecting: false }]);
		});
		act(() => {
			vi.advanceTimersByTime(2000);
		});

		expect(trackAdvertMock).not.toHaveBeenCalled();
	});
});
