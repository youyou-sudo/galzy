// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AdSlotPayload, PublicAdvert } from "@web/lib/adverts";
import { afterEach, describe, expect, it, vi } from "vitest";

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

const { DesktopNavAdItem, MobileNavAdRow } = await import(
	"@web/components/adverts/nav-ad"
);

const navAd: PublicAdvert = {
	id: 7,
	name: "AI女友",
	image: null,
	href: "https://www.yyai.online/explore/app/?ref=4hbq",
	device: "all",
};

function payload(adverts: PublicAdvert[]): AdSlotPayload {
	return {
		slot: {
			key: "header_nav",
			name: "顶栏导航入口",
			maxItems: 1,
			mobileMode: "carousel",
			carouselInterval: 0,
		},
		desktop: adverts,
		mobile: adverts,
	};
}

/** 用 seed 好的 query 缓存渲染：SSR 下发的数据就是这样进组件的。 */
function renderWithSlot(adverts: PublicAdvert[]) {
	const client = new QueryClient({
		defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
	});
	client.setQueryData(["adverts", "slot", "header_nav"], payload(adverts));
	return render(
		<QueryClientProvider client={client}>
			<DesktopNavAdItem />
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	trackAdvertMock.mockClear();
});

describe("顶栏推广位", () => {
	it("渲染后台下发的文案与链接，并标记为广告（sponsored nofollow）", () => {
		renderWithSlot([navAd]);

		const link = screen.getByRole("link", { name: "AI女友" });
		expect(link.getAttribute("href")).toBe(navAd.href);
		expect(link.getAttribute("target")).toBe("_blank");
		// 关键：搜索引擎据此判定这是推广外链，不抓取、不传递权重
		expect(link.getAttribute("rel")).toBe(
			"sponsored nofollow noopener noreferrer",
		);
		expect(link.getAttribute("data-ad-slot")).toBe("header_nav");
	});

	it("点击后上报点击统计", () => {
		renderWithSlot([navAd]);

		fireEvent.click(screen.getByRole("link", { name: "AI女友" }));

		expect(trackAdvertMock).toHaveBeenCalledWith({
			data: { id: 7, type: "click" },
		});
	});

	it("广告位没有在投素材时整格不渲染", () => {
		const { container } = renderWithSlot([]);

		expect(container.firstChild).toBeNull();
	});

	it("手机菜单里的推广行同样是广告语义，点击会关闭菜单", () => {
		const onSelect = vi.fn();
		const client = new QueryClient({
			defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
		});
		client.setQueryData(["adverts", "slot", "header_nav"], payload([navAd]));
		render(
			<QueryClientProvider client={client}>
				<MobileNavAdRow index={0} open onSelect={onSelect} />
			</QueryClientProvider>,
		);

		const link = screen.getByRole("link", { name: "AI女友" });
		expect(link.getAttribute("rel")).toBe(
			"sponsored nofollow noopener noreferrer",
		);

		fireEvent.click(link);
		expect(trackAdvertMock).toHaveBeenCalledWith({
			data: { id: 7, type: "click" },
		});
		expect(onSelect).toHaveBeenCalled();
	});
});

describe("pickNavAdvert", () => {
	it("优先桌面投放列表，缺失时回落到手机列表", async () => {
		const { pickNavAdvert } = await import("@web/lib/adverts");

		expect(pickNavAdvert(null)).toBeNull();
		expect(
			pickNavAdvert({ ...payload([]), desktop: [navAd], mobile: [] }),
		).toEqual(navAd);
		expect(
			pickNavAdvert({ ...payload([]), desktop: [], mobile: [navAd] }),
		).toEqual(navAd);
	});
});
